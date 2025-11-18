import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type CustomAPI = {
  id: string;
  name: string;
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  bodyTemplate: string;
  frequency: number;
  frequencyUnit: "minutes" | "hours";
  jsonPath: string;
  status: "active" | "inactive" | "error";
  lastTested: Date | null;
  lastFetch: Date | null;
};

export default function CustomAPIs() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  
  const [newAPI, setNewAPI] = useState({
    name: "",
    url: "",
    method: "GET" as "GET" | "POST",
    headers: "{}",
    queryParams: "{}",
    bodyTemplate: "{}",
    frequency: 15,
    frequencyUnit: "minutes" as "minutes" | "hours",
    jsonPath: "$.data",
  });

  const [apis, setApis] = useState<CustomAPI[]>([
    {
      id: "1",
      name: "Custom Crypto Prices",
      url: "https://api.example.com/crypto/prices",
      method: "GET",
      headers: { "Authorization": "Bearer xxx" },
      queryParams: { "symbols": "BTC,ETH" },
      bodyTemplate: "",
      frequency: 5,
      frequencyUnit: "minutes",
      jsonPath: "$.prices",
      status: "active",
      lastTested: new Date(Date.now() - 10 * 60 * 1000),
      lastFetch: new Date(Date.now() - 2 * 60 * 1000),
    },
  ]);

  const handleAddAPI = () => {
    if (!newAPI.name || !newAPI.url) return;
    
    try {
      const api: CustomAPI = {
        id: Date.now().toString(),
        name: newAPI.name,
        url: newAPI.url,
        method: newAPI.method,
        headers: JSON.parse(newAPI.headers),
        queryParams: JSON.parse(newAPI.queryParams),
        bodyTemplate: newAPI.bodyTemplate,
        frequency: newAPI.frequency,
        frequencyUnit: newAPI.frequencyUnit,
        jsonPath: newAPI.jsonPath,
        status: "inactive",
        lastTested: null,
        lastFetch: null,
      };
      
      setApis([api, ...apis]);
      setNewAPI({
        name: "",
        url: "",
        method: "GET",
        headers: "{}",
        queryParams: "{}",
        bodyTemplate: "{}",
        frequency: 15,
        frequencyUnit: "minutes",
        jsonPath: "$.data",
      });
      setIsAddDialogOpen(false);
      
      toast({
        title: "Custom API added",
        description: "Test the API to verify it works correctly.",
      });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your headers, params, or body JSON format.",
        variant: "destructive",
      });
    }
  };

  const handleTestAPI = async (id: string) => {
    const api = apis.find(a => a.id === id);
    if (!api) return;
    
    setTestingId(id);
    setTestResult(null);
    
    // Simulate API test
    setTimeout(() => {
      const mockResult = {
        status: 200,
        data: {
          prices: [
            { symbol: "BTC", price: 43250, change: 2.5 },
            { symbol: "ETH", price: 2315, change: -0.8 },
          ],
        },
        extractedData: [
          { symbol: "BTC", price: 43250 },
          { symbol: "ETH", price: 2315 },
        ],
      };
      
      setTestResult(mockResult);
      setTestingId(null);
      
      setApis(prev =>
        prev.map(a =>
          a.id === id ? { ...a, status: "active" as const, lastTested: new Date() } : a
        )
      );
      
      toast({
        title: "API test successful",
        description: "Data extracted successfully using JSONPath.",
      });
    }, 2000);
  };

  const handleToggleStatus = (id: string) => {
    setApis(prev =>
      prev.map(api =>
        api.id === id
          ? { ...api, status: api.status === "active" ? ("inactive" as const) : ("active" as const) }
          : api
      )
    );
  };

  const handleDelete = (id: string) => {
    setApis(prev => prev.filter(a => a.id !== id));
    toast({
      title: "API deleted",
      description: "Custom API has been removed.",
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Custom APIs</h1>
          <p className="text-sm text-muted-foreground">
            Add and configure custom API endpoints with data extraction
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-api">
              <Plus className="mr-2 h-4 w-4" />
              Add Custom API
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Custom API</DialogTitle>
              <DialogDescription>Configure a custom API endpoint with data extraction rules</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="basic" className="space-y-4">
              <TabsList>
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="request">Request Config</TabsTrigger>
                <TabsTrigger value="extraction">Data Extraction</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-name">API Name</Label>
                  <Input
                    id="api-name"
                    value={newAPI.name}
                    onChange={(e) => setNewAPI({ ...newAPI, name: e.target.value })}
                    placeholder="e.g., Custom Token Prices"
                    data-testid="input-api-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-url">API URL</Label>
                  <Input
                    id="api-url"
                    value={newAPI.url}
                    onChange={(e) => setNewAPI({ ...newAPI, url: e.target.value })}
                    placeholder="https://api.example.com/endpoint"
                    className="font-mono text-sm"
                    data-testid="input-api-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-method">HTTP Method</Label>
                  <Select value={newAPI.method} onValueChange={(v: "GET" | "POST") => setNewAPI({ ...newAPI, method: v })}>
                    <SelectTrigger id="api-method" data-testid="select-api-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Fetch Frequency</Label>
                    <Input
                      id="frequency"
                      type="number"
                      value={newAPI.frequency}
                      onChange={(e) => setNewAPI({ ...newAPI, frequency: parseInt(e.target.value) })}
                      min="1"
                      data-testid="input-frequency"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frequency-unit">Unit</Label>
                    <Select
                      value={newAPI.frequencyUnit}
                      onValueChange={(v: "minutes" | "hours") => setNewAPI({ ...newAPI, frequencyUnit: v })}
                    >
                      <SelectTrigger id="frequency-unit" data-testid="select-frequency-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="request" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headers">Headers (JSON)</Label>
                  <Textarea
                    id="headers"
                    value={newAPI.headers}
                    onChange={(e) => setNewAPI({ ...newAPI, headers: e.target.value })}
                    placeholder='{"Authorization": "Bearer YOUR_TOKEN", "Content-Type": "application/json"}'
                    className="min-h-[100px] font-mono text-sm"
                    data-testid="input-headers"
                  />
                  <p className="text-xs text-muted-foreground">Authentication headers and custom headers</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="query-params">Query Parameters (JSON)</Label>
                  <Textarea
                    id="query-params"
                    value={newAPI.queryParams}
                    onChange={(e) => setNewAPI({ ...newAPI, queryParams: e.target.value })}
                    placeholder='{"limit": "100", "sort": "desc"}'
                    className="min-h-[100px] font-mono text-sm"
                    data-testid="input-query-params"
                  />
                  <p className="text-xs text-muted-foreground">URL query parameters</p>
                </div>
                {newAPI.method === "POST" && (
                  <div className="space-y-2">
                    <Label htmlFor="body-template">Request Body Template (JSON)</Label>
                    <Textarea
                      id="body-template"
                      value={newAPI.bodyTemplate}
                      onChange={(e) => setNewAPI({ ...newAPI, bodyTemplate: e.target.value })}
                      placeholder='{"query": "data", "fields": ["price", "volume"]}'
                      className="min-h-[120px] font-mono text-sm"
                      data-testid="input-body-template"
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="extraction" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="json-path">JSONPath Expression</Label>
                  <Input
                    id="json-path"
                    value={newAPI.jsonPath}
                    onChange={(e) => setNewAPI({ ...newAPI, jsonPath: e.target.value })}
                    placeholder="$.data.items[*]"
                    className="font-mono text-sm"
                    data-testid="input-json-path"
                  />
                  <p className="text-xs text-muted-foreground">
                    Path to extract data from response (e.g., $.data, $.results[*], $.items[0].price)
                  </p>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">JSONPath Examples</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Root level data:</span>
                      <span>$.data</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">All items in array:</span>
                      <span>$.items[*]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">First item:</span>
                      <span>$.items[0]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nested property:</span>
                      <span>$.response.data.prices</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddAPI} data-testid="button-save-api">
                Add API
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {apis.map((api) => (
          <Card key={api.id} data-testid={`card-api-${api.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-base">{api.name}</CardTitle>
                    <Badge
                      variant={
                        api.status === "active" ? "default" :
                        api.status === "error" ? "destructive" : "secondary"
                      }
                      className="gap-1"
                    >
                      {api.status === "active" ? <CheckCircle2 className="h-3 w-3" /> :
                       api.status === "error" ? <XCircle className="h-3 w-3" /> : null}
                      {api.status.charAt(0).toUpperCase() + api.status.slice(1)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {api.method}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">{api.url}</CardDescription>
                  <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>Frequency: Every {api.frequency} {api.frequencyUnit}</span>
                    <span>•</span>
                    <span>Last tested: {formatDate(api.lastTested)}</span>
                    <span>•</span>
                    <span>Last fetch: {formatDate(api.lastFetch)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestAPI(api.id)}
                    disabled={testingId === api.id}
                    data-testid={`button-test-${api.id}`}
                  >
                    {testingId === api.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Test API
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(api.id)}
                    data-testid={`button-toggle-${api.id}`}
                  >
                    {api.status === "active" ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(api.id)}
                    data-testid={`button-delete-${api.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {testResult && testingId === null && (
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Test Result</Badge>
                    <span className="text-sm text-muted-foreground">Status: {testResult.status}</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Raw Response:</Label>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40 font-mono">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Extracted Data (using JSONPath):</Label>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40 font-mono">
                      {JSON.stringify(testResult.extractedData, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {apis.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No custom APIs configured. Add one to get started.</p>
        </div>
      )}
    </div>
  );
}
