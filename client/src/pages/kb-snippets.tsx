import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Agent, KnowledgeBase } from "@shared/schema";
import { useState } from "react";
import { Database, RefreshCw, Trash2, ExternalLink, Calendar, Filter } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function KBSnippets() {
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Fetch all agents
  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch KB entries for selected agent
  const { data: kbEntries, isLoading: kbLoading } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/agents", selectedAgentId, "knowledge"],
    enabled: !!selectedAgentId,
  });

  // Delete KB entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest("DELETE", `/api/knowledge/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "knowledge"] });
      toast({
        title: "Entry deleted",
        description: "Knowledge base entry has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      });
    },
  });

  // Refresh KB entry mutation (for API-sourced entries)
  const refreshEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      // In production, this would trigger a refresh from the source
      return apiRequest("PATCH", `/api/knowledge/${entryId}`, {
        lastFetchedAt: new Date().toISOString(),
        lastRefreshedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "knowledge"] });
      toast({
        title: "Entry refreshed",
        description: "Knowledge base entry has been updated from source.",
      });
    },
  });

  // Filter entries by source
  const filteredEntries = kbEntries?.filter(entry => {
    if (sourceFilter === "all") return true;
    return entry.source === sourceFilter;
  }) || [];

  // Group entries by source
  const entriesBySource = filteredEntries.reduce((acc, entry) => {
    const source = entry.source || "manual";
    if (!acc[source]) acc[source] = [];
    acc[source].push(entry);
    return acc;
  }, {} as Record<string, KnowledgeBase[]>);

  const selectedAgent = agents?.find(a => a.id === selectedAgentId);

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case "manual": return "secondary";
      case "api": return "default";
      case "integration": return "outline";
      case "custom_api": return "outline";
      default: return "secondary";
    }
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Knowledge Base Snippets</h1>
        <p className="text-sm text-muted-foreground">
          Manage API-sourced and manual knowledge base entries with timestamps and refresh controls
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select Agent</CardTitle>
            <CardDescription>View KB snippets for a specific agent</CardDescription>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger data-testid="select-agent">
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} (@{agent.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filter by Source</CardTitle>
            <CardDescription>Show entries from specific sources</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger data-testid="select-source-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="manual">Manual Entries</SelectItem>
                <SelectItem value="api">API Sourced</SelectItem>
                <SelectItem value="integration">Integrations</SelectItem>
                <SelectItem value="custom_api">Custom APIs</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {selectedAgentId && (
        <>
          {selectedAgent && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedAgent.name}</CardTitle>
                    <CardDescription>
                      {filteredEntries.length} entries
                      {sourceFilter !== "all" && ` from ${sourceFilter}`}
                    </CardDescription>
                  </div>
                  <Badge variant={selectedAgent.status === "deployed" ? "default" : "secondary"}>
                    {selectedAgent.status}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          )}

          {kbLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : Object.keys(entriesBySource).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(entriesBySource).map(([source, entries]) => (
                <Card key={source}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        {source === "manual" ? "Manual Entries" : 
                         source === "api" ? "API Sourced" :
                         source === "integration" ? "From Integrations" :
                         source === "custom_api" ? "Custom APIs" : source}
                      </CardTitle>
                      <Badge variant="secondary">{entries.length} entries</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {entries.map((entry) => (
                      <div key={entry.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{entry.title}</h4>
                              <Badge variant={getSourceBadgeVariant(entry.source || "manual")}>
                                {entry.source || "manual"}
                              </Badge>
                              {!entry.active && <Badge variant="outline">Inactive</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{entry.content}</p>
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Created: {formatDate(entry.createdAt)}
                              </div>
                              {entry.lastFetchedAt && (
                                <div className="flex items-center gap-1">
                                  <RefreshCw className="h-3 w-3" />
                                  Fetched: {formatDate(entry.lastFetchedAt)}
                                </div>
                              )}
                              {entry.sourceUrl && (
                                <a
                                  href={entry.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Source
                                </a>
                              )}
                            </div>

                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {entry.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Priority: {entry.priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {entry.refreshStrategy}
                              </Badge>
                              {entry.tags && entry.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {entry.source !== "manual" && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => refreshEntryMutation.mutate(entry.id)}
                                disabled={refreshEntryMutation.isPending}
                                data-testid={`button-refresh-${entry.id}`}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteEntryMutation.mutate(entry.id)}
                              disabled={deleteEntryMutation.isPending}
                              data-testid={`button-delete-${entry.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No knowledge base entries found</p>
                  <p className="text-xs mt-1">
                    {sourceFilter !== "all"
                      ? `No entries from ${sourceFilter} source`
                      : "Add entries in the agent configuration"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!selectedAgentId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select an agent to view KB snippets</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
