import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CustomApi, Agent } from "@shared/schema";
import { useState } from "react";
import {
  Plus,
  PlayCircle,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Key,
  Code,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export default function APIManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<CustomApi | null>(null);
  const [testingApiId, setTestingApiId] = useState<string | null>(null);
  const [testedApiId, setTestedApiId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [selectedAgentForIngest, setSelectedAgentForIngest] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    baseUrl: "",
    method: "GET",
    authType: "none",
    authKeyEnvVar: "",
    authHeaderName: "",
    headers: "{}",
    queryParams: "{}",
    requestBody: "",
    jsonPath: "",
    titlePath: "",
    contentPath: "",
    filterPrompt: "",
    responseFormat: "json",
    refreshInterval: 60,
  });

  // Fetch all custom APIs
  const { data: apis, isLoading } = useQuery<CustomApi[]>({
    queryKey: ["/api/custom-apis"],
  });

  // Fetch all agents for ingestion
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Test API mutation
  const testApiMutation = useMutation({
    mutationFn: async (apiId: string) => {
      setTestingApiId(apiId);
      setTestResult(null); // Clear previous test results
      setTestedApiId(null); // Clear previous tested API
      const response = await fetch(`/api/custom-apis/${apiId}/test`, {
        method: "POST",
      });
      return { data: await response.json(), apiId };
    },
    onSuccess: ({ data, apiId }) => {
      setTestResult(data);
      setTestingApiId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/custom-apis"] });
      
      if (data.success) {
        // Only set testedApiId when test actually succeeds
        setTestedApiId(apiId);
        toast({
          title: "API Test Successful",
          description: `Extracted ${data.extractedCount || 0} items from response`,
        });
      } else {
        // Clear testedApiId on test failure
        setTestedApiId(null);
        toast({
          title: "API Test Failed",
          description: data.error || "Failed to fetch from API",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setTestingApiId(null);
      setTestedApiId(null); // Clear on error
      setTestResult(null); // Clear test results
      toast({
        title: "Test Error",
        description: error.message || "Failed to test API",
        variant: "destructive",
      });
    },
  });

  // Create API mutation
  const createApiMutation = useMutation({
    mutationFn: async (data: any) => {
      // Validate and parse JSON strings before sending to backend
      let headers = {};
      let queryParams = {};
      
      try {
        headers = JSON.parse(data.headers || "{}");
      } catch (e: any) {
        throw new Error(`Invalid JSON in headers: ${e.message}`);
      }
      
      try {
        queryParams = JSON.parse(data.queryParams || "{}");
      } catch (e: any) {
        throw new Error(`Invalid JSON in query parameters: ${e.message}`);
      }

      return apiRequest("POST", "/api/custom-apis", {
        ...data,
        headers,
        queryParams,
        refreshInterval: parseInt(data.refreshInterval) || 60,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-apis"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "API Created",
        description: "Custom API has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API",
        variant: "destructive",
      });
    },
  });

  // Update API mutation
  const updateApiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Validate and parse JSON strings before sending to backend
      let headers = {};
      let queryParams = {};
      
      try {
        headers = JSON.parse(data.headers || "{}");
      } catch (e: any) {
        throw new Error(`Invalid JSON in headers: ${e.message}`);
      }
      
      try {
        queryParams = JSON.parse(data.queryParams || "{}");
      } catch (e: any) {
        throw new Error(`Invalid JSON in query parameters: ${e.message}`);
      }

      return apiRequest("PATCH", `/api/custom-apis/${id}`, {
        ...data,
        headers,
        queryParams,
        refreshInterval: parseInt(data.refreshInterval) || 60,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-apis"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "API Updated",
        description: "Custom API has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update API",
        variant: "destructive",
      });
    },
  });

  // Delete API mutation
  const deleteApiMutation = useMutation({
    mutationFn: async (apiId: string) => {
      return apiRequest("DELETE", `/api/custom-apis/${apiId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-apis"] });
      toast({
        title: "API Deleted",
        description: "Custom API has been removed",
      });
    },
  });

  // Ingest data to agent mutation
  const ingestMutation = useMutation({
    mutationFn: async ({ apiId, agentId }: { apiId: string; agentId: string }) => {
      const response = await fetch(`/api/agents/${agentId}/knowledge/ingest/${apiId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to ingest data");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Data Ingested Successfully",
        description: `${data.autoApproved || 0} auto-approved, ${data.pendingReview || 0} pending review`,
      });
      setSelectedAgentForIngest("");
    },
    onError: (error: any) => {
      toast({
        title: "Ingestion Failed",
        description: error.message || "Failed to ingest data to agent",
        variant: "destructive",
      });
    },
  });

  // Refresh KB entries from API source
  const refreshMutation = useMutation({
    mutationFn: async ({ apiId, agentId }: { apiId: string; agentId: string }) => {
      const response = await fetch(`/api/agents/${agentId}/knowledge/refresh/${apiId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to refresh data");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "KB Refreshed Successfully",
        description: `Removed ${data.removed} old entries, added ${data.added} new (${data.autoApproved} auto-approved)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh KB data",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      baseUrl: "",
      method: "GET",
      authType: "none",
      authKeyEnvVar: "",
      authHeaderName: "",
      headers: "{}",
      queryParams: "{}",
      requestBody: "",
      jsonPath: "",
      titlePath: "",
      contentPath: "",
      filterPrompt: "",
      responseFormat: "json",
      refreshInterval: 60,
    });
    setEditingApi(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingApi) {
      updateApiMutation.mutate({ id: editingApi.id, data: formData });
    } else {
      createApiMutation.mutate(formData);
    }
  };

  const handleEdit = (api: CustomApi) => {
    setEditingApi(api);
    setFormData({
      name: api.name,
      description: api.description || "",
      baseUrl: api.baseUrl,
      method: api.method,
      authType: api.authType || "none",
      authKeyEnvVar: api.authKeyEnvVar || "",
      authHeaderName: api.authHeaderName || "",
      headers: JSON.stringify(api.headers || {}, null, 2),
      queryParams: JSON.stringify(api.queryParams || {}, null, 2),
      requestBody: api.requestBody || "",
      jsonPath: api.jsonPath || "",
      titlePath: api.titlePath || "",
      contentPath: api.contentPath || "",
      filterPrompt: api.filterPrompt || "",
      responseFormat: api.responseFormat || "json",
      refreshInterval: api.refreshInterval || 60,
    });
    setIsAddDialogOpen(true);
  };

  const getStatusBadge = (api: CustomApi) => {
    if (!api.testStatus || api.testStatus === "never_tested") {
      return <Badge variant="outline">Never Tested</Badge>;
    }
    if (api.testStatus === "success") {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Working
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Knowledge Sources
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up API sources to automatically fetch knowledge for your agents
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-api">
              <Plus className="mr-2 h-4 w-4" />
              Add API Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingApi ? "Edit API Source" : "Add New API Source"}</DialogTitle>
              <DialogDescription>
                {editingApi 
                  ? "Update API configuration and test the connection."
                  : "Configure a new API for automatic KB ingestion. API keys are stored securely in Replit Secrets."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="News API, CoinGecko, etc."
                    required
                    data-testid="input-api-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Crypto news and market data"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">API URL *</Label>
                    <Input
                      id="baseUrl"
                      value={formData.baseUrl}
                      onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1/data"
                      required
                      data-testid="input-api-url"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="method">HTTP Method</Label>
                    <Select
                      value={formData.method}
                      onValueChange={(value) => setFormData({ ...formData, method: value })}
                    >
                      <SelectTrigger id="method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Authentication</Label>
                  <Select
                    value={formData.authType}
                    onValueChange={(value) => setFormData({ ...formData, authType: value })}
                  >
                    <SelectTrigger data-testid="select-auth-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Authentication</SelectItem>
                      <SelectItem value="api_key">API Key (Header)</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.authType !== "none" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="authKeyEnvVar" className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Secret Name *
                      </Label>
                      <Input
                        id="authKeyEnvVar"
                        value={formData.authKeyEnvVar}
                        onChange={(e) => setFormData({ ...formData, authKeyEnvVar: e.target.value })}
                        placeholder="NEWS_API_KEY"
                        required={formData.authType !== "none"}
                        data-testid="input-secret-name"
                      />
                      <p className="text-xs text-muted-foreground">
                        Add this in Replit Secrets tab
                      </p>
                    </div>

                    {formData.authType === "api_key" && (
                      <div className="space-y-2">
                        <Label htmlFor="authHeaderName">Header Name *</Label>
                        <Input
                          id="authHeaderName"
                          value={formData.authHeaderName}
                          onChange={(e) => setFormData({ ...formData, authHeaderName: e.target.value })}
                          placeholder="X-API-Key"
                          required={formData.authType === "api_key"}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="jsonPath" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    JSON Path (for data extraction)
                  </Label>
                  <Input
                    id="jsonPath"
                    value={formData.jsonPath}
                    onChange={(e) => setFormData({ ...formData, jsonPath: e.target.value })}
                    placeholder="$.data.articles[*]"
                    data-testid="input-json-path"
                  />
                  <p className="text-xs text-muted-foreground">
                    Extract array of items: $.data.articles[*]
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="titlePath">Title Path</Label>
                    <Input
                      id="titlePath"
                      value={formData.titlePath}
                      onChange={(e) => setFormData({ ...formData, titlePath: e.target.value })}
                      placeholder="$.title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contentPath">Content Path</Label>
                    <Input
                      id="contentPath"
                      value={formData.contentPath}
                      onChange={(e) => setFormData({ ...formData, contentPath: e.target.value })}
                      placeholder="$.description"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filterPrompt" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI Filter Prompt (Optional)
                  </Label>
                  <Textarea
                    id="filterPrompt"
                    value={formData.filterPrompt}
                    onChange={(e) => setFormData({ ...formData, filterPrompt: e.target.value })}
                    placeholder="Example: Select only content about biblical lessons and moral values that users care deeply about"
                    className="min-h-[100px]"
                    data-testid="input-filter-prompt"
                  />
                  <p className="text-xs text-muted-foreground">
                    Custom instructions for AI to filter ingested content. Leave empty to use default crypto/tech/Twitter filter.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="queryParams">Query Parameters (JSON)</Label>
                  <Textarea
                    id="queryParams"
                    value={formData.queryParams}
                    onChange={(e) => setFormData({ ...formData, queryParams: e.target.value })}
                    placeholder='{"category": "crypto", "limit": "10"}'
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headers">Custom Headers (JSON)</Label>
                  <Textarea
                    id="headers"
                    value={formData.headers}
                    onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                    placeholder='{"Content-Type": "application/json"}'
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createApiMutation.isPending || updateApiMutation.isPending} 
                  data-testid="button-save-api"
                >
                  {editingApi
                    ? (updateApiMutation.isPending ? "Updating..." : "Update API")
                    : (createApiMutation.isPending ? "Creating..." : "Create API")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted" />
          ))}
        </div>
      ) : apis && apis.length > 0 ? (
        <div className="grid gap-4">
          {apis.map((api) => (
            <Card key={api.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle>{api.name}</CardTitle>
                      {getStatusBadge(api)}
                      {api.enabled ? (
                        <Badge variant="outline">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <CardDescription>{api.description || "No description"}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testApiMutation.mutate(api.id)}
                      disabled={testingApiId === api.id}
                      data-testid={`button-test-${api.id}`}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      {testingApiId === api.id ? "Testing..." : "Test"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(api)}
                      data-testid={`button-edit-${api.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteApiMutation.mutate(api.id)}
                      data-testid={`button-delete-${api.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">URL:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{api.baseUrl}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Method:</span>
                    <Badge variant="secondary">{api.method}</Badge>
                  </div>
                  {api.authType !== "none" && (
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Auth:</span>
                      <Badge variant="outline">{api.authType}</Badge>
                      {api.authKeyEnvVar && (
                        <code className="text-xs bg-muted px-2 py-1 rounded">{api.authKeyEnvVar}</code>
                      )}
                    </div>
                  )}
                  {api.jsonPath && (
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">JSON Path:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{api.jsonPath}</code>
                    </div>
                  )}
                  {api.lastTestedAt && (
                    <div className="text-xs text-muted-foreground">
                      Last tested: {new Date(api.lastTestedAt).toLocaleString()}
                    </div>
                  )}
                  {api.testError && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Test Error:</p>
                        <p className="text-muted-foreground">{api.testError}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No API sources configured yet</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First API
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Test Result Display */}
      {testResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Test Result</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawResponse(!showRawResponse)}
              >
                {showRawResponse ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {showRawResponse ? "Hide" : "Show"} Raw Response
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={testResult.success ? "default" : "destructive"}>
                  {testResult.status} {testResult.statusText}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Items Extracted</p>
                <p className="text-2xl font-bold">{testResult.extractedCount || 0}</p>
              </div>
              {testResult.previewKBEntry && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">KB Preview</p>
                  <Badge variant="outline">Ready to Ingest</Badge>
                </div>
              )}
            </div>

            {testResult.previewKBEntry && (
              <div className="p-4 border rounded-lg space-y-2 bg-muted/50">
                <p className="font-medium">Preview KB Entry:</p>
                <div className="space-y-1">
                  <p className="text-sm"><strong>Title:</strong> {testResult.previewKBEntry.title}</p>
                  <p className="text-sm"><strong>Content:</strong> {testResult.previewKBEntry.content}</p>
                </div>
              </div>
            )}

            {testResult.extractionError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                <p className="font-medium text-destructive">Extraction Error:</p>
                <p className="text-muted-foreground">{testResult.extractionError}</p>
              </div>
            )}

            {showRawResponse && (
              <div className="space-y-2">
                <Label>Raw API Response:</Label>
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-96">
                  {JSON.stringify(testResult.rawResponse, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ingest to Agent Section */}
      {testResult && testResult.success && testResult.extractedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ingest to Agent</CardTitle>
            <CardDescription>
              Pull {testResult.extractedCount} {testResult.extractedCount === 1 ? 'entry' : 'entries'} into your agent's knowledge base for review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent-select">Select Agent</Label>
              <Select
                value={selectedAgentForIngest}
                onValueChange={setSelectedAgentForIngest}
              >
                <SelectTrigger id="agent-select" data-testid="select-ingest-agent">
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No agents available. Create one first.
                    </div>
                  ) : (
                    agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} (@{agent.username})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!selectedAgentForIngest) {
                      toast({
                        title: "No Agent Selected",
                        description: "Please select an agent to ingest data",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (testedApiId) {
                      ingestMutation.mutate({ apiId: testedApiId, agentId: selectedAgentForIngest });
                    }
                  }}
                  disabled={!selectedAgentForIngest || ingestMutation.isPending}
                  data-testid="button-ingest-now"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {ingestMutation.isPending ? "Ingesting..." : "Ingest Now"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedAgentForIngest) {
                      toast({
                        title: "No Agent Selected",
                        description: "Please select an agent to refresh data",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (testedApiId) {
                      refreshMutation.mutate({ apiId: testedApiId, agentId: selectedAgentForIngest });
                    }
                  }}
                  disabled={!selectedAgentForIngest || refreshMutation.isPending}
                  data-testid="button-refresh-kb"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {refreshMutation.isPending ? "Refreshing..." : "Refresh KB"}
                </Button>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-1">
                  <span className="font-medium">Ingest:</span> AI filters for crypto/tech/twitter topics, auto-approves relevant entries
                </p>
                <p className="flex items-center gap-1">
                  <span className="font-medium">Refresh:</span> Removes old entries and re-ingests fresh data from source
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
