import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, AlertCircle, CheckCircle2, XCircle, Eye, EyeOff, Play, Plus, Trash2, PlayCircle, RefreshCw, Settings, Zap, Pencil, Star, Info, Sparkles, BookOpen, MessageSquare, Thermometer, Hash, Database, Layers, Twitter, ChevronDown, Cookie, Download, Radio, Book } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Agent, KnowledgeBase, MessageExample, MessageExamples } from "@shared/schema";
import { CONTENT_TYPES } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type KBEntry = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  priority: string; // high, medium, low
  active: boolean;
  refreshStrategy: string;
};

type CustomPrompt = {
  id: string;
  key: string;
  value: string;
};

export default function AgentConfigure() {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Check for route param
  const [match, params] = useRoute("/agent/:id/configure");
  const routeId = match ? params?.id : null;

  // Fetch all agents
  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agent = routeId
    ? agents?.find(a => a.id === routeId)
    : agents?.[0];

  const id = agent?.id;
  const isLoading = agentsLoading;
  const noAgentExists = !agent && !agentsLoading;

  // Fetch agent status (for monitoring)
  const { data: agentStatus } = useQuery({
    queryKey: ["/api/agents", id, "status"],
    enabled: !!id,
    refetchInterval: 5000, // Refresh status every 5s to see new scrapes
  });

  // Fetch knowledge base
  const { data: kbData } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/agents", id, "knowledge"],
    enabled: !!id,
  });

  // Fetch pending KB entries (for review)
  const { data: pendingKB = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/agents", id, "knowledge/pending"],
    enabled: !!id,
  });

  // Fetch approved KB entries
  // Fetch all KB entries for the agent
  const { data: kbEntries = [], refetch: refetchKB } = useQuery({
    queryKey: [`/api/agents/${id}/knowledge`],
    queryFn: async () => {
      const res = await apiRequest.get(`/api/agents/${id}/knowledge`);
      return res.json();
    },
    enabled: !!id,
  });

  // Fetch custom APIs for KB refresh controls
  const { data: customApis = [] } = useQuery<any[]>({
    queryKey: ["/api/custom-apis"],
  });

  // KB batch operations state
  const [selectedKBIds, setSelectedKBIds] = useState<Set<string>>(new Set());

  // Twitter API Credentials
  const [twitterConfig, setTwitterConfig] = useState({
    apiKey: "",
    apiKeySecret: "",
    accessToken: "",
    accessTokenSecret: "",
    bearerToken: "",
    appId: "",
    oauthClientId: "",
    oauthClientSecret: "",
    // Scraper credentials (cookie-based auth, bypasses API limitations)
    username: "",
    password: "",
    email: "",
    twoFactorSecret: "",
    // Browser cookies (most reliable method)
    cookies: "",
  });

  const [twitterTestResult, setTwitterTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    hint?: string;
    user?: any;
    api?: { success: boolean; message?: string; error?: string; user?: any; capabilities?: string[] };
    scraper?: { success: boolean; message?: string; error?: string; username?: string; capabilities?: string[] };
    recommendation?: string;
    summary?: { canPost: boolean; canDetectMentions: boolean; canDetectComments: boolean; preferredPostMethod: string };
  } | null>(null);
  const [modelTestResult, setModelTestResult] = useState<{ success: boolean; provider?: string; modelCount?: number; latestModel?: string; models?: any[]; error?: string; hint?: string; note?: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [availablePostModels, setAvailablePostModels] = useState<any[]>([]);
  const [availableConversationModels, setAvailableConversationModels] = useState<any[]>([]);

  // Twitter API Test Mutation - sends current form values to test without requiring save first
  const testTwitter = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agents/${id}/test/twitter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twitterApiKey: twitterConfig.apiKey,
          twitterApiSecret: twitterConfig.apiKeySecret,
          twitterAccessToken: twitterConfig.accessToken,
          twitterAccessSecret: twitterConfig.accessTokenSecret,
          twitterUsername: twitterConfig.username,
          twitterPassword: twitterConfig.password,
          twitterEmail: twitterConfig.email,
          twitter2faSecret: twitterConfig.twoFactorSecret,
          twitterCookies: twitterConfig.cookies,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setTwitterTestResult(data);
      const apiOk = data.api?.success;
      const scraperOk = data.scraper?.success;
      const username = data.api?.user?.username || data.scraper?.username;

      toast({
        title: data.success ? "Connection Test Complete" : "Connection Issues",
        description: username
          ? `Connected as @${username}`
          : data.recommendation || data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      const errorData = error.message ? JSON.parse(error.message) : error;
      setTwitterTestResult(errorData);
      toast({
        title: "Twitter API Test Failed",
        description: errorData.hint || errorData.error || "Failed to test Twitter credentials",
        variant: "destructive",
      });
    },
  });

  // AI Model API Test Mutation (Default Model)
  const testModel = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agents/${id}/test/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: modelConfig.provider,
          apiKey: modelConfig.apiKey,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setModelTestResult(data);
      setAvailableModels(data.models || []);
      toast({
        title: "Success!",
        description: `Found ${data.modelCount} ${data.provider} models. Latest: ${data.latestModel}`,
      });
    },
    onError: (error: any) => {
      const errorData = error.message ? JSON.parse(error.message) : error;
      setModelTestResult(errorData);
      setAvailableModels([]);
      toast({
        title: "Model API Test Failed",
        description: errorData.hint || errorData.error || "Failed to test model API key",
        variant: "destructive",
      });
    },
  });

  // Test models for post generation
  const testPostModels = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agents/${id}/test/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: postModelConfig.provider,
          apiKey: modelConfig.apiKey,
        }),
      });
      if (!response.ok) throw new Error("Failed to load models");
      return response.json();
    },
    onSuccess: (data: any) => {
      setAvailablePostModels(data.models || []);
      toast({ title: "Post models loaded", description: `Found ${data.modelCount} models` });
    },
    onError: () => {
      setAvailablePostModels([]);
      toast({ title: "Failed to load models", variant: "destructive" });
    },
  });

  // Test models for conversation
  const testConversationModels = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agents/${id}/test/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: conversationModelConfig.provider,
          apiKey: modelConfig.apiKey,
        }),
      });
      if (!response.ok) throw new Error("Failed to load models");
      return response.json();
    },
    onSuccess: (data: any) => {
      setAvailableConversationModels(data.models || []);
      toast({ title: "Conversation models loaded", description: `Found ${data.modelCount} models` });
    },
    onError: () => {
      setAvailableConversationModels([]);
      toast({ title: "Failed to load models", variant: "destructive" });
    },
  });

  // Character & Prompts (Combined)
  const [character, setCharacter] = useState<{
    name: string;
    username: string;
    bio: string;
    systemPrompt: string;
    personalityPrompt: string;
    messageExamples: MessageExamples;
    postExamples: string[];
    lore: string;
    chatStyle: string;
    styleAll: string;
    postStyle: string;
    topics: string;
    adjectives: string;
  }>({
    name: "CryptoAnalyst",
    username: "@cryptoanalyst_ai",
    bio: "Cryptocurrency analyst powered by AI. Providing data-driven insights on Bitcoin, Ethereum, and DeFi. Not financial advice. DYOR.",
    lore: "",
    systemPrompt: "You are an AI agent with expertise in cryptocurrency markets, blockchain technology, and DeFi. Provide accurate, timely insights based on current market data and news. Always maintain a helpful and professional demeanor.",
    personalityPrompt: "Personality: Knowledgeable, analytical, enthusiastic about innovation. Tone: Professional yet conversational. Style: Clear, concise, data-driven insights with occasional wit.",
    messageExamples: [
      "🚀 Bitcoin breaking above $45k resistance! On-chain metrics showing strong accumulation. This could be the start of the next leg up. #BTC",
      "Interesting DeFi development: New L2 protocol launching with novel liquidity mechanism. Early data looks promising. Will monitor closely.",
    ],
    postExamples: [],
    postStyle: "Mix of analysis, insights, and commentary with data-driven observations",
    chatStyle: "",
    styleAll: "",
    topics: "Cryptocurrency, DeFi, NFTs, Blockchain Technology, Market Analysis, Trading",
    adjectives: "analytical, insightful, timely, professional, innovative",
  });

  // Helper functions for message examples (support both string and object formats)
  const getExampleContent = (example: string | MessageExample): string => {
    return typeof example === "string" ? example : example.content;
  };

  const getExampleContentType = (example: string | MessageExample): string | undefined => {
    return typeof example === "object" ? example.contentType : undefined;
  };

  const formatContentType = (type: string): string => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  // Custom Prompts (Additional specialized instructions)
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([
    {
      id: "1",
      key: "evaluation",
      value: "Before finalizing output, rewrite to ensure clarity, accuracy, and professionalism. Remove any uncertain or speculative language unless explicitly discussing probabilities.",
    },
    {
      id: "2",
      key: "market_mode",
      value: "If BTC 24h change > 3%, emphasize the significance and provide context. If change > 5%, create a thread analyzing the movement with on-chain data and market sentiment.",
    },
    {
      id: "3",
      key: "tone_mod",
      value: "Always speak with a hopeful yet cautious tone. Be optimistic about innovation while warning about risks. Use wisdom from past market cycles.",
    },
  ]);
  const [isAddCustomPromptOpen, setIsAddCustomPromptOpen] = useState(false);
  const [newCustomPrompt, setNewCustomPrompt] = useState({ key: "", value: "" });

  // Model Configuration (default/fallback)
  const [modelConfig, setModelConfig] = useState({
    provider: "openai",
    model: "gpt-4-turbo-preview",
    apiKey: "",
    temperature: [0.7],
    maxTokens: [500],
    topP: [0.9],
    frequencyPenalty: [0.5],
    presencePenalty: [0.5],
    contextWindow: "8000",
  });

  // Post generation specific model
  const [postModelConfig, setPostModelConfig] = useState({
    provider: "",
    model: "",
    temperature: [0.7],
    maxTokens: [280],
  });

  // Conversation specific model
  const [conversationModelConfig, setConversationModelConfig] = useState({
    provider: "",
    model: "",
    temperature: [0.7],
    maxTokens: [500],
  });

  // Behavior Configuration (Combined posting, replies, modules)
  const [behavior, setBehavior] = useState({
    // Posting
    postingEnabled: true,
    postFrequency: "2",
    postInterval: "hours",
    maxPostsPerDay: "12",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    timezone: "UTC",

    // Replies
    replyEnabled: true,
    replyRate: [70],
    replyDelay: [30],
    maxRepliesPerHour: "10",
    onlyVerified: false,
    replyKeywords: "bitcoin, crypto, defi, blockchain",
    ignoreKeywords: "spam, scam, airdrop",



    // Triggers
    priceChangeThreshold: [5],
    volumeChangeThreshold: [50],
    autoTweetOnNews: true,
    minNewsSentiment: [0.6],

    // Bible Verse Tracking
    verseTrackingEnabled: true,
    verseReusePolicy: "avoid_recent",
    verseReuseWindow: "10",

    // Content Type Tracking
    contentTypeTrackingEnabled: true,
    contentTypeReusePolicy: "rotate_all",
    contentTypeWindow: "7",

  });

  // Knowledge Base Settings
  const [kbSettings, setKbSettings] = useState({
    maxEntries: "10",
    reusePolicy: "deprioritize", // never, deprioritize, allow
    reuseCooldownHours: "24",
    autoRefreshEnabled: false,
    autoRefreshIntervalHours: "6",
  });

  // News Monitor Settings
  const [monitoringSettings, setMonitoringSettings] = useState({
    enabled: true,
    targets: "DegenerateNews,Cointelegraph,TheInsiderPaper,FirstSquawk",
    interval: "4"
  });

  // Webhook Settings
  const [webhookSettings, setWebhookSettings] = useState({
    enabled: false,
    url: "",
    secret: "",
    events: ["post_created", "post_failed", "error"] as string[],
  });
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // Knowledge Base (Per-Agent)
  const [knowledgeBase, setKnowledgeBase] = useState<KBEntry[]>([]);
  const [isAddKBDialogOpen, setIsAddKBDialogOpen] = useState(false);
  const [isEditKBDialogOpen, setIsEditKBDialogOpen] = useState(false);
  const [editingKBEntry, setEditingKBEntry] = useState<KnowledgeBase | null>(null);
  const [newKBEntry, setNewKBEntry] = useState({
    title: "",
    content: "",
    tags: "",
    category: "general",
    priority: "medium" as "high" | "medium" | "low",
    active: true,
    refreshStrategy: "static",
  });

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskSecret = (secret: string) => {
    if (!secret) return "";
    if (secret.length <= 8) return "•".repeat(secret.length);
    return secret.substring(0, 8) + "•".repeat(Math.max(12, secret.length - 8));
  };

  // Knowledge base mutations
  const addKBMutation = useMutation({
    mutationFn: async (entry: { title: string; content: string; tags: string[]; category: string; priority: string; active: boolean; refreshStrategy: string }) => {
      return apiRequest("POST", `/api/agents/${id}/knowledge`, {
        title: entry.title,
        content: entry.content,
        tags: entry.tags,
        category: entry.category,
        priority: entry.priority,
        active: entry.active,
        refreshStrategy: entry.refreshStrategy,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      setNewKBEntry({
        title: "",
        content: "",
        tags: "",
        category: "general",
        priority: "medium",
        active: true,
        refreshStrategy: "static",
      });
      setIsAddKBDialogOpen(false);
      toast({
        title: "Knowledge entry added",
        description: "Entry has been added to this agent's knowledge base.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add knowledge entry",
        variant: "destructive",
      });
    },
  });

  const deleteKBMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest("DELETE", `/api/knowledge/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      toast({ title: "Knowledge entry deleted" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete knowledge entry",
        variant: "destructive",
      });
    },
  });

  const updateKBMutation = useMutation({
    mutationFn: async ({ entryId, data }: { entryId: string; data: any }) => {
      return apiRequest("PATCH", `/api/knowledge/${entryId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/pending"] });
      setIsEditKBDialogOpen(false);
      setEditingKBEntry(null);
      toast({ title: "Knowledge entry updated" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update knowledge entry",
        variant: "destructive",
      });
    },
  });

  // Batch approve KB entries
  const batchApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", `/api/agents/${id}/knowledge/batch/approve`, { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      setSelectedKBIds(new Set());
      toast({
        title: "Approved!",
        description: data.message || `Approved ${data.approvedCount} entries`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve entries",
        variant: "destructive",
      });
    },
  });

  // Batch archive KB entries
  const batchArchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", `/api/agents/${id}/knowledge/batch/archive`, { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      setSelectedKBIds(new Set());
      toast({
        title: "Archived!",
        description: data.message || `Archived ${data.archivedCount} entries`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive entries",
        variant: "destructive",
      });
    },
  });

  const handleAddKBEntry = () => {
    if (!newKBEntry.title || !newKBEntry.content) return;

    const tags = newKBEntry.tags.split(",").map(t => t.trim()).filter(Boolean);
    addKBMutation.mutate({
      title: newKBEntry.title,
      content: newKBEntry.content,
      tags,
      category: newKBEntry.category,
      priority: newKBEntry.priority,
      active: newKBEntry.active,
      refreshStrategy: newKBEntry.refreshStrategy,
    });
  };

  const handleDeleteKBEntry = (entryId: string) => {
    deleteKBMutation.mutate(entryId);
  };

  // KB batch operation handlers
  const handleToggleKBSelection = (id: string) => {
    const newSelection = new Set(selectedKBIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedKBIds(newSelection);
  };

  const handleSelectAllKB = (entries: KnowledgeBase[]) => {
    if (selectedKBIds.size === entries.length) {
      setSelectedKBIds(new Set());
    } else {
      setSelectedKBIds(new Set(entries.map(e => e.id)));
    }
  };

  const handleBatchApprove = () => {
    if (selectedKBIds.size === 0) return;
    batchApproveMutation.mutate(Array.from(selectedKBIds));
  };

  const handleRefreshNews = async () => {
    if (!id || !agent?.monitoringEnabled) return;

    toast({
      title: "Refreshing News",
      description: "Starting manual news scrape. This may take a few seconds...",
    });

    try {
      const response = await fetch(`/api/agents/${id}/news/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();

      if (response.ok) {
        toast({
          title: "News Refreshed",
          description: data.message,
        });
        // Refresh status to see new context
        queryClient.invalidateQueries({ queryKey: [`/api/agents/${id}/status`] });
      } else {
        toast({
          title: "Refresh Failed",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reach server",
        variant: "destructive"
      });
    }
  };

  const handleFetchStatus = async () => {
    // This function was empty in the provided snippet, assuming it's a placeholder or needs content.
    // Based on the context, it might be intended to fetch agent status.
    // For now, keeping it as is from the user's instruction.
    if (selectedKBIds.size === 0) return; // This line seems misplaced if it's a generic fetch status.
    batchApproveMutation.mutate(Array.from(selectedKBIds)); // This line also seems misplaced for a generic fetch status.
  };

  const handleBatchArchive = () => {
    if (selectedKBIds.size === 0) return;
    batchArchiveMutation.mutate(Array.from(selectedKBIds));
  };

  // Batch deactivate KB entries (active tab)
  const batchDeactivateMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", `/api/agents/${id}/knowledge/batch/deactivate`, { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      setSelectedKBIds(new Set());
      toast({
        title: "Deactivated!",
        description: data.message || `Deactivated ${data.deactivatedCount} entries`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to deactivate entries",
        variant: "destructive",
      });
    },
  });

  // Batch delete KB entries (active tab)
  const batchDeleteActiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", `/api/agents/${id}/knowledge/batch/delete`, { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      setSelectedKBIds(new Set());
      toast({
        title: "Deleted!",
        description: data.message || `Deleted ${data.deletedCount} entries`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete entries",
        variant: "destructive",
      });
    },
  });

  // Update KB entry priority with feedback tracking
  const updatePriorityMutation = useMutation({
    mutationFn: async ({ entryId, priority }: { entryId: string; priority: string }) => {
      return apiRequest("PATCH", `/api/knowledge/${entryId}/priority`, { priority });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      toast({
        title: "Priority Updated",
        description: data.originalPriority
          ? `Changed from ${data.originalPriority} to ${data.priority} - this helps the AI learn your preferences!`
          : `Priority set to ${data.priority}`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update priority",
        variant: "destructive",
      });
    },
  });

  const handleBatchDeactivateKB = () => {
    if (selectedKBIds.size === 0) return;
    batchDeactivateMutation.mutate(Array.from(selectedKBIds));
  };

  const handleBatchDeleteActive = () => {
    if (selectedKBIds.size === 0) return;
    batchDeleteActiveMutation.mutate(Array.from(selectedKBIds));
  };

  const handleAddCustomPrompt = () => {
    if (!newCustomPrompt.key || !newCustomPrompt.value) return;

    const prompt: CustomPrompt = {
      id: Date.now().toString(),
      key: newCustomPrompt.key,
      value: newCustomPrompt.value,
    };

    setCustomPrompts([...customPrompts, prompt]);
    setNewCustomPrompt({ key: "", value: "" });
    setIsAddCustomPromptOpen(false);

    toast({
      title: "Custom prompt added",
      description: "Additional prompt instruction has been added to this agent.",
    });
  };

  const handleDeleteCustomPrompt = (id: string) => {
    setCustomPrompts(customPrompts.filter(p => p.id !== id));
    toast({ title: "Custom prompt deleted" });
  };

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async () => {
      const customPromptsObj = customPrompts.reduce((acc, prompt) => {
        acc[prompt.key] = prompt.value;
        return acc;
      }, {} as Record<string, string>);

      return apiRequest("PATCH", `/api/agents/${id}`, {
        // Twitter API (OAuth 1.0a)
        twitterApiKey: twitterConfig.apiKey,
        twitterApiSecret: twitterConfig.apiKeySecret,
        twitterAccessToken: twitterConfig.accessToken,
        twitterAccessSecret: twitterConfig.accessTokenSecret,
        twitterBearerToken: twitterConfig.bearerToken,
        twitterAppId: twitterConfig.appId,
        // Twitter API (OAuth 2.0)
        twitterOAuthClientId: twitterConfig.oauthClientId,
        twitterOAuthClientSecret: twitterConfig.oauthClientSecret,
        // Twitter Scraper Credentials (cookie-based auth for mention detection)
        twitterUsername: twitterConfig.username,
        twitterPassword: twitterConfig.password,
        twitterEmail: twitterConfig.email,
        twitter2faSecret: twitterConfig.twoFactorSecret,
        twitterCookies: twitterConfig.cookies,
        // Character
        name: character.name,
        username: character.username,
        bio: character.bio,
        systemPrompt: character.systemPrompt,
        personalityPrompt: character.personalityPrompt,
        lore: character.lore,
        postStyle: character.postStyle,
        chatStyle: character.chatStyle,
        styleAll: character.styleAll,
        topics: character.topics,
        adjectives: character.adjectives,
        messageExamples: character.messageExamples,
        postExamples: character.postExamples,
        customPrompts: customPromptsObj,
        // Model (default)
        modelProvider: modelConfig.provider,
        modelName: modelConfig.model,
        modelApiKey: modelConfig.apiKey,
        temperature: modelConfig.temperature[0],
        maxTokens: modelConfig.maxTokens[0],
        topP: modelConfig.topP[0],
        frequencyPenalty: modelConfig.frequencyPenalty[0],
        presencePenalty: modelConfig.presencePenalty[0],
        contextWindow: parseInt(modelConfig.contextWindow),
        // Post specific model
        postModelProvider: postModelConfig.provider || undefined,
        postModelName: postModelConfig.model || undefined,
        postTemperature: postModelConfig.temperature[0] || undefined,
        postMaxTokens: postModelConfig.maxTokens[0] || undefined,
        // Conversation specific model
        conversationModelProvider: conversationModelConfig.provider || undefined,
        conversationModelName: conversationModelConfig.model || undefined,
        conversationTemperature: conversationModelConfig.temperature[0] || undefined,
        conversationMaxTokens: conversationModelConfig.maxTokens[0] || undefined,
        // Behavior
        postingEnabled: behavior.postingEnabled,
        postFrequency: parseInt(behavior.postFrequency),
        postInterval: behavior.postInterval,
        maxPostsPerDay: parseInt(behavior.maxPostsPerDay),
        quietHoursEnabled: behavior.quietHoursEnabled,
        quietHoursStart: behavior.quietHoursStart,
        quietHoursEnd: behavior.quietHoursEnd,
        timezone: behavior.timezone,
        replyEnabled: behavior.replyEnabled,
        replyRate: behavior.replyRate[0],
        replyDelay: behavior.replyDelay[0],
        maxRepliesPerHour: parseInt(behavior.maxRepliesPerHour),
        onlyReplyVerified: behavior.onlyVerified,
        replyKeywords: behavior.replyKeywords,
        ignoreKeywords: behavior.ignoreKeywords,

        // Bible Verse Tracking
        verseTrackingEnabled: behavior.verseTrackingEnabled,
        verseReusePolicy: behavior.verseReusePolicy,
        verseReuseWindow: parseInt(behavior.verseReuseWindow) || 10,
        // Content Type Tracking
        contentTypeTrackingEnabled: behavior.contentTypeTrackingEnabled,
        contentTypeReusePolicy: behavior.contentTypeReusePolicy,
        contentTypeWindow: parseInt(behavior.contentTypeWindow) || 7,

        // Knowledge Base Settings
        kbMaxEntries: parseInt(kbSettings.maxEntries) || 10,
        kbReusePolicy: kbSettings.reusePolicy,
        kbReuseCooldownHours: parseInt(kbSettings.reuseCooldownHours) || 24,
        kbAutoRefreshEnabled: kbSettings.autoRefreshEnabled,
        kbAutoRefreshIntervalHours: parseInt(kbSettings.autoRefreshIntervalHours) || 6,
        // Webhook Settings
        webhookEnabled: webhookSettings.enabled,
        webhookUrl: webhookSettings.url || undefined,
        webhookSecret: webhookSettings.secret || undefined,
        webhookEvents: webhookSettings.events,
        // News Monitor
        monitoringEnabled: monitoringSettings.enabled,
        monitoringTargets: monitoringSettings.targets,
        monitoringIntervalHours: parseInt(monitoringSettings.interval) || 4,
      });
    },
    onSuccess: () => {
      // Invalidate both the full agents list and specific agent queries
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id] });
      toast({
        title: "Configuration saved",
        description: "All agent settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  // Force generate tweet mutation
  const forceGenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/playground/test-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: id,
        }),
      });
      if (!response.ok) throw new Error("Failed to generate tweet");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Tweet Generated Successfully",
        description: data.tweet ? `${data.tweet.substring(0, 100)}...` : "Tweet generated from KB",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate tweet. Check your agent configuration and KB entries.",
        variant: "destructive",
      });
    },
  });

  const handleForceGenerateTweet = () => {
    forceGenerateMutation.mutate();
  };

  // KB refresh mutation
  const [refreshingApiId, setRefreshingApiId] = useState<string | null>(null);
  const refreshKBMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/approved"] });
      toast({
        title: "KB Refreshed Successfully",
        description: `Removed ${data.removed} old entries, added ${data.added} new (${data.autoApproved} auto-approved)`,
      });
      setRefreshingApiId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh KB data",
        variant: "destructive",
      });
      setRefreshingApiId(null);
    },
  });

  const handleRefreshAPI = (apiId: string) => {
    if (!id) return;
    setRefreshingApiId(apiId);
    refreshKBMutation.mutate({ apiId, agentId: id });
  };

  // Load agent data into state when fetched
  useEffect(() => {
    if (!agent) return;

    // Load Twitter config
    setTwitterConfig({
      apiKey: agent.twitterApiKey || "",
      apiKeySecret: agent.twitterApiSecret || "",
      accessToken: agent.twitterAccessToken || "",
      accessTokenSecret: agent.twitterAccessSecret || "",
      bearerToken: agent.twitterBearerToken || "",
      appId: agent.twitterAppId || "",
      oauthClientId: agent.twitterOAuthClientId || "",
      oauthClientSecret: agent.twitterOAuthClientSecret || "",
      // Scraper credentials
      username: agent.twitterUsername || "",
      password: agent.twitterPassword || "",
      email: agent.twitterEmail || "",
      twoFactorSecret: agent.twitter2faSecret || "",
      cookies: agent.twitterCookies || "",
    });

    // Load character
    setCharacter({
      name: agent.name || "",
      username: agent.username || "",
      bio: agent.bio || "",
      lore: agent.lore || "",
      systemPrompt: agent.systemPrompt || "",
      personalityPrompt: agent.personalityPrompt || "",
      postStyle: agent.postStyle || "",
      chatStyle: agent.chatStyle || "",
      styleAll: agent.styleAll || "",
      topics: agent.topics || "",
      adjectives: agent.adjectives || "",
      messageExamples: agent.messageExamples || [],
      postExamples: agent.postExamples || [],
    });

    // Load custom prompts
    if (agent.customPrompts && typeof agent.customPrompts === "object") {
      const prompts = Object.entries(agent.customPrompts).map(([key, value], idx) => ({
        id: `${idx}`,
        key,
        value: value as string,
      }));
      setCustomPrompts(prompts);
    }

    // Load model config
    setModelConfig({
      provider: agent.modelProvider || "openai",
      model: agent.modelName || "gpt-4-turbo-preview",
      apiKey: agent.modelApiKey || "",
      temperature: [typeof agent.temperature === 'number' ? agent.temperature : 0.7],
      maxTokens: [agent.maxTokens || 500],
      topP: [typeof agent.topP === 'number' ? agent.topP : 0.9],
      frequencyPenalty: [typeof agent.frequencyPenalty === 'number' ? agent.frequencyPenalty : 0.5],
      presencePenalty: [typeof agent.presencePenalty === 'number' ? agent.presencePenalty : 0.5],
      contextWindow: (agent.contextWindow || 8000).toString(),
    });

    // Load post-specific model config
    setPostModelConfig({
      provider: agent.postModelProvider || "",
      model: agent.postModelName || "",
      temperature: [typeof agent.postTemperature === 'number' ? agent.postTemperature : 0.7],
      maxTokens: [agent.postMaxTokens || 280],
    });

    // Load conversation-specific model config
    setConversationModelConfig({
      provider: agent.conversationModelProvider || "",
      model: agent.conversationModelName || "",
      temperature: [typeof agent.conversationTemperature === 'number' ? agent.conversationTemperature : 0.7],
      maxTokens: [agent.conversationMaxTokens || 500],
    });

    // Load behavior
    setBehavior({
      postingEnabled: agent.postingEnabled ?? true,
      postFrequency: (agent.postFrequency || 2).toString(),
      postInterval: agent.postInterval || "hours",
      maxPostsPerDay: (agent.maxPostsPerDay || 12).toString(),
      quietHoursEnabled: agent.quietHoursEnabled ?? false,
      quietHoursStart: agent.quietHoursStart || "22:00",
      quietHoursEnd: agent.quietHoursEnd || "08:00",
      timezone: agent.timezone || "UTC",
      replyEnabled: agent.replyEnabled ?? true,
      replyRate: [agent.replyRate || 70],
      replyDelay: [agent.replyDelay || 30],
      maxRepliesPerHour: (agent.maxRepliesPerHour || 10).toString(),
      onlyVerified: agent.onlyReplyVerified ?? false,
      replyKeywords: agent.replyKeywords || "",
      ignoreKeywords: agent.ignoreKeywords || "",

    });

    // Load KB settings
    setKbSettings({
      maxEntries: (agent.kbMaxEntries || 10).toString(),
      reusePolicy: agent.kbReusePolicy || "deprioritize",
      reuseCooldownHours: (agent.kbReuseCooldownHours || 24).toString(),
      autoRefreshEnabled: agent.kbAutoRefreshEnabled || false,
      autoRefreshIntervalHours: (agent.kbAutoRefreshIntervalHours || 6).toString(),
    });

    // Load webhook settings
    setWebhookSettings({
      enabled: agent.webhookEnabled ?? false,
      url: agent.webhookUrl || "",
      secret: agent.webhookSecret || "",
      events: agent.webhookEvents || ["post_created", "post_failed", "error"],
    });
  }, [agent]);

  // Sync knowledge base from backend data
  useEffect(() => {
    if (!kbData) {
      setKnowledgeBase([]);
      return;
    }
    const entries: KBEntry[] = kbData.map(kb => ({
      id: kb.id,
      title: kb.title,
      content: kb.content,
      tags: kb.tags || [],
      category: kb.category || "general",
      priority: kb.priority || "medium",
      active: kb.active ?? true,
      refreshStrategy: kb.refreshStrategy || "static",
    }));
    setKnowledgeBase(entries);
  }, [kbData]);

  const handleSave = () => {
    updateAgentMutation.mutate();
  };

  // Validation
  // Only check OAuth 1.0a required fields (OAuth 2.0 fields are optional)
  const twitterComplete = Boolean(
    twitterConfig.apiKey &&
    twitterConfig.apiKeySecret &&
    twitterConfig.accessToken &&
    twitterConfig.accessTokenSecret &&
    twitterConfig.bearerToken &&
    twitterConfig.appId
  );
  const modelComplete = modelConfig.apiKey !== "";
  const characterComplete = character.name && character.username && character.systemPrompt;
  const isConfigurationComplete = twitterComplete && modelComplete && characterComplete;

  const handleExport = () => {
    if (!id) return;
    window.location.href = `/api/agents/${id}/export`;
    toast({
      title: "Exporting...",
      description: "Character manifest download started.",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (noAgentExists || !agent) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Configure</h1>
          <p className="text-sm text-muted-foreground">Create your agent first to configure it</p>
        </div>
        <Card className="max-w-lg">
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Settings className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No Agent to Configure</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Create your Twitter AI agent from the Dashboard first
                </p>
              </div>
              <Link href="/">
                <Button data-testid="button-go-to-dashboard">
                  Go to Dashboard
                </Button>
              </Link>
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
            Configure: {character.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete configuration for this agent
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/playground">
            <Button variant="outline" data-testid="button-test-config">
              <Play className="mr-2 h-4 w-4" />
              Test in Playground
            </Button>
          </Link>
          <Button onClick={handleExport} variant="outline" data-testid="button-export-config">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleSave} data-testid="button-save-config">
            <Save className="mr-2 h-4 w-4" />
            Save All
          </Button>
        </div>
      </div>

      {!isConfigurationComplete && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Configuration Incomplete:</strong> Complete all required fields before deploying.
            {!twitterComplete && <span className="block mt-1">• Twitter API credentials required</span>}
            {!modelComplete && <span className="block mt-1">• AI model API key required</span>}
            {!characterComplete && <span className="block mt-1">• Character profile and prompts required</span>}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="twitter" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="twitter">
            Twitter API
            {twitterComplete ? <CheckCircle2 className="ml-2 h-3 w-3" /> : <XCircle className="ml-2 h-3 w-3" />}
          </TabsTrigger>
          <TabsTrigger value="character">Character & Prompts</TabsTrigger>
          <TabsTrigger value="model">AI Model</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="twitter" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Twitter className="h-5 w-5" />
                Twitter Login (Required)
              </CardTitle>
              <CardDescription>
                Enter your Twitter account credentials. This is how ElizaOS connects to Twitter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  <strong>Important:</strong> Mark your Twitter account as "Automated" first.
                  <br />
                  Go to <a href="https://twitter.com/settings/account" target="_blank" rel="noopener noreferrer" className="underline font-medium">Twitter Settings</a> → Account Information → Automation → Enable it.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="twitter-username-simple">Username</Label>
                  <Input
                    id="twitter-username-simple"
                    value={twitterConfig.username}
                    onChange={(e) => setTwitterConfig({ ...twitterConfig, username: e.target.value })}
                    placeholder="your_username (no @)"
                    className="font-mono"
                    data-testid="input-twitter-username-simple"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter-password-simple">Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="twitter-password-simple"
                      type={showSecrets.twitterPassword ? "text" : "password"}
                      value={showSecrets.twitterPassword ? twitterConfig.password : maskSecret(twitterConfig.password)}
                      onChange={(e) => setTwitterConfig({ ...twitterConfig, password: e.target.value })}
                      placeholder="Your password"
                      className="font-mono"
                      data-testid="input-twitter-password-simple"
                    />
                    <Button variant="outline" size="icon" onClick={() => toggleShowSecret("twitterPassword")}>
                      {showSecrets.twitterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter-email-simple">Email</Label>
                  <Input
                    id="twitter-email-simple"
                    type="email"
                    value={twitterConfig.email}
                    onChange={(e) => setTwitterConfig({ ...twitterConfig, email: e.target.value })}
                    placeholder="your@email.com"
                    className="font-mono"
                    data-testid="input-twitter-email-simple"
                  />
                  <p className="text-xs text-muted-foreground">Twitter often requires this for verification</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter-2fa-simple">2FA Secret (if enabled)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="twitter-2fa-simple"
                      type={showSecrets.twitter2FA ? "text" : "password"}
                      value={showSecrets.twitter2FA ? twitterConfig.twoFactorSecret : maskSecret(twitterConfig.twoFactorSecret)}
                      onChange={(e) => setTwitterConfig({ ...twitterConfig, twoFactorSecret: e.target.value })}
                      placeholder="TOTP secret (optional)"
                      className="font-mono"
                      data-testid="input-twitter-2fa-simple"
                    />
                    <Button variant="outline" size="icon" onClick={() => toggleShowSecret("twitter2FA")}>
                      {showSecrets.twitter2FA ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover-elevate">
                  <div className="flex items-center gap-2">
                    <Cookie className="h-4 w-4" />
                    <span className="font-medium text-sm">Import Session Cookies (Recommended)</span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-xs">
                      <strong>Most Reliable Method:</strong> Twitter blocks automated logins, but session cookies work perfectly.
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Log into Twitter in your browser</li>
                        <li>Install "Cookie-Editor" or "EditThisCookie" extension</li>
                        <li>Click the extension icon on twitter.com</li>
                        <li>Click "Export" → Copy ALL cookies (not just auth_token)</li>
                        <li>Paste the full JSON array below</li>
                      </ol>
                      <p className="mt-2 text-red-600 dark:text-red-400">
                        <strong>Important:</strong> Export ALL cookies, not just auth_token and ct0. The scraper needs additional cookies (kdt, twid, lang, etc.) to work.
                      </p>
                      <p className="mt-1 text-amber-600 dark:text-amber-400">
                        <strong>Note:</strong> Username is still required above for mention detection to work.
                      </p>
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="twitter-cookies">Session Cookies (JSON)</Label>
                    <textarea
                      id="twitter-cookies"
                      value={twitterConfig.cookies || ""}
                      onChange={(e) => setTwitterConfig({ ...twitterConfig, cookies: e.target.value })}
                      placeholder='[{"name":"auth_token","value":"...","domain":".twitter.com"}, ...]'
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                      data-testid="input-twitter-cookies"
                    />
                    <p className="text-xs text-muted-foreground">
                      Cookies bypass login entirely. If provided, username/password are only used as backup.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
            <CardFooter>
              <div className="flex items-center justify-between w-full">
                <div className="flex-1">
                  {twitterTestResult && twitterTestResult.scraper && (
                    <div className={`flex items-center gap-2 text-sm ${twitterTestResult.scraper.success ? 'text-green-600' : 'text-red-500'}`}>
                      {twitterTestResult.scraper.success ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Connected as @{twitterTestResult.scraper.username}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          <span>{twitterTestResult.scraper.error || 'Login failed'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => testTwitter.mutate()}
                  disabled={!(twitterConfig.username && twitterConfig.password) || testTwitter.isPending}
                  data-testid="button-test-login"
                >
                  {testTwitter.isPending ? "Testing..." : "Test Login"}
                  <Play className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Collapsible>
            <Card>
              <CardHeader className="cursor-pointer">
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <div>
                    <CardTitle className="text-sm">Advanced: Twitter API Credentials</CardTitle>
                    <CardDescription className="text-xs">Optional - only for developers with Twitter API access</CardDescription>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="twitter-api-key">API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="twitter-api-key"
                        type={showSecrets.apiKey ? "text" : "password"}
                        value={showSecrets.apiKey ? twitterConfig.apiKey : maskSecret(twitterConfig.apiKey)}
                        onChange={(e) => setTwitterConfig({ ...twitterConfig, apiKey: e.target.value })}
                        placeholder="Enter API Key..."
                        className="font-mono text-sm"
                        data-testid="input-twitter-api-key"
                      />
                      <Button variant="outline" size="icon" onClick={() => toggleShowSecret("apiKey")}>
                        {showSecrets.apiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twitter-api-secret">API Secret</Label>
                    <div className="flex gap-2">
                      <Input
                        id="twitter-api-secret"
                        type={showSecrets.apiKeySecret ? "text" : "password"}
                        value={showSecrets.apiKeySecret ? twitterConfig.apiKeySecret : maskSecret(twitterConfig.apiKeySecret)}
                        onChange={(e) => setTwitterConfig({ ...twitterConfig, apiKeySecret: e.target.value })}
                        placeholder="Enter API Secret..."
                        className="font-mono text-sm"
                        data-testid="input-twitter-api-secret"
                      />
                      <Button variant="outline" size="icon" onClick={() => toggleShowSecret("apiKeySecret")}>
                        {showSecrets.apiKeySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twitter-access-token">Access Token</Label>
                    <div className="flex gap-2">
                      <Input
                        id="twitter-access-token"
                        type={showSecrets.accessToken ? "text" : "password"}
                        value={showSecrets.accessToken ? twitterConfig.accessToken : maskSecret(twitterConfig.accessToken)}
                        onChange={(e) => setTwitterConfig({ ...twitterConfig, accessToken: e.target.value })}
                        placeholder="Enter Access Token..."
                        className="font-mono text-sm"
                        data-testid="input-twitter-access-token"
                      />
                      <Button variant="outline" size="icon" onClick={() => toggleShowSecret("accessToken")}>
                        {showSecrets.accessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twitter-access-secret">Access Token Secret</Label>
                    <div className="flex gap-2">
                      <Input
                        id="twitter-access-secret"
                        type={showSecrets.accessTokenSecret ? "text" : "password"}
                        value={showSecrets.accessTokenSecret ? twitterConfig.accessTokenSecret : maskSecret(twitterConfig.accessTokenSecret)}
                        onChange={(e) => setTwitterConfig({ ...twitterConfig, accessTokenSecret: e.target.value })}
                        placeholder="Enter Access Token Secret..."
                        className="font-mono text-sm"
                        data-testid="input-twitter-access-secret"
                      />
                      <Button variant="outline" size="icon" onClick={() => toggleShowSecret("accessTokenSecret")}>
                        {showSecrets.accessTokenSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {twitterTestResult && twitterTestResult.api && (
                    <div className={`flex items-center gap-2 text-sm ${twitterTestResult.api.success ? 'text-green-600' : 'text-amber-600'}`}>
                      {twitterTestResult.api.success ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>API Connected as @{twitterTestResult.api.user?.username}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          <span>API: {twitterTestResult.api.error || 'Not configured'}</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        <TabsContent value="character" className="space-y-6">
          {/* Content Generation Quick Reference */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Content Generation Quick Reference</CardTitle>
              </div>
              <CardDescription>
                These settings control how your AI agent generates content. Settings marked with importance levels have the most impact.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
                    <span className="font-medium">Message Examples</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-4">Defines the EXACT format and structure the AI will follow. The model mirrors these examples precisely.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
                    <span className="font-medium">System Prompt</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-4">Core rules and required post structure. Defines what sections to include (Event, Verse, Context, Reflection).</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="text-xs bg-amber-500 hover:bg-amber-600">IMPORTANT</Badge>
                    <span className="font-medium">Temperature</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-4">Controls creativity vs consistency. Lower (0.3-0.5) = strict format adherence. Higher (0.7+) = more creative variation.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="text-xs bg-amber-500 hover:bg-amber-600">IMPORTANT</Badge>
                    <span className="font-medium">Max Tokens</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-4">Maximum output length. Set to 500+ for multi-paragraph posts. Too low will truncate content.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">HELPFUL</Badge>
                    <span className="font-medium">Knowledge Base</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-4">Provides current events/news content for the AI to reference in posts.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">HELPFUL</Badge>
                    <span className="font-medium">Personality Prompt</span>
                  </div>
                  <p className="text-muted-foreground text-xs pl-4">Shapes the voice and character. Influences tone but not structure.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Character Identity</CardTitle>
              <CardDescription>Define who this agent is</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="char-name">Character Name</Label>
                <Input
                  id="char-name"
                  value={character.name}
                  onChange={(e) => setCharacter({ ...character, name: e.target.value })}
                  placeholder="e.g., CryptoAnalyst"
                  data-testid="input-char-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="char-username">Twitter Username</Label>
                <Input
                  id="char-username"
                  value={character.username}
                  onChange={(e) => setCharacter({ ...character, username: e.target.value })}
                  placeholder="@username"
                  data-testid="input-char-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="char-bio">Twitter Bio</Label>
                <Textarea
                  id="char-bio"
                  value={character.bio}
                  onChange={(e) => setCharacter({ ...character, bio: e.target.value })}
                  placeholder="Bio that appears on Twitter profile"
                  className="min-h-[80px]"
                  data-testid="input-char-bio"
                />
                <p className="text-xs text-muted-foreground">{character.bio.length} / 160 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="char-lore">Character Lore</Label>
                <Textarea
                  id="char-lore"
                  value={character.lore}
                  onChange={(e) => setCharacter({ ...character, lore: e.target.value })}
                  placeholder="Deep backstory, key events, or foundational myths about this agent (newline separated)"
                  className="min-h-[100px] font-mono text-sm"
                  data-testid="input-char-lore"
                />
                <p className="text-xs text-muted-foreground">Historical context and foundational backstory.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>System Prompt</CardTitle>
                <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
              </div>
              <CardDescription>
                Core instructions defining the agent's purpose and required post structure. This is where you define what sections each post must include.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50">
                <Star className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-sm">
                  <strong>Why it matters:</strong> The System Prompt defines the rules and structure your agent must follow. Include specific formatting requirements like "Every post must follow this structure: Event Summary, Bible Verse, Context, Reflection."
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  value={character.systemPrompt}
                  onChange={(e) => setCharacter({ ...character, systemPrompt: e.target.value })}
                  className="min-h-[200px] font-mono text-sm"
                  data-testid="input-system-prompt"
                />
                <p className="text-xs text-muted-foreground">{character.systemPrompt.length} characters</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Personality & Style</CardTitle>
                <Badge variant="secondary" className="text-xs">HELPFUL</Badge>
              </div>
              <CardDescription>Define tone, style, and personality. These shape the voice but not the format.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="personality-prompt">Personality Prompt</Label>
                <Textarea
                  id="personality-prompt"
                  value={character.personalityPrompt}
                  onChange={(e) => setCharacter({ ...character, personalityPrompt: e.target.value })}
                  className="min-h-[100px] font-mono text-sm"
                  data-testid="input-personality-prompt"
                />
                <p className="text-xs text-muted-foreground">Describes the character's backstory, voice, and perspective.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-style">Post Style</Label>
                <Textarea
                  id="post-style"
                  value={character.postStyle}
                  onChange={(e) => setCharacter({ ...character, postStyle: e.target.value })}
                  className="min-h-[60px]"
                />
                <p className="text-xs text-muted-foreground">Writing style guidelines and tone descriptors.</p>
              </div>

              <div className="space-y-3 pt-2">
                <Label>Voice Presets (Click to Auto-Configure Style)</Label>
                <RadioGroup
                  defaultValue="natural"
                  className="grid grid-cols-2 gap-4"
                  onValueChange={(val) => {
                    let newStyle = character.postStyle || "";
                    // Clear previous preset keywords
                    newStyle = newStyle.replace(/pipeline: (lowercase|unhinged|academic)\n?/g, "").trim();

                    if (val === "lowercase") {
                      newStyle = `pipeline: lowercase\n${newStyle}`;
                    } else if (val === "unhinged") {
                      newStyle = `pipeline: unhinged\n${newStyle}`;
                    } else if (val === "academic") {
                      newStyle = `pipeline: academic\n${newStyle}`;
                    }

                    setCharacter({ ...character, postStyle: newStyle.trim() });
                  }}
                >
                  <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="natural" id="vp-natural" />
                    <Label htmlFor="vp-natural" className="cursor-pointer">
                      <div className="font-semibold">Natural</div>
                      <div className="text-xs text-muted-foreground">Default behavior</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="lowercase" id="vp-lowercase" />
                    <Label htmlFor="vp-lowercase" className="cursor-pointer">
                      <div className="font-semibold">lowercase</div>
                      <div className="text-xs text-muted-foreground">gen z aesthetic</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="unhinged" id="vp-chaos" />
                    <Label htmlFor="vp-chaos" className="cursor-pointer">
                      <div className="font-semibold">CHAOS MODE</div>
                      <div className="text-xs text-muted-foreground">unpredictable</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="academic" id="vp-academic" />
                    <Label htmlFor="vp-academic" className="cursor-pointer">
                      <div className="font-semibold">Academic</div>
                      <div className="text-xs text-muted-foreground">formal & cited</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>


              <div className="space-y-2">
                <Label htmlFor="topics">Topics (comma-separated)</Label>
                <Input
                  id="topics"
                  value={character.topics}
                  onChange={(e) => setCharacter({ ...character, topics: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjectives">Adjectives (comma-separated)</Label>
                <Input
                  id="adjectives"
                  value={character.adjectives}
                  onChange={(e) => setCharacter({ ...character, adjectives: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Message Examples</CardTitle>
                <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
              </div>
              <CardDescription>
                The AI will follow these examples EXACTLY. This is the most important setting for controlling output format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50">
                <MessageSquare className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-sm">
                  <strong>Why it matters:</strong> The AI mirrors these examples precisely. Include ALL sections you want in your posts: emoji, event summary, Bible verse with reference, context explanation, and reflection. The model will copy this exact structure.
                </AlertDescription>
              </Alert>
              {character.messageExamples.map((example, idx) => (
                <div key={idx} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <Label className="whitespace-nowrap">Example {idx + 1}</Label>
                      <Select
                        value={getExampleContentType(example) || "none"}
                        onValueChange={(value) => {
                          const newExamples = [...character.messageExamples];
                          const content = getExampleContent(example);
                          newExamples[idx] = value !== "none" ? { content, contentType: value as any } : content;
                          setCharacter({ ...character, messageExamples: newExamples });
                        }}
                      >
                        <SelectTrigger className="w-[180px]" data-testid={`select-content-type-${idx}`}>
                          <SelectValue placeholder="Content Type (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Type</SelectItem>
                          {CONTENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {formatContentType(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {getExampleContentType(example) && (
                        <Badge variant="outline" className="text-xs">
                          {formatContentType(getExampleContentType(example)!)}
                        </Badge>
                      )}
                    </div>
                    {idx > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newExamples = character.messageExamples.filter((_, i) => i !== idx);
                          setCharacter({ ...character, messageExamples: newExamples });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={getExampleContent(example)}
                    onChange={(e) => {
                      const newExamples = [...character.messageExamples];
                      const contentType = getExampleContentType(example);
                      newExamples[idx] = contentType
                        ? { content: e.target.value, contentType: contentType as any }
                        : e.target.value;
                      setCharacter({ ...character, messageExamples: newExamples });
                    }}
                    className="min-h-[120px] font-mono text-sm"
                    data-testid={`textarea-example-${idx}`}
                  />
                  <p className="text-xs text-muted-foreground">{getExampleContent(example).length} characters</p>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => setCharacter({ ...character, messageExamples: [...character.messageExamples, ""] })}
                data-testid="button-add-example"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Example
              </Button>
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm">
                  <strong>Content Type Tagging:</strong> Optionally tag each example with its content type. This helps the AI understand when to use each format without needing [LABELS] in your examples. The AI will rotate through content types automatically.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Post Examples</CardTitle>
                <Badge variant="secondary" className="text-xs">ELIZA PARITY</Badge>
              </div>
              <CardDescription>Examples of how the agent should structure and write public posts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {character.postExamples.map((example, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <Textarea
                      value={example}
                      onChange={(e) => {
                        const newExamples = [...character.postExamples];
                        newExamples[idx] = e.target.value;
                        setCharacter({ ...character, postExamples: newExamples });
                      }}
                      placeholder="Enter a post example..."
                      className="min-h-[60px] text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newExamples = [...character.postExamples];
                        newExamples.splice(idx, 1);
                        setCharacter({ ...character, postExamples: newExamples });
                      }}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => setCharacter({ ...character, postExamples: [...character.postExamples, ""] })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Post Example
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Custom Prompt Instructions</CardTitle>
                  <CardDescription>
                    Add specialized prompt layers on top of ElizaOS base prompts ({customPrompts.length} custom instructions)
                  </CardDescription>
                </div>
                <Dialog open={isAddCustomPromptOpen} onOpenChange={setIsAddCustomPromptOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-custom-prompt">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Custom Prompt
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Custom Prompt Instruction</DialogTitle>
                      <DialogDescription>
                        Add a specialized prompt instruction that layers on top of the base ElizaOS prompts
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="custom-prompt-key">Prompt Key</Label>
                        <Input
                          id="custom-prompt-key"
                          value={newCustomPrompt.key}
                          onChange={(e) => setNewCustomPrompt({ ...newCustomPrompt, key: e.target.value })}
                          placeholder="e.g., evaluation, market_mode, tone_mod"
                          data-testid="input-custom-prompt-key"
                        />
                        <p className="text-xs text-muted-foreground">
                          Identifier for this prompt instruction (use lowercase with underscores)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-prompt-value">Prompt Instruction</Label>
                        <Textarea
                          id="custom-prompt-value"
                          value={newCustomPrompt.value}
                          onChange={(e) => setNewCustomPrompt({ ...newCustomPrompt, value: e.target.value })}
                          placeholder="e.g., Before finalizing output, rewrite to ensure clarity..."
                          className="min-h-[150px] font-mono text-sm"
                          data-testid="input-custom-prompt-value"
                        />
                        <p className="text-xs text-muted-foreground">
                          The actual instruction that will be applied during text generation
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddCustomPromptOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddCustomPrompt} data-testid="button-save-custom-prompt">
                        Add Instruction
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {customPrompts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No custom prompt instructions added yet.</p>
                  <p className="text-xs mt-1">Custom prompts layer on top of ElizaOS base prompts without conflicts.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customPrompts.map((prompt) => (
                    <div key={prompt.id} className="p-4 border rounded-lg space-y-2" data-testid={`custom-prompt-${prompt.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {prompt.key}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap font-mono">
                            {prompt.value}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCustomPrompt(prompt.id)}
                          data-testid={`button-delete-custom-prompt-${prompt.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>How it works:</strong> Custom prompts are added as additional layers on top of the
                  base ElizaOS system and personality prompts. They're applied in the order shown here and
                  won't conflict with base functionality. Perfect for adding conditional logic, output refinement,
                  or specialized behavior modes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="model" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Model Configuration</CardTitle>
              <CardDescription>Select and configure the language model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model-provider">Provider</Label>
                <Select value={modelConfig.provider} onValueChange={(v) => {
                  setModelConfig({ ...modelConfig, provider: v });
                  setAvailableModels([]);
                  setModelTestResult(null);
                }}>
                  <SelectTrigger id="model-provider" data-testid="select-model-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-api-key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="model-api-key"
                    type={showSecrets.modelApiKey ? "text" : "password"}
                    value={showSecrets.modelApiKey ? modelConfig.apiKey : maskSecret(modelConfig.apiKey)}
                    onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
                    placeholder={`Enter ${modelConfig.provider} API key...`}
                    className="font-mono text-sm"
                    data-testid="input-model-api-key"
                  />
                  <Button variant="outline" size="icon" onClick={() => toggleShowSecret("modelApiKey")}>
                    {showSecrets.modelApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {modelConfig.provider === "google" && "Get your API key from Google AI Studio (https://makersuite.google.com/app/apikey)"}
                  {modelConfig.provider === "openai" && "Get your API key from OpenAI Platform (https://platform.openai.com/api-keys)"}
                  {modelConfig.provider === "anthropic" && "Get your API key from Anthropic Console (https://console.anthropic.com/)"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-name">Model</Label>
                {availableModels.length > 0 ? (
                  <Select value={modelConfig.model} onValueChange={(v) => setModelConfig({ ...modelConfig, model: v })}>
                    <SelectTrigger id="model-name" data-testid="select-model-name">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels
                        .filter((m) => m.id || m.name) // Only show models with valid identifiers
                        .map((m, index) => {
                          const modelId = m.id || m.name || `model-${index}`;
                          const modelName = m.name || m.id || `Model ${index + 1}`;
                          return (
                            <SelectItem key={modelId} value={modelId}>
                              {modelName}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="model-name"
                    value={modelConfig.model}
                    onChange={(e) => setModelConfig({ ...modelConfig, model: e.target.value })}
                    placeholder="Test API key to load models, or enter manually..."
                    data-testid="input-model-name"
                  />
                )}
                {modelTestResult?.note && (
                  <p className="text-xs text-muted-foreground">{modelTestResult.note}</p>
                )}
              </div>

              <div className="space-y-2 p-3 border border-amber-200 dark:border-amber-900/50 rounded-md bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Temperature</Label>
                    <Badge className="text-xs bg-amber-500 hover:bg-amber-600">IMPORTANT</Badge>
                  </div>
                  <span className="text-sm font-medium">{modelConfig.temperature[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={modelConfig.temperature}
                  onValueChange={(v) => setModelConfig({ ...modelConfig, temperature: v })}
                  max={2}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground">
                  <strong>0.3-0.5:</strong> Strict format adherence, consistent output &bull; <strong>0.6-0.8:</strong> Balanced creativity &bull; <strong>0.9+:</strong> More variation
                </p>
              </div>

              <div className="space-y-2 p-3 border border-amber-200 dark:border-amber-900/50 rounded-md bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Max Tokens</Label>
                    <Badge className="text-xs bg-amber-500 hover:bg-amber-600">IMPORTANT</Badge>
                  </div>
                  <span className="text-sm font-medium">{modelConfig.maxTokens[0]}</span>
                </div>
                <Slider
                  value={modelConfig.maxTokens}
                  onValueChange={(v) => setModelConfig({ ...modelConfig, maxTokens: v })}
                  min={100}
                  max={4000}
                  step={100}
                />
                <p className="text-xs text-muted-foreground">
                  <strong>Recommended:</strong> 500+ for multi-paragraph posts. Too low will truncate your output and cut off sections.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="context-window">Context Window (tokens)</Label>
                <Input
                  id="context-window"
                  type="number"
                  value={modelConfig.contextWindow}
                  onChange={(e) => setModelConfig({ ...modelConfig, contextWindow: e.target.value })}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex-1">
                  {modelTestResult && (
                    <div className={`flex items-center gap-2 text-sm ${modelTestResult.success ? 'text-green-600' : 'text-destructive'}`}>
                      {modelTestResult.success ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            Found {modelTestResult.modelCount} models. Latest: {modelTestResult.latestModel}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          <span>{modelTestResult.error || 'Connection failed'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => testModel.mutate()}
                  disabled={!modelConfig.apiKey || testModel.isPending || !["openai", "google", "anthropic"].includes(modelConfig.provider)}
                  data-testid="button-test-model"
                >
                  {testModel.isPending ? "Testing..." : "Test API Key & Load Models"}
                  <Play className="ml-2 h-4 w-4" />
                </Button>
              </div>
              {modelTestResult && !modelTestResult.success && modelTestResult.hint && (
                <Alert className="bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{modelTestResult.hint}</AlertDescription>
                </Alert>
              )}
              {!["openai", "google", "anthropic"].includes(modelConfig.provider) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Automatic model discovery is only supported for OpenAI, Google, and Anthropic. Please enter the model name manually for other providers.
                  </AlertDescription>
                </Alert>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Post Generation Model (Optional)</CardTitle>
              <CardDescription>Use a different AI model specifically for generating tweets. Leave empty to use default model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="post-model-provider">Provider (Optional)</Label>
                <Select value={postModelConfig.provider || "default"} onValueChange={(v) => {
                  setPostModelConfig({ ...postModelConfig, provider: v === "default" ? "" : v });
                }}>
                  <SelectTrigger id="post-model-provider" data-testid="select-post-model-provider">
                    <SelectValue placeholder="Select provider or leave empty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Default Model</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {postModelConfig.provider && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="post-model-name">Model Name</Label>
                    {availablePostModels.length > 0 ? (
                      <div className="flex gap-2">
                        <Select value={postModelConfig.model} onValueChange={(v) => setPostModelConfig({ ...postModelConfig, model: v })}>
                          <SelectTrigger id="post-model-name" data-testid="select-post-model-name">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent>
                            {availablePostModels.filter((m) => m.id || m.name).map((m, idx) => {
                              const modelId = m.id || m.name || `model-${idx}`;
                              const modelName = m.name || m.id || `Model ${idx + 1}`;
                              return (
                                <SelectItem key={modelId} value={modelId}>
                                  {modelName}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={() => testPostModels.mutate()} disabled={testPostModels.isPending}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          id="post-model-name"
                          value={postModelConfig.model}
                          onChange={(e) => setPostModelConfig({ ...postModelConfig, model: e.target.value })}
                          placeholder="e.g., gpt-4-turbo-preview"
                          data-testid="input-post-model-name"
                        />
                        <Button variant="outline" onClick={() => testPostModels.mutate()} disabled={testPostModels.isPending}>
                          {testPostModels.isPending ? "Loading..." : "Load"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Temperature</Label>
                      <span className="text-sm text-muted-foreground">{postModelConfig.temperature[0].toFixed(2)}</span>
                    </div>
                    <Slider
                      value={postModelConfig.temperature}
                      onValueChange={(v) => setPostModelConfig({ ...postModelConfig, temperature: v })}
                      max={2}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">Lower = more focused, Higher = more creative</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Max Tokens</Label>
                      <span className="text-sm text-muted-foreground">{postModelConfig.maxTokens[0]}</span>
                    </div>
                    <Slider
                      value={postModelConfig.maxTokens}
                      onValueChange={(v) => setPostModelConfig({ ...postModelConfig, maxTokens: v })}
                      min={50}
                      max={500}
                      step={10}
                    />
                    <p className="text-xs text-muted-foreground">Recommended: 280 for Twitter character limit</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation Model (Optional)</CardTitle>
              <CardDescription>Use a different AI model for conversation testing and replies. Leave empty to use default model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="conversation-model-provider">Provider (Optional)</Label>
                <Select value={conversationModelConfig.provider || "default"} onValueChange={(v) => {
                  setConversationModelConfig({ ...conversationModelConfig, provider: v === "default" ? "" : v });
                }}>
                  <SelectTrigger id="conversation-model-provider" data-testid="select-conversation-model-provider">
                    <SelectValue placeholder="Select provider or leave empty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Default Model</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {conversationModelConfig.provider && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="conversation-model-name">Model Name</Label>
                    {availableConversationModels.length > 0 ? (
                      <div className="flex gap-2">
                        <Select value={conversationModelConfig.model} onValueChange={(v) => setConversationModelConfig({ ...conversationModelConfig, model: v })}>
                          <SelectTrigger id="conversation-model-name" data-testid="select-conversation-model-name">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableConversationModels.filter((m) => m.id || m.name).map((m, idx) => {
                              const modelId = m.id || m.name || `model-${idx}`;
                              const modelName = m.name || m.id || `Model ${idx + 1}`;
                              return (
                                <SelectItem key={modelId} value={modelId}>
                                  {modelName}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={() => testConversationModels.mutate()} disabled={testConversationModels.isPending}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          id="conversation-model-name"
                          value={conversationModelConfig.model}
                          onChange={(e) => setConversationModelConfig({ ...conversationModelConfig, model: e.target.value })}
                          placeholder="e.g., gpt-4-turbo-preview"
                          data-testid="input-conversation-model-name"
                        />
                        <Button variant="outline" onClick={() => testConversationModels.mutate()} disabled={testConversationModels.isPending}>
                          {testConversationModels.isPending ? "Loading..." : "Load"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Temperature</Label>
                      <span className="text-sm text-muted-foreground">{conversationModelConfig.temperature[0].toFixed(2)}</span>
                    </div>
                    <Slider
                      value={conversationModelConfig.temperature}
                      onValueChange={(v) => setConversationModelConfig({ ...conversationModelConfig, temperature: v })}
                      max={2}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">Lower = more focused, Higher = more creative</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Max Tokens</Label>
                      <span className="text-sm text-muted-foreground">{conversationModelConfig.maxTokens[0]}</span>
                    </div>
                    <Slider
                      value={conversationModelConfig.maxTokens}
                      onValueChange={(v) => setConversationModelConfig({ ...conversationModelConfig, maxTokens: v })}
                      min={100}
                      max={4000}
                      step={100}
                    />
                    <p className="text-xs text-muted-foreground">Recommended: 500+ for detailed conversations</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Posting Schedule</CardTitle>
              <CardDescription>Control when and how often this agent posts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Automated Posting</Label>
                  <p className="text-xs text-muted-foreground">Allow agent to post automatically</p>
                </div>
                <Switch
                  checked={behavior.postingEnabled}
                  onCheckedChange={(v) => setBehavior({ ...behavior, postingEnabled: v })}
                />
              </div>

              <div className="space-y-2">
                <Label>Post Frequency</Label>
                <p className="text-xs text-muted-foreground">
                  How often should this agent post automatically?
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={behavior.postFrequency}
                    onChange={(e) => setBehavior({ ...behavior, postFrequency: e.target.value })}
                    className="w-24"
                    disabled={!behavior.postingEnabled}
                    data-testid="input-post-frequency"
                  />
                  <span className="text-sm text-muted-foreground">
                    posts per
                  </span>
                  <Select
                    value={behavior.postInterval}
                    onValueChange={(v) => setBehavior({ ...behavior, postInterval: v })}
                    disabled={!behavior.postingEnabled}
                  >
                    <SelectTrigger className="w-32" data-testid="select-post-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minute(s)</SelectItem>
                      <SelectItem value="hours">Hour(s)</SelectItem>
                      <SelectItem value="days">Day(s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {behavior.postingEnabled && behavior.postFrequency && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {behavior.postInterval === "hours" && (
                      <>Approximately {Number(behavior.postFrequency) * 24} tweets per day</>
                    )}
                    {behavior.postInterval === "minutes" && (
                      <>Approximately {Number(behavior.postFrequency) * 60} tweets per hour</>
                    )}
                    {behavior.postInterval === "days" && (
                      <>{Number(behavior.postFrequency)} tweets per day</>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-posts">Max Posts Per Day</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="max-posts"
                    type="number"
                    value={behavior.maxPostsPerDay}
                    onChange={(e) => setBehavior({ ...behavior, maxPostsPerDay: e.target.value })}
                    disabled={!behavior.postingEnabled}
                    className="w-24"
                    data-testid="input-max-posts-per-day"
                  />
                  <span className="text-sm text-muted-foreground">posts/day</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Twitter Free: 17/day limit.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={behavior.timezone}
                  onValueChange={(v) => setBehavior({ ...behavior, timezone: v })}
                  disabled={!behavior.postingEnabled}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern (US) - EST/EDT</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific (US) - PST/PDT</SelectItem>
                    <SelectItem value="America/Chicago">Central (US) - CST/CDT</SelectItem>
                    <SelectItem value="Europe/London">London - GMT/BST</SelectItem>
                    <SelectItem value="Europe/Paris">Central Europe - CET/CEST</SelectItem>
                    <SelectItem value="Asia/Singapore">Singapore - SGT (UTC+8)</SelectItem>
                    <SelectItem value="Asia/Hong_Kong">Hong Kong - HKT (UTC+8)</SelectItem>
                    <SelectItem value="Asia/Shanghai">Shanghai - CST (UTC+8)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo - JST (UTC+9)</SelectItem>
                    <SelectItem value="Australia/Sydney">Sydney - AEDT/AEST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reply Behavior</CardTitle>
              <CardDescription>Configure how this agent responds to mentions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Auto-Reply</Label>
                  <p className="text-xs text-muted-foreground">Automatically respond to mentions</p>
                </div>
                <Switch
                  checked={behavior.replyEnabled}
                  onCheckedChange={(v) => setBehavior({ ...behavior, replyEnabled: v })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Reply Rate</Label>
                  <span className="text-sm text-muted-foreground">{behavior.replyRate[0]}%</span>
                </div>
                <Slider
                  value={behavior.replyRate}
                  onValueChange={(v) => setBehavior({ ...behavior.replyRate, replyRate: v })}
                  max={100}
                  step={5}
                  disabled={!behavior.replyEnabled}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-replies-per-hour">Max Replies Per Hour</Label>
                  <Input
                    id="max-replies-per-hour"
                    type="number"
                    min="1"
                    max="60"
                    value={behavior.maxRepliesPerHour}
                    onChange={(e) => setBehavior({ ...behavior, maxRepliesPerHour: e.target.value })}
                    disabled={!behavior.replyEnabled}
                    data-testid="input-max-replies-per-hour"
                  />
                  <p className="text-xs text-muted-foreground">Rate limit for auto-replies</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Reply Delay</Label>
                    <span className="text-sm text-muted-foreground">{behavior.replyDelay[0]}s</span>
                  </div>
                  <Slider
                    value={behavior.replyDelay}
                    onValueChange={(v) => setBehavior({ ...behavior, replyDelay: v })}
                    min={10}
                    max={300}
                    step={10}
                    disabled={!behavior.replyEnabled}
                    data-testid="slider-reply-delay"
                  />
                  <p className="text-xs text-muted-foreground">Seconds to wait before replying (appears more natural)</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reply-keywords">Reply to Keywords (comma-separated)</Label>
                <Textarea
                  id="reply-keywords"
                  value={behavior.replyKeywords}
                  onChange={(e) => setBehavior({ ...behavior, replyKeywords: e.target.value })}
                  className="min-h-[60px]"
                  disabled={!behavior.replyEnabled}
                />
              </div>
            </CardContent>
          </Card>



          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Content Freshness System
              </CardTitle>
              <CardDescription>
                Keep your content fresh and varied by tracking Bible verses, content types, and KB usage patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Bible Verse Tracking
                    </Label>
                    <p className="text-xs text-muted-foreground">Track verses to ensure variety in Scripture references</p>
                  </div>
                  <Switch
                    checked={behavior.verseTrackingEnabled}
                    onCheckedChange={(v) => setBehavior({ ...behavior, verseTrackingEnabled: v })}
                    data-testid="switch-verse-tracking"
                  />
                </div>

                {behavior.verseTrackingEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 pt-2 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>Reuse Policy</Label>
                      <Select
                        value={behavior.verseReusePolicy}
                        onValueChange={(v) => setBehavior({ ...behavior, verseReusePolicy: v })}
                      >
                        <SelectTrigger data-testid="select-verse-policy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allow">Allow - No restrictions</SelectItem>
                          <SelectItem value="avoid_recent">Avoid Recent</SelectItem>
                          <SelectItem value="unique">Never Repeat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="verse-window">Look-back Window</Label>
                      <Input
                        id="verse-window"
                        type="number"
                        min="1"
                        max="100"
                        value={behavior.verseReuseWindow}
                        onChange={(e) => setBehavior({ ...behavior, verseReuseWindow: e.target.value })}
                        disabled={behavior.verseReusePolicy === "allow"}
                        className="min-h-[80px] font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        The agent will read the last 3 tweets from these accounts every 4 hours.
                      </p>
                    </div>


                  </div>
                )}
              </div>

              <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Content Type Rotation
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Rotate through 7 content types: Event, Verse Reflection, Deep Question, Wisdom Bite, Cultural, Encouragement, Eternity Anchor
                    </p>
                  </div>
                  <Switch
                    checked={behavior.contentTypeTrackingEnabled}
                    onCheckedChange={(v) => setBehavior({ ...behavior, contentTypeTrackingEnabled: v })}
                    data-testid="switch-content-type-tracking"
                  />
                </div>

                {behavior.contentTypeTrackingEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 pt-2 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>Rotation Policy</Label>
                      <Select
                        value={behavior.contentTypeReusePolicy}
                        onValueChange={(v) => setBehavior({ ...behavior, contentTypeReusePolicy: v })}
                      >
                        <SelectTrigger data-testid="select-content-type-policy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allow">Allow - No restrictions</SelectItem>
                          <SelectItem value="avoid_last">Avoid Last - Skip previous type</SelectItem>
                          <SelectItem value="rotate_all">Rotate All - Cycle through all 7</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content-type-window">History Depth</Label>
                      <Input
                        id="content-type-window"
                        type="number"
                        min="1"
                        max="20"
                        value={behavior.contentTypeWindow}
                        onChange={(e) => setBehavior({ ...behavior, contentTypeWindow: e.target.value })}
                        disabled={behavior.contentTypeReusePolicy === "allow"}
                        data-testid="input-content-type-window"
                      />
                      <p className="text-xs text-muted-foreground">
                        Track last {behavior.contentTypeWindow} content types used
                      </p>
                    </div>
                  </div>
                )}
              </div>



            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          {/* KB Role in Content Generation */}
          <Alert className="border-primary/30 bg-primary/5">
            <Database className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <strong>Role in Content Generation</strong>
                <Badge variant="secondary" className="text-xs">HELPFUL</Badge>
              </div>
              <p className="text-muted-foreground">
                Knowledge Base entries provide current events and news content for the AI to reference. High-priority, unused entries are selected first.
                The KB gives your agent fresh topics to discuss, but <strong>Message Examples</strong> and <strong>System Prompt</strong> control the actual output format.
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between my-4">
            <div>
              <h2 className="text-lg font-medium">Knowledge Base Management</h2>
              <p className="text-sm text-muted-foreground">Manage static knowledge and lore for your agent</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAddKBDialogOpen(true)} data-testid="button-add-kb-entry">
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </div>
          </div>


          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                News Monitor & Knowledge Strategy
              </CardTitle>
              <CardDescription>
                Configure how the agent monitors external sources and utilizes its knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* News Monitor Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">News Monitor</Label>
                    <p className="text-sm text-muted-foreground">Scrape X accounts for fresh context (bypass API limits)</p>
                  </div>
                  <Switch
                    checked={monitoringSettings.enabled}
                    onCheckedChange={(v) => setMonitoringSettings({ ...monitoringSettings, enabled: v })}
                    data-testid="switch-news-monitor"
                  />
                </div>

                {monitoringSettings.enabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="monitor-targets">Target Accounts (comma-separated)</Label>
                        <Input
                          id="monitor-targets"
                          placeholder="DegenerateNews, Cointelegraph"
                          value={monitoringSettings.targets}
                          onChange={(e) => setMonitoringSettings({ ...monitoringSettings, targets: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="monitor-interval">Check Interval (Hours)</Label>
                        <Input
                          id="monitor-interval"
                          type="number"
                          min="1"
                          max="24"
                          value={monitoringSettings.interval}
                          onChange={(e) => setMonitoringSettings({ ...monitoringSettings, interval: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Scraped Content Display */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Current Context (In-Memory)
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1 px-2"
                          onClick={handleRefreshNews}
                          disabled={!monitoringSettings.enabled}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Refresh Now
                        </Button>
                      </div>
                      <div className="rounded-md border border-border bg-muted/50 p-2 space-y-2 max-h-[200px] overflow-y-auto">
                        {agentStatus?.newsContext && agentStatus.newsContext.length > 0 ? (
                          agentStatus.newsContext.map((tweet: any, i: number) => (
                            <div key={i} className="text-xs space-y-1 pb-2 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-500">@{tweet.username}</span>
                                <span className="text-muted-foreground text-[10px]">
                                  {new Date(tweet.timeParsed || Date.now()).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-muted-foreground/90 line-clamp-3">{tweet.text}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic p-2 text-center">
                            No news context scraped yet. Agent will fetch on next run.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Knowledge Selection</Label>
                    <p className="text-sm text-muted-foreground">How many KB items to inject per tweet</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kb-max-entries">Max Entries per Post</Label>
                    <Input
                      id="kb-max-entries"
                      type="number"
                      min="1"
                      max="10"
                      value={kbSettings.maxEntries}
                      onChange={(e) => setKbSettings({ ...kbSettings, maxEntries: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reuse Policy</Label>
                    <Select
                      value={kbSettings.reusePolicy}
                      onValueChange={(v) => setKbSettings({ ...kbSettings, reusePolicy: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow Reuse</SelectItem>
                        <SelectItem value="deprioritize">prioritize Unused</SelectItem>
                        <SelectItem value="block">Block Reuse (Cooldown)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kb-cooldown">Cooldown (Hours)</Label>
                    <Input
                      id="kb-cooldown"
                      type="number"
                      min="1"
                      value={kbSettings.reuseCooldownHours}
                      onChange={(e) => setKbSettings({ ...kbSettings, reuseCooldownHours: parseInt(e.target.value) || 0 })}
                      disabled={kbSettings.reusePolicy !== "block"}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5 text-primary" />
                  Knowledge Entries
                </CardTitle>
                <CardDescription>
                  {kbEntries.length} total entries • Auto-approved
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {kbEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No knowledge entries found. Add some content to get started.
                </div>
              ) : (
                <>
                  {kbEntries.map((entry: any) => (
                    <div key={entry.id} className="p-3 border rounded-lg space-y-2" data-testid={`active-kb-entry-${entry.id}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedKBIds.has(entry.id)}
                          onChange={() => {
                            const newSet = new Set(selectedKBIds);
                            if (newSet.has(entry.id)) {
                              newSet.delete(entry.id);
                            } else {
                              newSet.add(entry.id);
                            }
                            setSelectedKBIds(newSet);
                          }}
                          className="mt-1"
                          data-testid={`checkbox-active-kb-${entry.id}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium">{entry.title}</h4>
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                              <Badge variant="outline" className="text-xs">{entry.source}</Badge>
                              {entry.active ? (
                                <Badge variant="default" className="text-xs">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Disabled</Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{entry.content}</p>
                          <div className="flex gap-2 mt-2 flex-wrap items-center">
                            {entry.tags?.map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                            <Select
                              value={entry.priority || "medium"}
                              onValueChange={(value) => {
                                updatePriorityMutation.mutate({ entryId: entry.id, priority: value });
                              }}
                              disabled={updatePriorityMutation.isPending}
                            >
                              <SelectTrigger
                                className="h-6 w-[110px] text-xs"
                                data-testid={`select-priority-${entry.id}`}
                              >
                                <SelectValue placeholder="Priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high" data-testid={`priority-high-${entry.id}`}>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    High
                                  </span>
                                </SelectItem>
                                <SelectItem value="medium" data-testid={`priority-medium-${entry.id}`}>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                    Medium
                                  </span>
                                </SelectItem>
                                <SelectItem value="low" data-testid={`priority-low-${entry.id}`}>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                    Low
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {entry.originalPriority && entry.originalPriority !== entry.priority && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                was: {entry.originalPriority}
                              </Badge>
                            )}
                            {entry.lastRefreshedAt && (
                              <span className="text-xs text-muted-foreground ml-auto" data-testid={`kb-refresh-time-${entry.id}`}>
                                Last refreshed: {new Date(entry.lastRefreshedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {/* Only show edit button for manually added entries */}
                          {entry.source === "manual" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingKBEntry(entry);
                                setIsEditKBDialogOpen(true);
                              }}
                              data-testid={`button-edit-kb-${entry.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card >
        </TabsContent >

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Webhook Notifications
              </CardTitle>
              <CardDescription>
                Receive real-time notifications when your agent posts tweets or encounters errors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="webhook-enabled">Enable Webhooks</Label>
                  <p className="text-sm text-muted-foreground">Send notifications to your endpoint</p>
                </div>
                <Switch
                  id="webhook-enabled"
                  checked={webhookSettings.enabled}
                  onCheckedChange={(v) => setWebhookSettings({ ...webhookSettings, enabled: v })}
                  data-testid="switch-webhook-enabled"
                />
              </div>

              {webhookSettings.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      type="url"
                      placeholder="https://your-server.com/webhook"
                      value={webhookSettings.url}
                      onChange={(e) => setWebhookSettings({ ...webhookSettings, url: e.target.value })}
                      data-testid="input-webhook-url"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your endpoint will receive POST requests with JSON payload
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhook-secret">Webhook Secret (Optional)</Label>
                    <div className="relative">
                      <Input
                        id="webhook-secret"
                        type={showSecrets["webhook"] ? "text" : "password"}
                        placeholder="Optional HMAC secret for signature verification"
                        value={webhookSettings.secret}
                        onChange={(e) => setWebhookSettings({ ...webhookSettings, secret: e.target.value })}
                        className="pr-10"
                        data-testid="input-webhook-secret"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => toggleShowSecret("webhook")}
                      >
                        {showSecrets["webhook"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      If set, requests include X-Webhook-Signature header with sha256=HMAC signature
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Event Types</Label>
                    <p className="text-sm text-muted-foreground">Select which events trigger webhook notifications</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "post_created", label: "Post Created", desc: "When a tweet is posted" },
                        { id: "post_failed", label: "Post Failed", desc: "When posting fails" },
                        { id: "reply_created", label: "Reply Created", desc: "When a reply is sent" },
                        { id: "reply_failed", label: "Reply Failed", desc: "When reply fails" },
                        { id: "error", label: "Errors", desc: "General error events" },
                        { id: "rate_limit_warning", label: "Rate Limit Warning", desc: "Approaching rate limits" },
                      ].map((event) => (
                        <div key={event.id} className="flex items-start gap-2 p-3 border rounded-lg">
                          <Switch
                            id={`event-${event.id}`}
                            checked={webhookSettings.events.includes(event.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setWebhookSettings({
                                  ...webhookSettings,
                                  events: [...webhookSettings.events, event.id],
                                });
                              } else {
                                setWebhookSettings({
                                  ...webhookSettings,
                                  events: webhookSettings.events.filter((e) => e !== event.id),
                                });
                              }
                            }}
                            data-testid={`switch-event-${event.id}`}
                          />
                          <div>
                            <Label htmlFor={`event-${event.id}`} className="text-sm font-medium">
                              {event.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">{event.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!webhookSettings.url) {
                          toast({ title: "Enter a webhook URL first", variant: "destructive" });
                          return;
                        }
                        setIsTestingWebhook(true);
                        try {
                          const response = await fetch(`/api/agents/${id}/test-webhook`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              webhookUrl: webhookSettings.url,
                              webhookSecret: webhookSettings.secret || undefined,
                            }),
                          });
                          const result = await response.json();
                          if (result.success) {
                            toast({
                              title: "Webhook Test Successful",
                              description: `Response time: ${result.responseTime}ms`,
                            });
                          } else {
                            toast({
                              title: "Webhook Test Failed",
                              description: result.error,
                              variant: "destructive",
                            });
                          }
                        } catch (err) {
                          toast({
                            title: "Webhook Test Failed",
                            description: "Could not connect to the webhook endpoint",
                            variant: "destructive",
                          });
                        } finally {
                          setIsTestingWebhook(false);
                        }
                      }}
                      disabled={isTestingWebhook || !webhookSettings.url}
                      data-testid="button-test-webhook"
                    >
                      {isTestingWebhook ? "Testing..." : "Test Webhook"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Webhook Payload Format</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto">
                {`{
  "event": "post_created",
  "timestamp": "2024-01-15T10:30:00Z",
  "agentId": "${id || "agent-id"}",
  "agentName": "${agent?.name || "Agent Name"}",
  "data": {
    "content": "Tweet content here...",
    "tweetId": "1234567890",
    "characterCount": 140
  }
}`}
              </pre>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p><strong>Headers sent with each request:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><code>Content-Type: application/json</code></li>
                  <li><code>X-Webhook-Event: post_created</code></li>
                  <li><code>X-Webhook-Timestamp: 2024-01-15T10:30:00Z</code></li>
                  <li><code>X-Agent-Id: {id || "agent-id"}</code></li>
                  <li><code>X-Webhook-Signature: sha256=...</code> (if secret configured)</li>
                </ul>
              </div>
            </CardContent>
          </Card>


        </TabsContent >
      </Tabs >

      <div className="flex justify-between items-center gap-4 p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <Badge variant={isConfigurationComplete ? "default" : "secondary"} className="gap-1">
            {isConfigurationComplete ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Ready to Deploy
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                Configuration Incomplete
              </>
            )}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleForceGenerateTweet}
            variant="outline"
            size="lg"
            disabled={forceGenerateMutation.isPending || !agent}
            data-testid="button-force-tweet"
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            {forceGenerateMutation.isPending ? "Generating..." : "Force Generate Tweet"}
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            size="lg"
            disabled={!agent}
            data-testid="button-export-config-footer"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Character
          </Button>
          <Button
            onClick={handleSave}
            size="lg"
            disabled={updateAgentMutation.isPending}
            data-testid="button-save-all"
          >
            <Save className="mr-2 h-4 w-4" />
            {updateAgentMutation.isPending ? "Saving..." : "Save All Configuration"}
          </Button>
        </div>
      </div>
    </div >
  );
}
