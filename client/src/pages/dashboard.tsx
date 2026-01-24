import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Activity,
  MessageSquare,
  Zap,
  AlertCircle,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Bot,
  Settings,
  Heart,
  Repeat2,
  Reply
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Agent, ActivityLog } from "@shared/schema";
import { AgentHealthDashboard } from "@/components/agent-health-dashboard";
import { ContentDiversityStats } from "@/components/content-diversity-stats";

type SchedulerStatus = {
  isRunning: boolean;
  activeAgentCount: number;
  activeAgentIds: string[];
};

export default function Dashboard() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    username: "",
  });

  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agent = agents?.[0];

  const { data: activityLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs", agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      const res = await fetch(`/api/activity-logs?agentId=${agent.id}&limit=10`);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    enabled: !!agent,
    refetchInterval: 10000,
  });

  const { data: schedulerStatus, refetch: refetchScheduler } = useQuery<SchedulerStatus>({
    queryKey: ["/api/scheduler/status"],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; username: string }) => {
      return apiRequest("POST", "/api/agents", {
        ...data,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setNewAgent({ name: "", username: "" });
      setIsCreateDialogOpen(false);
      toast({
        title: "Agent Created",
        description: "Your agent has been created. Configure it to get started.",
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

  const startAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest("POST", `/api/agents/${agentId}/scheduler/start`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler/status"] });
      toast({ title: "Agent Started", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start agent", description: error.message, variant: "destructive" });
    },
  });

  const stopAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest("POST", `/api/agents/${agentId}/scheduler/stop`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler/status"] });
      toast({ title: "Agent Stopped", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to stop agent", description: error.message, variant: "destructive" });
    },
  });

  const forcePostMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest("POST", `/api/agents/${agentId}/force-post`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-logs", agent?.id] });
      toast({
        title: "Post Generated",
        description: data.tweetId ? "Tweet posted successfully!" : "Content generated (dry run mode).",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate post", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateAgent = () => {
    if (!newAgent.name || !newAgent.username) {
      toast({
        title: "Validation Error",
        description: "Name and username are required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newAgent);
  };

  const isAgentActive = agent && schedulerStatus?.activeAgentIds?.includes(agent.id);

  const todayLogs = activityLogs?.filter(log => {
    const logDate = new Date(log.createdAt).toDateString();
    return logDate === new Date().toDateString();
  }) || [];

  const postsToday = todayLogs.filter(log => log.eventType === "post" && log.status === "success").length;
  const repliestoday = todayLogs.filter(log => (log.eventType === "reply" || log.eventType === "mention_reply") && log.status === "success").length;
  const errorsToday = todayLogs.filter(log => log.status === "failed").length;

  const formatTimeAgo = (dateStr: string | Date) => {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusIcon = (status: string) => {
    if (status === "success") return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    if (status === "failed") return <XCircle className="h-3 w-3 text-red-500" />;
    if (status === "rate_limited") return <Clock className="h-3 w-3 text-yellow-500" />;
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };

  const getEventLabel = (eventType: string) => {
    if (eventType === "post") return "Posted tweet";
    if (eventType === "reply" || eventType === "mention_reply") return "Replied to mention";
    if (eventType === "mention_received") return "Received mention";
    if (eventType === "error") return "Error occurred";
    return eventType.replace(/_/g, " ");
  };

  if (agentsLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Create your AI agent to get started</p>
        </div>

        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Welcome to ElizaOS</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Create your Twitter AI agent to start posting automatically
                </p>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-agent">
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Your Agent</DialogTitle>
              <DialogDescription>
                Set up your Twitter AI agent. You can configure the details after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name *</Label>
                <Input
                  id="agent-name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="e.g., Grace Bot"
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
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">{agent.name}</h1>
            <Badge variant={isAgentActive ? "default" : "outline"}>
              {isAgentActive ? "Running" : agent.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">@{agent.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchLogs()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link href={`/agent/${agent.id}/configure`}>
            <Button variant="outline" size="sm" data-testid="button-configure">
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${isAgentActive ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
              <span className="text-lg font-semibold">{isAgentActive ? "Active" : "Inactive"}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {agent.dryRunMode ? "Dry run mode enabled" : "Live posting mode"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posts Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-posts-count">{postsToday}</div>
            <p className="text-xs text-muted-foreground">
              {agent.maxPostsPerDay ? `of ${agent.maxPostsPerDay} max` : "Unlimited"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replies Today</CardTitle>
            <Reply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-replies-count">{repliestoday}</div>
            <p className="text-xs text-muted-foreground">
              {agent.maxRepliesPerHour ? `${agent.maxRepliesPerHour}/hr limit` : "Unlimited"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-errors-count">{errorsToday}</div>
            <p className="text-xs text-muted-foreground">
              {errorsToday === 0 ? "No issues" : "Check activity log"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Health Dashboard */}
      <AgentHealthDashboard agentId={agent.id} />

      {/* Content Diversity Stats */}
      <ContentDiversityStats agentId={agent.id} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent Control</CardTitle>
            <CardDescription>Start, stop, or force a post</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${isAgentActive ? 'bg-green-500' : 'bg-muted'}`} />
                <div>
                  <p className="text-sm font-medium">Scheduler</p>
                  <p className="text-xs text-muted-foreground">
                    {isAgentActive ? "Posting automatically" : "Not running"}
                  </p>
                </div>
              </div>
              {isAgentActive ? (
                <Button
                  variant="outline"
                  onClick={() => stopAgentMutation.mutate(agent.id)}
                  disabled={stopAgentMutation.isPending}
                  data-testid="button-stop-agent"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={() => startAgentMutation.mutate(agent.id)}
                  disabled={startAgentMutation.isPending || !agent.postingEnabled}
                  data-testid="button-start-agent"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Force Generate & Post</p>
                <p className="text-xs text-muted-foreground">
                  Generate and post a tweet immediately
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => forcePostMutation.mutate(agent.id)}
                disabled={forcePostMutation.isPending}
                data-testid="button-force-post"
              >
                <Zap className="h-4 w-4 mr-2" />
                {forcePostMutation.isPending ? "Generating..." : "Force Post"}
              </Button>
            </div>

            {!agent.postingEnabled && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Posting is disabled. Enable it in configuration.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest posts and replies</CardDescription>
            </div>
            {logsLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[350px] overflow-y-auto">
              {activityLogs?.slice(0, 8).map(log => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="mt-1">{getStatusIcon(log.status)}</div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{getEventLabel(log.eventType)}</p>
                      {log.contentType && (
                        <Badge variant="outline" className="text-xs">
                          {log.contentType.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    {log.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{log.content}</p>
                    )}
                    {log.errorMessage && (
                      <p className="text-xs text-red-500">{log.errorMessage}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatTimeAgo(log.createdAt)}</span>
                      {log.status === "success" && (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5">
                            <Heart className="h-3 w-3" />{log.likes || 0}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Repeat2 className="h-3 w-3" />{log.retweets || 0}
                          </span>
                        </div>
                      )}
                      {log.tweetId && (
                        <a
                          href={`https://twitter.com/i/status/${log.tweetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                          data-testid={`link-tweet-${log.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!activityLogs || activityLogs.length === 0) && !logsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No activity yet</p>
                  <p className="text-xs mt-1">Start the agent or force a post to see activity</p>
                </div>
              )}
            </div>
            {activityLogs && activityLogs.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Link href="/activity">
                  <Button variant="ghost" size="sm" className="w-full" data-testid="button-view-all-activity">
                    View All Activity
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
