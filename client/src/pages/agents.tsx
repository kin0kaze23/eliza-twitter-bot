import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Play, Pause, Settings, Copy, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Agent } from "@shared/schema";

export default function Agents() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    username: "",
    bio: "",
    systemPrompt: "",
    personalityPrompt: "",
  });
  
  // Fetch agents from backend
  const { data: agents, isLoading, error } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Create agent mutation
  const createMutation = useMutation({
    mutationFn: async (agent: typeof newAgent) => {
      return apiRequest("POST", "/api/agents", {
        name: agent.name,
        username: agent.username,
        bio: agent.bio,
        systemPrompt: agent.systemPrompt,
        personalityPrompt: agent.personalityPrompt,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setNewAgent({
        name: "",
        username: "",
        bio: "",
        systemPrompt: "",
        personalityPrompt: "",
      });
      setIsCreateDialogOpen(false);
      toast({
        title: "Agent created",
        description: "New agent has been created as a draft. Configure it before deploying.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create agent",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/agents/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  // Delete agent mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent deleted",
        description: "Agent has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete agent",
        variant: "destructive",
      });
    },
  });

  // Duplicate agent mutation
  const duplicateMutation = useMutation({
    mutationFn: async (originalAgent: Agent) => {
      // Only copy configuration fields, not IDs or timestamps
      return apiRequest("POST", "/api/agents", {
        name: `${originalAgent.name} (Copy)`,
        username: `${originalAgent.username}_copy_${Date.now()}`,
        bio: originalAgent.bio,
        systemPrompt: originalAgent.systemPrompt,
        personalityPrompt: originalAgent.personalityPrompt,
        postStyle: originalAgent.postStyle,
        topics: originalAgent.topics,
        adjectives: originalAgent.adjectives,
        messageExamples: originalAgent.messageExamples,
        customPrompts: originalAgent.customPrompts,
        modelProvider: originalAgent.modelProvider,
        modelName: originalAgent.modelName,
        temperature: originalAgent.temperature,
        maxTokens: originalAgent.maxTokens,
        topP: originalAgent.topP,
        frequencyPenalty: originalAgent.frequencyPenalty,
        presencePenalty: originalAgent.presencePenalty,
        contextWindow: originalAgent.contextWindow,
        postingEnabled: originalAgent.postingEnabled,
        postFrequency: originalAgent.postFrequency,
        postInterval: originalAgent.postInterval,
        maxPostsPerDay: originalAgent.maxPostsPerDay,
        quietHoursEnabled: originalAgent.quietHoursEnabled,
        quietHoursStart: originalAgent.quietHoursStart,
        quietHoursEnd: originalAgent.quietHoursEnd,
        timezone: originalAgent.timezone,
        replyEnabled: originalAgent.replyEnabled,
        replyRate: originalAgent.replyRate,
        replyDelay: originalAgent.replyDelay,
        maxRepliesPerHour: originalAgent.maxRepliesPerHour,
        onlyReplyVerified: originalAgent.onlyReplyVerified,
        replyKeywords: originalAgent.replyKeywords,
        ignoreKeywords: originalAgent.ignoreKeywords,
        cryptoCommentary: originalAgent.cryptoCommentary,
        marketAnalysis: originalAgent.marketAnalysis,
        newsCommentary: originalAgent.newsCommentary,
        technicalAnalysis: originalAgent.technicalAnalysis,
        threads: originalAgent.threads,
        memes: originalAgent.memes,
        priceChangeThreshold: originalAgent.priceChangeThreshold,
        volumeChangeThreshold: originalAgent.volumeChangeThreshold,
        autoTweetOnNews: originalAgent.autoTweetOnNews,
        minNewsSentiment: originalAgent.minNewsSentiment,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent duplicated",
        description: "New draft agent created with same configuration.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate agent",
        variant: "destructive",
      });
    },
  });

  const handleCreateAgent = () => {
    if (!newAgent.name || !newAgent.username) {
      toast({
        title: "Validation error",
        description: "Name and username are required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newAgent);
  };

  const handleDeploy = (id: string) => {
    updateStatusMutation.mutate({ id, status: "deployed" });
    toast({
      title: "Agent deployed",
      description: "Agent is now active and will start posting according to its schedule.",
    });
  };

  const handlePause = (id: string) => {
    updateStatusMutation.mutate({ id, status: "paused" });
    toast({
      title: "Agent paused",
      description: "Agent has been paused and will not post until resumed.",
    });
  };

  const handleResume = (id: string) => {
    updateStatusMutation.mutate({ id, status: "deployed" });
    toast({
      title: "Agent resumed",
      description: "Agent is now active again.",
    });
  };

  const handleDuplicate = (agent: Agent) => {
    duplicateMutation.mutate(agent);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const diff = Date.now() - dateObj.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "deployed":
        return <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Deployed</Badge>;
      case "testing":
        return <Badge variant="secondary" className="gap-1"><Play className="h-3 w-3" />Testing</Badge>;
      case "paused":
        return <Badge variant="outline" className="gap-1"><Pause className="h-3 w-3" />Paused</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Agents</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load agents. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            AI Agents
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your Twitter AI agents ({agents?.length || 0} total)
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-agent">
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Create a new Twitter AI agent. You can configure it fully after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name *</Label>
                <Input
                  id="agent-name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="e.g., CryptoAnalyst"
                  data-testid="input-agent-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-username">Twitter Username *</Label>
                <Input
                  id="agent-username"
                  value={newAgent.username}
                  onChange={(e) => setNewAgent({ ...newAgent, username: e.target.value })}
                  placeholder="@username"
                  data-testid="input-agent-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-bio">Bio (optional)</Label>
                <Input
                  id="agent-bio"
                  value={newAgent.bio}
                  onChange={(e) => setNewAgent({ ...newAgent, bio: e.target.value })}
                  placeholder="Brief description..."
                  data-testid="input-agent-bio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-system-prompt">System Prompt (optional)</Label>
                <Input
                  id="agent-system-prompt"
                  value={newAgent.systemPrompt}
                  onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
                  placeholder="You are an AI agent..."
                  data-testid="input-agent-system-prompt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-personality">Personality Prompt (optional)</Label>
                <Input
                  id="agent-personality"
                  value={newAgent.personalityPrompt}
                  onChange={(e) => setNewAgent({ ...newAgent, personalityPrompt: e.target.value })}
                  placeholder="Professional, analytical..."
                  data-testid="input-agent-personality"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateAgent}
                disabled={createMutation.isPending}
                data-testid="button-save-agent"
              >
                {createMutation.isPending ? "Creating..." : "Create Agent"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {agents && agents.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">No agents yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first Twitter AI agent to get started
                </p>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents?.map((agent) => (
            <Card key={agent.id} className="hover-elevate" data-testid={`card-agent-${agent.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {agent.username}
                    </CardDescription>
                  </div>
                  {getStatusBadge(agent.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-mono text-xs">{agent.modelProvider}/{agent.modelName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Deployed:</span>
                    <span>{formatDate(agent.lastDeployedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="text-xs">{new Date(agent.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Link href={`/agent/${agent.id}/configure`}>
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-configure-${agent.id}`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                  </Link>

                  {agent.status === "draft" || agent.status === "testing" ? (
                    <Button
                      size="sm"
                      onClick={() => handleDeploy(agent.id)}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-deploy-${agent.id}`}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Deploy
                    </Button>
                  ) : agent.status === "paused" ? (
                    <Button
                      size="sm"
                      onClick={() => handleResume(agent.id)}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-resume-${agent.id}`}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePause(agent.id)}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-pause-${agent.id}`}
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(agent)}
                    disabled={duplicateMutation.isPending}
                    className="flex-1"
                    data-testid={`button-duplicate-${agent.id}`}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(agent.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 text-destructive hover:text-destructive"
                    data-testid={`button-delete-${agent.id}`}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
