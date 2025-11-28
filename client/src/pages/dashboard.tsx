import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, MessageSquare, Zap, AlertCircle, Play, Square, RefreshCw, ExternalLink, Clock, CheckCircle2, XCircle, Link } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@shared/schema";

type ActivityLog = {
  id: string;
  agentId: string;
  agentName: string;
  eventType: "post" | "reply" | "mention" | "error" | "scheduled";
  status: "success" | "failed" | "rate_limited" | "pending";
  tweetId?: string;
  content?: string;
  characterCount?: number;
  errorMessage?: string;
  errorCode?: string;
  createdAt: string;
  postedAt?: string;
};

type SchedulerStatus = {
  isRunning: boolean;
  activeAgentCount: number;
  activeAgentIds: string[];
};

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: activityLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs", selectedAgentId],
    queryFn: async () => {
      const url = selectedAgentId 
        ? `/api/activity-logs?agentId=${selectedAgentId}&limit=20`
        : `/api/activity-logs?limit=20`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: schedulerStatus, refetch: refetchScheduler } = useQuery<SchedulerStatus>({
    queryKey: ["/api/scheduler/status"],
    refetchInterval: 5000,
  });

  const startAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest("POST", `/api/agents/${agentId}/scheduler/start`);
      return res.json();
    },
    onSuccess: (data, agentId) => {
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

  const todayLogs = activityLogs?.filter(log => {
    const logDate = new Date(log.createdAt).toDateString();
    return logDate === new Date().toDateString();
  }) || [];

  const postsToday = todayLogs.filter(log => log.eventType === "post" && log.status === "success").length;
  const errorsToday = todayLogs.filter(log => log.status === "failed" || log.status === "rate_limited").length;
  const apiCallsToday = todayLogs.length;

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
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
    if (eventType === "reply") return "Replied to mention";
    if (eventType === "scheduled") return "Scheduled post";
    if (eventType === "error") return "Error occurred";
    return eventType;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitor and control your AI agents</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedAgentId || "all"} onValueChange={(v) => setSelectedAgentId(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[200px]" data-testid="select-agent-filter">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchLogs()} data-testid="button-refresh-logs">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-active-agents">
              {schedulerStatus?.activeAgentCount || 0} / {agents?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {schedulerStatus?.isRunning ? "Scheduler running" : "Scheduler stopped"}
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
            <p className="text-xs text-muted-foreground">Successful tweets posted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Events</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-api-calls">{apiCallsToday}</div>
            <p className="text-xs text-muted-foreground">Today's events</p>
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
              {errorsToday === 0 ? "No issues today" : "Check activity log"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents?.map(agent => {
              const isActive = schedulerStatus?.activeAgentIds?.includes(agent.id);
              return (
                <div key={agent.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-muted'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isActive ? "Running" : "Stopped"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => stopAgentMutation.mutate(agent.id)}
                        disabled={stopAgentMutation.isPending}
                        data-testid={`button-stop-agent-${agent.id}`}
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => startAgentMutation.mutate(agent.id)}
                        disabled={startAgentMutation.isPending || !agent.postingEnabled}
                        data-testid={`button-start-agent-${agent.id}`}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {(!agents || agents.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No agents configured. Create an agent to get started.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Recent Activity</CardTitle>
            {logsLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {activityLogs?.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="mt-1">{getStatusIcon(log.status)}</div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{getEventLabel(log.eventType)}</p>
                      <Badge variant="outline" className="text-xs">{log.agentName}</Badge>
                    </div>
                    {log.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{log.content}</p>
                    )}
                    {log.errorMessage && (
                      <p className="text-xs text-red-500">{log.errorMessage}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTimeAgo(log.createdAt)}</span>
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
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity yet. Start an agent or post a tweet to see activity here.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
