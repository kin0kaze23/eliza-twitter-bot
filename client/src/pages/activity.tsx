import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MessageSquare,
  AlertCircle,
  Search,
  Filter,
  Eye,
  Bot,
  Zap,
  Heart,
  Repeat2,
  Reply
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ActivityLog, Agent } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Activity() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agent = agents?.[0];

  const { data: activityLogs, isLoading, refetch } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs", agent?.id],
    queryFn: async () => {
      if (!agent) return [];
      const res = await fetch(`/api/activity-logs?agentId=${agent.id}&limit=100`);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    enabled: !!agent,
    refetchInterval: 15000,
  });

  const filteredLogs = activityLogs?.filter(log => {
    if (eventTypeFilter !== "all" && log.eventType !== eventTypeFilter) return false;
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.content?.toLowerCase().includes(query) ||
        log.tweetId?.toLowerCase().includes(query) ||
        log.contentType?.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3" />Success</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
      case "rate_limited":
        return <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-500/40"><Clock className="h-3 w-3" />Rate Limited</Badge>;
      case "skipped":
        return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />Skipped</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "post":
        return <MessageSquare className="h-4 w-4 text-primary" />;
      case "reply":
      case "mention_reply":
        return <Reply className="h-4 w-4 text-blue-500" />;
      case "mention_received":
        return <Bot className="h-4 w-4 text-purple-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "scheduler_start":
      case "scheduler_stop":
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return "-";
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    return date.toLocaleString();
  };

  const formatContentType = (type: string | null) => {
    if (!type) return null;
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!agent) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">No agent configured yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive monitoring for {agent.name}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">Filter & Search</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search content, tweet ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                  data-testid="input-search"
                />
              </div>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-event-type">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="post">Posts</SelectItem>
                  <SelectItem value="reply">Replies</SelectItem>
                  <SelectItem value="mention_received">Mentions</SelectItem>
                  <SelectItem value="mention_reply">Mention Replies</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="rate_limited">Rate Limited</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No activity logs found</p>
              <p className="text-sm mt-1">Activity will appear here once the agent starts posting</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="w-[120px]">Content Type</TableHead>
                    <TableHead className="w-[100px]">Model</TableHead>
                    <TableHead className="w-[80px]">Tokens</TableHead>
                    <TableHead className="w-[100px]">Engagement</TableHead>
                    <TableHead className="w-[150px]">Time</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-activity-${log.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEventIcon(log.eventType)}
                          <span className="text-xs capitalize">{log.eventType.replace(/_/g, " ")}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm truncate" title={log.content}>
                          {log.content}
                        </p>
                        {log.errorMessage && (
                          <p className="text-xs text-red-500 truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.contentType ? (
                          <Badge variant="outline" className="text-xs">
                            {formatContentType(log.contentType)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">
                          {log.modelName ? log.modelName.slice(0, 12) : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">
                          {log.tokensUsed || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Heart className="h-3 w-3" />{log.likes || 0}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Repeat2 className="h-3 w-3" />{log.retweets || 0}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Reply className="h-3 w-3" />{log.replies || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.postedAt || log.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedLog(log)}
                            data-testid={`button-view-${log.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {log.tweetId && (
                            <a
                              href={`https://twitter.com/i/status/${log.tweetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && getEventIcon(selectedLog.eventType)}
              Activity Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Event Type</p>
                  <p className="capitalize">{selectedLog.eventType.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  {getStatusBadge(selectedLog.status)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Content Type</p>
                  <p>{formatContentType(selectedLog.contentType) || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Bible Verse</p>
                  <p>{selectedLog.bibleVerse || "-"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Content</p>
                <div className="p-3 rounded-md bg-muted text-sm whitespace-pre-wrap">
                  {selectedLog.content}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Model</p>
                  <p className="text-sm font-mono">{selectedLog.modelProvider}/{selectedLog.modelName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tokens Used</p>
                  <p className="text-sm">{selectedLog.tokensUsed || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Generation Time</p>
                  <p className="text-sm">{selectedLog.generationTimeMs ? `${selectedLog.generationTimeMs}ms` : "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Likes</p>
                  <p className="flex items-center gap-1"><Heart className="h-4 w-4" />{selectedLog.likes || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Retweets</p>
                  <p className="flex items-center gap-1"><Repeat2 className="h-4 w-4" />{selectedLog.retweets || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Replies</p>
                  <p className="flex items-center gap-1"><Reply className="h-4 w-4" />{selectedLog.replies || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Impressions</p>
                  <p>{selectedLog.impressions || 0}</p>
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <p className="text-sm font-medium text-red-500 mb-2">Error Details</p>
                  <div className="p-3 rounded-md bg-red-500/10 text-sm text-red-600">
                    <p><strong>Code:</strong> {selectedLog.errorCode || "N/A"}</p>
                    <p><strong>Message:</strong> {selectedLog.errorMessage}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tweet ID</p>
                  <p className="font-mono">{selectedLog.tweetId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trigger Type</p>
                  <p className="capitalize">{selectedLog.triggerType || "scheduled"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created At</p>
                  <p>{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Posted At</p>
                  <p>{formatDate(selectedLog.postedAt)}</p>
                </div>
              </div>

              {selectedLog.tweetId && (
                <div className="pt-4 border-t">
                  <a
                    href={`https://twitter.com/i/status/${selectedLog.tweetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Twitter
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
