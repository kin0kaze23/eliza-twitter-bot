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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, AlertCircle, CheckCircle2, XCircle, Eye, EyeOff, Play, Plus, Trash2, PlayCircle, RefreshCw, Settings, Zap, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Agent, KnowledgeBase } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

type KBEntry = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  priority: number;
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
  const { id } = useParams<{ id: string }>();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Fetch agent data from backend
  const { data: agent, isLoading, error } = useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: !!id,
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
  const { data: approvedKB = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/agents", id, "knowledge/approved"],
    enabled: !!id,
  });

  // Fetch custom APIs for KB refresh controls
  const { data: customApis = [] } = useQuery<any[]>({
    queryKey: ["/api/custom-apis"],
  });

  // KB batch operations state
  const [selectedKBIds, setSelectedKBIds] = useState<Set<string>>(new Set());
  const [kbSubtab, setKbSubtab] = useState<"review" | "active">("review");
  
  // Clear KB selection when switching tabs to prevent cross-tab operations
  useEffect(() => {
    setSelectedKBIds(new Set());
  }, [kbSubtab]);
  
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
  });
  
  const [twitterTestResult, setTwitterTestResult] = useState<{ success: boolean; message?: string; error?: string; hint?: string; user?: any } | null>(null);
  const [modelTestResult, setModelTestResult] = useState<{ success: boolean; provider?: string; modelCount?: number; latestModel?: string; models?: any[]; error?: string; hint?: string; note?: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [availablePostModels, setAvailablePostModels] = useState<any[]>([]);
  const [availableConversationModels, setAvailableConversationModels] = useState<any[]>([]);
  
  // Twitter API Test Mutation
  const testTwitter = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agents/${id}/test/twitter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setTwitterTestResult(data);
      toast({
        title: "Success!",
        description: data.user ? `Connected as @${data.user.username}` : data.message,
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
  const [character, setCharacter] = useState({
    name: "CryptoAnalyst",
    username: "@cryptoanalyst_ai",
    bio: "Cryptocurrency analyst powered by AI. Providing data-driven insights on Bitcoin, Ethereum, and DeFi. Not financial advice. DYOR.",
    systemPrompt: "You are an AI agent with expertise in cryptocurrency markets, blockchain technology, and DeFi. Provide accurate, timely insights based on current market data and news. Always maintain a helpful and professional demeanor.",
    personalityPrompt: "Personality: Knowledgeable, analytical, enthusiastic about innovation. Tone: Professional yet conversational. Style: Clear, concise, data-driven insights with occasional wit.",
    messageExamples: [
      "🚀 Bitcoin breaking above $45k resistance! On-chain metrics showing strong accumulation. This could be the start of the next leg up. #BTC",
      "Interesting DeFi development: New L2 protocol launching with novel liquidity mechanism. Early data looks promising. Will monitor closely.",
    ],
    postStyle: "Mix of analysis, insights, and commentary with data-driven observations",
    topics: "Cryptocurrency, DeFi, NFTs, Blockchain Technology, Market Analysis, Trading",
    adjectives: "analytical, insightful, timely, professional, innovative",
  });
  
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
    
    // Modules
    cryptoCommentary: true,
    marketAnalysis: true,
    newsCommentary: true,
    technicalAnalysis: false,
    threads: true,
    memes: false,
    
    // Triggers
    priceChangeThreshold: [5],
    volumeChangeThreshold: [50],
    autoTweetOnNews: true,
    minNewsSentiment: [0.6],
  });

  // Knowledge Base Settings
  const [kbSettings, setKbSettings] = useState({
    maxEntries: "10",
    reusePolicy: "deprioritize", // never, deprioritize, allow
    reuseCooldownHours: "24",
    autoRefreshEnabled: false,
    autoRefreshIntervalHours: "6",
    priorityRuleEnabled: false,
    priorityRule: "",
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
    priority: 5,
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
    mutationFn: async (entry: { title: string; content: string; tags: string[]; category: string; priority: number; active: boolean; refreshStrategy: string }) => {
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
        priority: 5,
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

  const [isApplyingPriorityRules, setIsApplyingPriorityRules] = useState(false);
  const handleApplyPriorityRules = async () => {
    if (!kbSettings.priorityRule.trim()) {
      toast({ title: "No priority rules defined", variant: "destructive" });
      return;
    }
    setIsApplyingPriorityRules(true);
    try {
      const response = await fetch(`/api/agents/${id}/knowledge/apply-priority-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: kbSettings.priorityRule }),
      });
      const data = await response.json();
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge"] });
        queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "knowledge/approved"] });
        toast({ title: "Priority rules applied", description: `Updated ${data.updated} entries` });
      } else {
        toast({ title: "Failed to apply rules", description: data.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error applying priority rules", variant: "destructive" });
    } finally {
      setIsApplyingPriorityRules(false);
    }
  };

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

  const handleBatchArchive = () => {
    if (selectedKBIds.size === 0) return;
    batchArchiveMutation.mutate(Array.from(selectedKBIds));
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
        // Character
        name: character.name,
        username: character.username,
        bio: character.bio,
        systemPrompt: character.systemPrompt,
        personalityPrompt: character.personalityPrompt,
        postStyle: character.postStyle,
        topics: character.topics,
        adjectives: character.adjectives,
        messageExamples: character.messageExamples,
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
        cryptoCommentary: behavior.cryptoCommentary,
        marketAnalysis: behavior.marketAnalysis,
        newsCommentary: behavior.newsCommentary,
        technicalAnalysis: behavior.technicalAnalysis,
        threads: behavior.threads,
        memes: behavior.memes,
        priceChangeThreshold: behavior.priceChangeThreshold[0],
        volumeChangeThreshold: behavior.volumeChangeThreshold[0],
        autoTweetOnNews: behavior.autoTweetOnNews,
        minNewsSentiment: behavior.minNewsSentiment[0].toString(),
        // Knowledge Base Settings
        kbMaxEntries: parseInt(kbSettings.maxEntries) || 10,
        kbReusePolicy: kbSettings.reusePolicy,
        kbReuseCooldownHours: parseInt(kbSettings.reuseCooldownHours) || 24,
        kbAutoRefreshEnabled: kbSettings.autoRefreshEnabled,
        kbAutoRefreshIntervalHours: parseInt(kbSettings.autoRefreshIntervalHours) || 6,
        kbPriorityRuleEnabled: kbSettings.priorityRuleEnabled,
        kbPriorityRule: kbSettings.priorityRule || null,
        // Webhook Settings
        webhookEnabled: webhookSettings.enabled,
        webhookUrl: webhookSettings.url || undefined,
        webhookSecret: webhookSettings.secret || undefined,
        webhookEvents: webhookSettings.events,
      });
    },
    onSuccess: () => {
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
    });
    
    // Load character
    setCharacter({
      name: agent.name,
      username: agent.username,
      bio: agent.bio || "",
      systemPrompt: agent.systemPrompt || "",
      personalityPrompt: agent.personalityPrompt || "",
      postStyle: agent.postStyle || "",
      topics: agent.topics || "",
      adjectives: agent.adjectives || "",
      messageExamples: agent.messageExamples || [],
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
      cryptoCommentary: agent.cryptoCommentary ?? true,
      marketAnalysis: agent.marketAnalysis ?? true,
      newsCommentary: agent.newsCommentary ?? true,
      technicalAnalysis: agent.technicalAnalysis ?? false,
      threads: agent.threads ?? true,
      memes: agent.memes ?? false,
      priceChangeThreshold: [agent.priceChangeThreshold || 5],
      volumeChangeThreshold: [agent.volumeChangeThreshold || 50],
      autoTweetOnNews: agent.autoTweetOnNews ?? true,
      minNewsSentiment: [parseFloat(agent.minNewsSentiment || "0.6")],
    });
    
    // Load KB settings
    setKbSettings({
      maxEntries: (agent.kbMaxEntries || 10).toString(),
      reusePolicy: agent.kbReusePolicy || "deprioritize",
      reuseCooldownHours: (agent.kbReuseCooldownHours || 24).toString(),
      autoRefreshEnabled: agent.kbAutoRefreshEnabled || false,
      autoRefreshIntervalHours: (agent.kbAutoRefreshIntervalHours || 6).toString(),
      priorityRuleEnabled: agent.kbPriorityRuleEnabled || false,
      priorityRule: agent.kbPriorityRule || "",
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
      priority: kb.priority || 5,
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

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load agent configuration. Please try again.</p>
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
          <div className="flex items-center gap-3">
            <Link href="/agents">
              <Button variant="ghost" size="sm">← Back to Agents</Button>
            </Link>
          </div>
          <h1 className="text-2xl font-semibold mt-2" data-testid="text-page-title">
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
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Required:</strong> Get credentials from{" "}
              <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="underline">
                Twitter Developer Portal
              </a>
              . Create an app with Read and Write permissions.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Twitter API v2 Credentials</CardTitle>
              <CardDescription>All 6 credentials required for full functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twitter-app-id">App ID</Label>
                <Input
                  id="twitter-app-id"
                  value={twitterConfig.appId}
                  onChange={(e) => setTwitterConfig({ ...twitterConfig, appId: e.target.value })}
                  placeholder="Your Twitter App ID"
                  className="font-mono text-sm"
                  data-testid="input-twitter-app-id"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-api-key">API Key (Consumer Key)</Label>
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
                <Label htmlFor="twitter-api-secret">API Key Secret</Label>
                <div className="flex gap-2">
                  <Input
                    id="twitter-api-secret"
                    type={showSecrets.apiKeySecret ? "text" : "password"}
                    value={showSecrets.apiKeySecret ? twitterConfig.apiKeySecret : maskSecret(twitterConfig.apiKeySecret)}
                    onChange={(e) => setTwitterConfig({ ...twitterConfig, apiKeySecret: e.target.value })}
                    placeholder="Enter API Key Secret..."
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

              <div className="space-y-2">
                <Label htmlFor="twitter-bearer">Bearer Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="twitter-bearer"
                    type={showSecrets.bearerToken ? "text" : "password"}
                    value={showSecrets.bearerToken ? twitterConfig.bearerToken : maskSecret(twitterConfig.bearerToken)}
                    onChange={(e) => setTwitterConfig({ ...twitterConfig, bearerToken: e.target.value })}
                    placeholder="Enter Bearer Token..."
                    className="font-mono text-sm"
                    data-testid="input-twitter-bearer"
                  />
                  <Button variant="outline" size="icon" onClick={() => toggleShowSecret("bearerToken")}>
                    {showSecrets.bearerToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>OAuth 2.0 Credentials</strong> (optional, for user authorization flows only)
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="twitter-oauth-client-id">OAuth 2.0 Client ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="twitter-oauth-client-id"
                    type={showSecrets.oauthClientId ? "text" : "password"}
                    value={showSecrets.oauthClientId ? twitterConfig.oauthClientId : maskSecret(twitterConfig.oauthClientId)}
                    onChange={(e) => setTwitterConfig({ ...twitterConfig, oauthClientId: e.target.value })}
                    placeholder="Enter OAuth 2.0 Client ID (optional)..."
                    className="font-mono text-sm"
                    data-testid="input-twitter-oauth-client-id"
                  />
                  <Button variant="outline" size="icon" onClick={() => toggleShowSecret("oauthClientId")}>
                    {showSecrets.oauthClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only needed if you're implementing user authorization flows. Not required for basic bot functionality.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-oauth-client-secret">OAuth 2.0 Client Secret</Label>
                <div className="flex gap-2">
                  <Input
                    id="twitter-oauth-client-secret"
                    type={showSecrets.oauthClientSecret ? "text" : "password"}
                    value={showSecrets.oauthClientSecret ? twitterConfig.oauthClientSecret : maskSecret(twitterConfig.oauthClientSecret)}
                    onChange={(e) => setTwitterConfig({ ...twitterConfig, oauthClientSecret: e.target.value })}
                    placeholder="Enter OAuth 2.0 Client Secret (optional)..."
                    className="font-mono text-sm"
                    data-testid="input-twitter-oauth-client-secret"
                  />
                  <Button variant="outline" size="icon" onClick={() => toggleShowSecret("oauthClientSecret")}>
                    {showSecrets.oauthClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex-1">
                  {twitterTestResult && (
                    <div className={`flex items-center gap-2 text-sm ${twitterTestResult.success ? 'text-green-600' : 'text-destructive'}`}>
                      {twitterTestResult.success ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Connected as @{twitterTestResult.user?.username}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          <span>{twitterTestResult.error || 'Connection failed'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => testTwitter.mutate()}
                  disabled={!twitterConfig.bearerToken || testTwitter.isPending}
                  data-testid="button-test-twitter"
                >
                  {testTwitter.isPending ? "Testing..." : "Test Connection"}
                  <Play className="ml-2 h-4 w-4" />
                </Button>
              </div>
              {twitterTestResult && !twitterTestResult.success && twitterTestResult.hint && (
                <Alert className="bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{twitterTestResult.hint}</AlertDescription>
                </Alert>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="character" className="space-y-6">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>Core instructions defining the agent's purpose</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  value={character.systemPrompt}
                  onChange={(e) => setCharacter({ ...character, systemPrompt: e.target.value })}
                  className="min-h-[150px] font-mono text-sm"
                  data-testid="input-system-prompt"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personality & Style</CardTitle>
              <CardDescription>Define tone, style, and personality</CardDescription>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-style">Post Style</Label>
                <Textarea
                  id="post-style"
                  value={character.postStyle}
                  onChange={(e) => setCharacter({ ...character, postStyle: e.target.value })}
                  className="min-h-[60px]"
                />
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

          <Card>
            <CardHeader>
              <CardTitle>Message Examples</CardTitle>
              <CardDescription>Sample posts demonstrating the agent's style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {character.messageExamples.map((example, idx) => (
                <div key={idx} className="space-y-2">
                  <Label>Example {idx + 1}</Label>
                  <Textarea
                    value={example}
                    onChange={(e) => {
                      const newExamples = [...character.messageExamples];
                      newExamples[idx] = e.target.value;
                      setCharacter({ ...character, messageExamples: newExamples });
                    }}
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => setCharacter({ ...character, messageExamples: [...character.messageExamples, ""] })}
              >
                Add Example
              </Button>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Temperature</Label>
                  <span className="text-sm text-muted-foreground">{modelConfig.temperature[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={modelConfig.temperature}
                  onValueChange={(v) => setModelConfig({ ...modelConfig, temperature: v })}
                  max={2}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Max Tokens</Label>
                  <span className="text-sm text-muted-foreground">{modelConfig.maxTokens[0]}</span>
                </div>
                <Slider
                  value={modelConfig.maxTokens}
                  onValueChange={(v) => setModelConfig({ ...modelConfig, maxTokens: v })}
                  min={100}
                  max={4000}
                  step={100}
                />
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
                <Input
                  id="max-posts"
                  type="number"
                  value={behavior.maxPostsPerDay}
                  onChange={(e) => setBehavior({ ...behavior, maxPostsPerDay: e.target.value })}
                  disabled={!behavior.postingEnabled}
                />
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
                  onValueChange={(v) => setBehavior({ ...behavior, replyRate: v })}
                  max={100}
                  step={5}
                  disabled={!behavior.replyEnabled}
                />
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
              <CardTitle>Content Modules</CardTitle>
              <CardDescription>Enable or disable content types for this agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Crypto Commentary</Label>
                <Switch
                  checked={behavior.cryptoCommentary}
                  onCheckedChange={(v) => setBehavior({ ...behavior, cryptoCommentary: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Market Analysis</Label>
                <Switch
                  checked={behavior.marketAnalysis}
                  onCheckedChange={(v) => setBehavior({ ...behavior, marketAnalysis: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>News Commentary</Label>
                <Switch
                  checked={behavior.newsCommentary}
                  onCheckedChange={(v) => setBehavior({ ...behavior, newsCommentary: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Long-form Threads</Label>
                <Switch
                  checked={behavior.threads}
                  onCheckedChange={(v) => setBehavior({ ...behavior, threads: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          {/* Workflow Guide */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">How to Add Knowledge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">1</div>
                  <div>
                    <p className="font-medium">Set up API sources</p>
                    <p className="text-muted-foreground">Go to <Link href="/api-management" className="text-primary hover:underline">Knowledge Sources</Link> to configure APIs (news, crypto prices, etc.)</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">2</div>
                  <div>
                    <p className="font-medium">Test and fetch data</p>
                    <p className="text-muted-foreground">Test your API connection, then click "Ingest to Agent" to pull in fresh content</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">3</div>
                  <div>
                    <p className="font-medium">Review and approve</p>
                    <p className="text-muted-foreground">New content appears in "Review Queue" below - approve what you want your agent to know</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">4</div>
                  <div>
                    <p className="font-medium">Manage active knowledge</p>
                    <p className="text-muted-foreground">Approved entries appear in "Active Knowledge" and are used in conversations. Delete outdated items anytime.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KB Selection Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Knowledge Selection Settings
              </CardTitle>
              <CardDescription>Control how knowledge base entries are selected for posts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kb-max-entries">Max KB Entries Per Post</Label>
                <Input
                  id="kb-max-entries"
                  type="number"
                  min="1"
                  max="50"
                  value={kbSettings.maxEntries}
                  onChange={(e) => setKbSettings({ ...kbSettings, maxEntries: e.target.value })}
                  data-testid="input-kb-max-entries"
                />
                <p className="text-xs text-muted-foreground">Maximum number of KB entries to include when generating posts (default: 10)</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="kb-reuse-policy">Reuse Policy</Label>
                <Select
                  value={kbSettings.reusePolicy}
                  onValueChange={(v) => setKbSettings({ ...kbSettings, reusePolicy: v })}
                >
                  <SelectTrigger data-testid="select-kb-reuse-policy">
                    <SelectValue placeholder="Select reuse policy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never Reuse - Skip entries used in recent posts</SelectItem>
                    <SelectItem value="deprioritize">Deprioritize - Prefer unused entries but allow reuse</SelectItem>
                    <SelectItem value="allow">Allow - No restrictions on reuse</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How to handle KB entries that have already been used in posts</p>
              </div>
              
              {kbSettings.reusePolicy !== "allow" && (
                <div className="space-y-2">
                  <Label htmlFor="kb-cooldown">Cooldown Period (Hours)</Label>
                  <Input
                    id="kb-cooldown"
                    type="number"
                    min="1"
                    max="168"
                    value={kbSettings.reuseCooldownHours}
                    onChange={(e) => setKbSettings({ ...kbSettings, reuseCooldownHours: e.target.value })}
                    data-testid="input-kb-cooldown"
                  />
                  <p className="text-xs text-muted-foreground">Hours to wait before allowing an entry to be reused</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* KB Auto-Refresh Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Auto-Refresh Settings
              </CardTitle>
              <CardDescription>Automatically refresh knowledge base entries from API sources</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Auto-Refresh</Label>
                  <p className="text-xs text-muted-foreground">Automatically refresh KB entries from custom APIs on a schedule</p>
                </div>
                <Switch
                  checked={kbSettings.autoRefreshEnabled}
                  onCheckedChange={(checked) => setKbSettings({ ...kbSettings, autoRefreshEnabled: checked })}
                  data-testid="switch-kb-auto-refresh"
                />
              </div>
              
              {kbSettings.autoRefreshEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="kb-refresh-interval">Refresh Interval (Hours)</Label>
                  <Input
                    id="kb-refresh-interval"
                    type="number"
                    min="1"
                    max="168"
                    value={kbSettings.autoRefreshIntervalHours}
                    onChange={(e) => setKbSettings({ ...kbSettings, autoRefreshIntervalHours: e.target.value })}
                    data-testid="input-kb-refresh-interval"
                  />
                  <p className="text-xs text-muted-foreground">How often to refresh KB entries from API sources (e.g., 6 = every 6 hours)</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* KB Priority Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Priority Rules
              </CardTitle>
              <CardDescription>Automatically adjust KB entry priorities based on rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Priority Rules</Label>
                  <p className="text-xs text-muted-foreground">Automatically update priority tags based on conditions</p>
                </div>
                <Switch
                  checked={kbSettings.priorityRuleEnabled}
                  onCheckedChange={(checked) => setKbSettings({ ...kbSettings, priorityRuleEnabled: checked })}
                  data-testid="switch-kb-priority-rules"
                />
              </div>
              
              {kbSettings.priorityRuleEnabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="kb-priority-rule">Priority Rule</Label>
                    <Textarea
                      id="kb-priority-rule"
                      placeholder="e.g., if content contains 'breaking' then priority 10&#10;if content contains 'news' then priority 8"
                      className="min-h-[80px]"
                      value={kbSettings.priorityRule}
                      onChange={(e) => setKbSettings({ ...kbSettings, priorityRule: e.target.value })}
                      data-testid="input-kb-priority-rule"
                    />
                    <p className="text-xs text-muted-foreground">
                      Define rules to auto-assign priorities (1-10, higher = more important).
                      <br />
                      Format: <code className="bg-muted px-1 rounded">if content contains 'keyword' then priority N</code>
                    </p>
                  </div>
                  <Button
                    onClick={handleApplyPriorityRules}
                    disabled={isApplyingPriorityRules || !kbSettings.priorityRule.trim()}
                    data-testid="button-apply-priority-rules"
                  >
                    {isApplyingPriorityRules ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Apply Priority Rules Now
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Data Sources & Refresh Controls */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">API Data Sources</CardTitle>
                  <CardDescription>Refresh knowledge from configured API sources</CardDescription>
                </div>
                <Link href="/api-management">
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Manage Sources
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {customApis.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-2">No API sources configured</p>
                  <p className="text-sm">
                    <Link href="/api-management" className="text-primary hover:underline">
                      Add API sources
                    </Link>
                    {" "}to automatically fetch knowledge for this agent
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customApis.map((api: any) => (
                    <div
                      key={api.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{api.name}</h4>
                          <Badge variant="outline" className="text-xs">{api.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{api.description}</p>
                        {api.endpoint && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{api.endpoint}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRefreshAPI(api.id)}
                        disabled={refreshingApiId === api.id}
                        data-testid={`button-refresh-${api.id}`}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${refreshingApiId === api.id ? 'animate-spin' : ''}`} />
                        {refreshingApiId === api.id ? "Refreshing..." : "Refresh"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs value={kbSubtab} onValueChange={(v) => setKbSubtab(v as "review" | "active")} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="review" data-testid="tab-kb-review">
                  Review Queue ({pendingKB.length})
                </TabsTrigger>
                <TabsTrigger value="active" data-testid="tab-kb-active">
                  Active Knowledge ({approvedKB.length})
                </TabsTrigger>
              </TabsList>
              <Dialog open={isAddKBDialogOpen} onOpenChange={setIsAddKBDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Knowledge Entry</DialogTitle>
                    <DialogDescription>Add knowledge (will be approved automatically)</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="kb-title">Title</Label>
                        <Input
                          id="kb-title"
                          value={newKBEntry.title}
                          onChange={(e) => setNewKBEntry({ ...newKBEntry, title: e.target.value })}
                          placeholder="Entry title..."
                          data-testid="input-kb-title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kb-category">Category</Label>
                        <Select
                          value={newKBEntry.category}
                          onValueChange={(value) => setNewKBEntry({ ...newKBEntry, category: value })}
                        >
                          <SelectTrigger data-testid="select-kb-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="crypto">Crypto</SelectItem>
                            <SelectItem value="theology">Theology</SelectItem>
                            <SelectItem value="narratives">Narratives</SelectItem>
                            <SelectItem value="solana">Solana</SelectItem>
                            <SelectItem value="mental_models">Mental Models</SelectItem>
                            <SelectItem value="memes">Memes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="kb-content">Content</Label>
                      <Textarea
                        id="kb-content"
                        value={newKBEntry.content}
                        onChange={(e) => setNewKBEntry({ ...newKBEntry, content: e.target.value })}
                        placeholder="Knowledge content..."
                        className="min-h-[120px] font-mono text-sm"
                        data-testid="textarea-kb-content"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="kb-tags">Tags (comma-separated)</Label>
                      <Input
                        id="kb-tags"
                        value={newKBEntry.tags}
                        onChange={(e) => setNewKBEntry({ ...newKBEntry, tags: e.target.value })}
                        placeholder="tag1, tag2, tag3"
                        data-testid="input-kb-tags"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Priority: {newKBEntry.priority}</Label>
                          <span className="text-xs text-muted-foreground">1 (low) - 10 (high)</span>
                        </div>
                        <Slider
                          value={[newKBEntry.priority]}
                          onValueChange={([value]) => setNewKBEntry({ ...newKBEntry, priority: value })}
                          min={1}
                          max={10}
                          step={1}
                          data-testid="slider-kb-priority"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kb-refresh">Refresh Strategy</Label>
                        <Select
                          value={newKBEntry.refreshStrategy}
                          onValueChange={(value) => setNewKBEntry({ ...newKBEntry, refreshStrategy: value })}
                        >
                          <SelectTrigger data-testid="select-kb-refresh">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Static (Never refresh)</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="on_demand">On Demand</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <Label htmlFor="kb-active" className="cursor-pointer">Active (Include in generations)</Label>
                      <Switch
                        id="kb-active"
                        checked={newKBEntry.active}
                        onCheckedChange={(checked) => setNewKBEntry({ ...newKBEntry, active: checked })}
                        data-testid="switch-kb-active"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddKBDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={handleAddKBEntry}
                      disabled={addKBMutation.isPending}
                      data-testid="button-add-kb-entry"
                    >
                      {addKBMutation.isPending ? "Adding..." : "Add Entry"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Edit KB Entry Dialog */}
              <Dialog open={isEditKBDialogOpen} onOpenChange={setIsEditKBDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Knowledge Entry</DialogTitle>
                    <DialogDescription>Update the content and settings for this entry</DialogDescription>
                  </DialogHeader>
                  {editingKBEntry && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-kb-title">Title</Label>
                          <Input
                            id="edit-kb-title"
                            value={editingKBEntry.title}
                            onChange={(e) => setEditingKBEntry({ ...editingKBEntry, title: e.target.value })}
                            placeholder="Entry title..."
                            data-testid="input-edit-kb-title"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-kb-category">Category</Label>
                          <Select
                            value={editingKBEntry.category}
                            onValueChange={(value) => setEditingKBEntry({ ...editingKBEntry, category: value })}
                          >
                            <SelectTrigger data-testid="select-edit-kb-category">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="crypto">Crypto</SelectItem>
                              <SelectItem value="theology">Theology</SelectItem>
                              <SelectItem value="narratives">Narratives</SelectItem>
                              <SelectItem value="solana">Solana</SelectItem>
                              <SelectItem value="mental_models">Mental Models</SelectItem>
                              <SelectItem value="memes">Memes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="edit-kb-content">Content</Label>
                        <Textarea
                          id="edit-kb-content"
                          value={editingKBEntry.content}
                          onChange={(e) => setEditingKBEntry({ ...editingKBEntry, content: e.target.value })}
                          placeholder="Knowledge content..."
                          className="min-h-[120px] font-mono text-sm"
                          data-testid="textarea-edit-kb-content"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Priority: {editingKBEntry.priority >= 8 ? "High" : editingKBEntry.priority >= 5 ? "Medium" : "Low"} ({editingKBEntry.priority})</Label>
                          <Slider
                            value={[editingKBEntry.priority]}
                            onValueChange={([value]) => setEditingKBEntry({ ...editingKBEntry, priority: value })}
                            min={1}
                            max={10}
                            step={1}
                            data-testid="slider-edit-kb-priority"
                          />
                          <p className="text-xs text-muted-foreground">1-4: Low, 5-7: Medium, 8-10: High</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-kb-refresh">Refresh Strategy</Label>
                          <Select
                            value={editingKBEntry.refreshStrategy}
                            onValueChange={(value) => setEditingKBEntry({ ...editingKBEntry, refreshStrategy: value })}
                          >
                            <SelectTrigger data-testid="select-edit-kb-refresh">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="static">Static (Never refresh)</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="on_demand">On Demand</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                        <Label htmlFor="edit-kb-active" className="cursor-pointer">Active (Include in generations)</Label>
                        <Switch
                          id="edit-kb-active"
                          checked={editingKBEntry.active}
                          onCheckedChange={(checked) => setEditingKBEntry({ ...editingKBEntry, active: checked })}
                          data-testid="switch-edit-kb-active"
                        />
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setIsEditKBDialogOpen(false);
                      setEditingKBEntry(null);
                    }}>Cancel</Button>
                    <Button
                      onClick={() => {
                        if (editingKBEntry) {
                          updateKBMutation.mutate({
                            entryId: editingKBEntry.id,
                            data: {
                              title: editingKBEntry.title,
                              content: editingKBEntry.content,
                              category: editingKBEntry.category,
                              priority: editingKBEntry.priority,
                              active: editingKBEntry.active,
                              refreshStrategy: editingKBEntry.refreshStrategy,
                            }
                          });
                        }
                      }}
                      disabled={updateKBMutation.isPending}
                      data-testid="button-save-kb-entry"
                    >
                      {updateKBMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Review Queue Tab */}
            <TabsContent value="review" className="space-y-4">
              {selectedKBIds.size > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm font-medium">{selectedKBIds.size} selected</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleBatchApprove}
                        disabled={batchApproveMutation.isPending}
                        data-testid="button-batch-approve"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {batchApproveMutation.isPending ? "Approving..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleBatchArchive}
                        disabled={batchArchiveMutation.isPending}
                        data-testid="button-batch-archive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {batchArchiveMutation.isPending ? "Archiving..." : "Archive"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Pending Entries</CardTitle>
                      <CardDescription>Review and approve ingested data before activation</CardDescription>
                    </div>
                    {pendingKB.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectAllKB(pendingKB)}
                        data-testid="button-select-all"
                      >
                        {selectedKBIds.size === pendingKB.length ? "Deselect All" : "Select All"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingKB.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No pending entries. Ingest data from Custom APIs to review.</p>
                    </div>
                  ) : (
                    pendingKB.map((entry) => (
                      <div key={entry.id} className="p-3 border rounded-lg space-y-2 hover-elevate" data-testid={`kb-entry-${entry.id}`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedKBIds.has(entry.id)}
                            onChange={() => handleToggleKBSelection(entry.id)}
                            className="mt-1"
                            data-testid={`checkbox-kb-${entry.id}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium">{entry.title}</h4>
                              <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{entry.content}</p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {entry.tags?.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                              {entry.source && (
                                <Badge variant="outline" className="text-xs">Source: {entry.source}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Active Knowledge Tab */}
            <TabsContent value="active" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Knowledge</CardTitle>
                  <CardDescription>Approved entries used in agent conversations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {approvedKB.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No active knowledge entries yet. Approve pending entries or add manually.</p>
                    </div>
                  ) : (
                    approvedKB.map((entry) => (
                      <div key={entry.id} className="p-3 border rounded-lg space-y-2" data-testid={`active-kb-entry-${entry.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium">{entry.title}</h4>
                              <div className="flex gap-1">
                                <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                                {entry.active ? (
                                  <Badge variant="default" className="text-xs">Active</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{entry.content}</p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {entry.tags?.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                              <Badge variant="outline" className="text-xs">
                                Priority: {entry.priority >= 8 ? "High" : entry.priority >= 5 ? "Medium" : "Low"} ({entry.priority})
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteKBEntry(entry.id)}
                              data-testid={`button-delete-kb-${entry.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

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
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
