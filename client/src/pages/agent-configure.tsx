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
import { Save, AlertCircle, CheckCircle2, XCircle, Eye, EyeOff, Play, Plus, Trash2 } from "lucide-react";
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

  // AI Model API Test Mutation
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
  
  // Model Configuration
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

  // Knowledge Base (Per-Agent)
  const [knowledgeBase, setKnowledgeBase] = useState<KBEntry[]>([]);
  const [isAddKBDialogOpen, setIsAddKBDialogOpen] = useState(false);
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
        // Model
        modelProvider: modelConfig.provider,
        modelName: modelConfig.model,
        modelApiKey: modelConfig.apiKey,
        temperature: modelConfig.temperature[0],
        maxTokens: modelConfig.maxTokens[0],
        topP: modelConfig.topP[0],
        frequencyPenalty: modelConfig.frequencyPenalty[0],
        presencePenalty: modelConfig.presencePenalty[0],
        contextWindow: parseInt(modelConfig.contextWindow),
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
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={behavior.postFrequency}
                    onChange={(e) => setBehavior({ ...behavior, postFrequency: e.target.value })}
                    className="w-24"
                    disabled={!behavior.postingEnabled}
                  />
                  <Select
                    value={behavior.postInterval}
                    onValueChange={(v) => setBehavior({ ...behavior, postInterval: v })}
                    disabled={!behavior.postingEnabled}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                    <SelectItem value="America/New_York">Eastern (US)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific (US)</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>Knowledge specific to this agent ({knowledgeBase.length} entries)</CardDescription>
                </div>
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
                      <DialogDescription>Add knowledge specific to this agent with smart management</DialogDescription>
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
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {knowledgeBase.map((entry) => (
                <div key={entry.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium">{entry.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{entry.content}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {entry.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteKBEntry(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
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
  );
}
