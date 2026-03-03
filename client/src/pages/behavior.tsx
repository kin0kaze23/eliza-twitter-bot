import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agent } from "@shared/schema";
import { BellRing, BrainCircuit, MessageSquareText, Save, Send, Sparkles } from "lucide-react";

type BehaviorForm = {
  systemPrompt: string;
  personalityPrompt: string;
  postStyle: string;
  topics: string;
  adjectives: string;
  postingEnabled: boolean;
  replyEnabled: boolean;
  autoTweetOnNews: boolean;
  maxPostsPerDay: string;
};

const emptyForm: BehaviorForm = {
  systemPrompt: "",
  personalityPrompt: "",
  postStyle: "",
  topics: "",
  adjectives: "",
  postingEnabled: true,
  replyEnabled: true,
  autoTweetOnNews: true,
  maxPostsPerDay: "12",
};

export default function Behavior() {
  const { toast } = useToast();
  const [form, setForm] = useState<BehaviorForm>(emptyForm);

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agent = agents?.[0];

  useEffect(() => {
    if (!agent) {
      return;
    }

    setForm({
      systemPrompt: agent.systemPrompt || "",
      personalityPrompt: agent.personalityPrompt || "",
      postStyle: agent.postStyle || "",
      topics: agent.topics || "",
      adjectives: agent.adjectives || "",
      postingEnabled: agent.postingEnabled ?? true,
      replyEnabled: agent.replyEnabled ?? true,
      autoTweetOnNews: agent.autoTweetOnNews ?? true,
      maxPostsPerDay: String(agent.maxPostsPerDay ?? 12),
    });
  }, [agent]);

  const saveBehavior = useMutation({
    mutationFn: async (data: BehaviorForm) => {
      if (!agent) {
        throw new Error("No agent configured");
      }

      const response = await apiRequest("PATCH", `/api/agents/${agent.id}`, {
        systemPrompt: data.systemPrompt,
        personalityPrompt: data.personalityPrompt,
        postStyle: data.postStyle,
        topics: data.topics,
        adjectives: data.adjectives,
        postingEnabled: data.postingEnabled,
        replyEnabled: data.replyEnabled,
        autoTweetOnNews: data.autoTweetOnNews,
        maxPostsPerDay: Number.parseInt(data.maxPostsPerDay, 10) || 1,
      });

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Behavior updated",
        description: "The agent will use the new behavior settings on the next cycle.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to save behavior",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasChanges = !!agent && (
    form.systemPrompt !== (agent.systemPrompt || "") ||
    form.personalityPrompt !== (agent.personalityPrompt || "") ||
    form.postStyle !== (agent.postStyle || "") ||
    form.topics !== (agent.topics || "") ||
    form.adjectives !== (agent.adjectives || "") ||
    form.postingEnabled !== (agent.postingEnabled ?? true) ||
    form.replyEnabled !== (agent.replyEnabled ?? true) ||
    form.autoTweetOnNews !== (agent.autoTweetOnNews ?? true) ||
    form.maxPostsPerDay !== String(agent.maxPostsPerDay ?? 12)
  );

  const topicCount = form.topics
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Behavior</h1>
          <p className="text-sm text-muted-foreground">No agent configured yet</p>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        saveBehavior.mutate(form);
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-balance" data-testid="text-page-title">
              Behavior
            </h1>
            <Badge variant="secondary" className="tabular-nums">
              {agent.status}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
            Tune voice, cadence, and topic boundaries without digging through the full configuration surface.
          </p>
        </div>
        <Button
          type="submit"
          disabled={saveBehavior.isPending || !hasChanges}
          className="min-w-36"
          data-testid="button-save-behavior"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveBehavior.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Posting</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" />
              {form.postingEnabled ? "Enabled" : "Paused"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Max {form.maxPostsPerDay || "0"} posts per day
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Replies</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="h-4 w-4 text-primary" />
              {form.replyEnabled ? "Responding" : "Muted"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            {form.autoTweetOnNews ? "News-triggered posts active" : "Scheduled posts only"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Coverage</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainCircuit className="h-4 w-4 text-primary" />
              {topicCount} topic lane{topicCount === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Keep topic and adjective lists tight to reduce drift.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Alerts</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="h-4 w-4 text-primary" />
              {agent.webhookEnabled && agent.webhookUrl ? "Webhook live" : "Webhook off"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Detailed alert settings remain in Configure &gt; Webhooks.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Prompt Stack
            </CardTitle>
            <CardDescription>
              Define what the agent should optimize for and how it should sound when it speaks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">System goal</Label>
              <Textarea
                id="system-prompt"
                value={form.systemPrompt}
                onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
                placeholder="Describe the core mission, constraints, and source of truth for the agent."
                className="min-h-40"
                data-testid="textarea-system-prompt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personality-prompt">Personality guardrails</Label>
              <Textarea
                id="personality-prompt"
                value={form.personalityPrompt}
                onChange={(event) => setForm((current) => ({ ...current, personalityPrompt: event.target.value }))}
                placeholder="Define tone, posture, and how the agent should interact with people."
                className="min-h-32"
                data-testid="textarea-personality-prompt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-style">Post style</Label>
              <Textarea
                id="post-style"
                value={form.postStyle}
                onChange={(event) => setForm((current) => ({ ...current, postStyle: event.target.value }))}
                placeholder="Explain the preferred format, pacing, and texture of generated posts."
                className="min-h-28"
                data-testid="textarea-post-style"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Operating Controls</CardTitle>
              <CardDescription>Fast toggles for the live posting loop.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="posting-enabled">Posting enabled</Label>
                  <p className="text-sm text-muted-foreground">Allow scheduled publishing.</p>
                </div>
                <Switch
                  id="posting-enabled"
                  checked={form.postingEnabled}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, postingEnabled: checked }))}
                  data-testid="switch-posting-enabled"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="reply-enabled">Replies enabled</Label>
                  <p className="text-sm text-muted-foreground">Respond when the agent is mentioned.</p>
                </div>
                <Switch
                  id="reply-enabled"
                  checked={form.replyEnabled}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, replyEnabled: checked }))}
                  data-testid="switch-reply-enabled"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="news-enabled">News-triggered posts</Label>
                  <p className="text-sm text-muted-foreground">Allow event-driven posting when monitors fire.</p>
                </div>
                <Switch
                  id="news-enabled"
                  checked={form.autoTweetOnNews}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, autoTweetOnNews: checked }))}
                  data-testid="switch-news-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-posts-per-day">Max posts per day</Label>
                <Input
                  id="max-posts-per-day"
                  type="number"
                  min="1"
                  max="100"
                  value={form.maxPostsPerDay}
                  onChange={(event) => setForm((current) => ({ ...current, maxPostsPerDay: event.target.value }))}
                  data-testid="input-max-posts-per-day"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Topic Boundaries</CardTitle>
              <CardDescription>Comma-separated lists keep the content mix deliberate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="topics">Topics</Label>
                <Textarea
                  id="topics"
                  value={form.topics}
                  onChange={(event) => setForm((current) => ({ ...current, topics: event.target.value }))}
                  placeholder="solana, ai agents, product strategy"
                  className="min-h-28"
                  data-testid="textarea-topics"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjectives">Adjectives</Label>
                <Textarea
                  id="adjectives"
                  value={form.adjectives}
                  onChange={(event) => setForm((current) => ({ ...current, adjectives: event.target.value }))}
                  placeholder="sharp, calm, skeptical, direct"
                  className="min-h-24"
                  data-testid="textarea-adjectives"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
