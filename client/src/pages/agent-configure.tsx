import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type KBEntry = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

type CustomPrompt = {
  id: string;
  key: string;
  value: string;
};

export default function AgentConfigure() {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Twitter API Credentials
  const [twitterConfig, setTwitterConfig] = useState({
    apiKey: "",
    apiKeySecret: "",
    accessToken: "",
    accessTokenSecret: "",
    bearerToken: "",
    appId: "",
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
  const [knowledgeBase, setKnowledgeBase] = useState<KBEntry[]>([
    {
      id: "1",
      title: "Bitcoin Basics",
      content: "Bitcoin is a decentralized digital currency that operates on a peer-to-peer network without central authority. Key features: limited supply (21M), proof-of-work consensus, blockchain ledger.",
      tags: ["bitcoin", "cryptocurrency", "blockchain"],
    },
  ]);
  const [isAddKBDialogOpen, setIsAddKBDialogOpen] = useState(false);
  const [newKBEntry, setNewKBEntry] = useState({ title: "", content: "", tags: "" });

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskSecret = (secret: string) => {
    if (!secret) return "";
    if (secret.length <= 8) return "•".repeat(secret.length);
    return secret.substring(0, 8) + "•".repeat(Math.max(12, secret.length - 8));
  };

  const handleAddKBEntry = () => {
    if (!newKBEntry.title || !newKBEntry.content) return;
    
    const entry: KBEntry = {
      id: Date.now().toString(),
      title: newKBEntry.title,
      content: newKBEntry.content,
      tags: newKBEntry.tags.split(",").map(t => t.trim()).filter(Boolean),
    };
    
    setKnowledgeBase([...knowledgeBase, entry]);
    setNewKBEntry({ title: "", content: "", tags: "" });
    setIsAddKBDialogOpen(false);
    
    toast({
      title: "Knowledge entry added",
      description: "Entry has been added to this agent's knowledge base.",
    });
  };

  const handleDeleteKBEntry = (id: string) => {
    setKnowledgeBase(knowledgeBase.filter(e => e.id !== id));
    toast({ title: "Entry deleted" });
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

  const handleSave = () => {
    // Convert custom prompts to JSON format
    const customPromptsObj = customPrompts.reduce((acc, prompt) => {
      acc[prompt.key] = prompt.value;
      return acc;
    }, {} as Record<string, string>);
    
    console.log("Saving complete agent configuration:", {
      twitter: twitterConfig,
      character,
      custom_prompts: customPromptsObj,
      model: modelConfig,
      behavior,
      knowledgeBase,
    });
    
    toast({
      title: "Configuration saved",
      description: "All agent settings have been updated successfully.",
    });
  };

  // Validation
  const twitterComplete = Object.values(twitterConfig).every(v => v !== "");
  const modelComplete = modelConfig.apiKey !== "";
  const characterComplete = character.name && character.username && character.systemPrompt;
  const isConfigurationComplete = twitterComplete && modelComplete && characterComplete;

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
            </CardContent>
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
                <Select value={modelConfig.provider} onValueChange={(v) => setModelConfig({ ...modelConfig, provider: v })}>
                  <SelectTrigger id="model-provider" data-testid="select-model-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-name">Model</Label>
                <Select value={modelConfig.model} onValueChange={(v) => setModelConfig({ ...modelConfig, model: v })}>
                  <SelectTrigger id="model-name" data-testid="select-model-name">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4-turbo-preview">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
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
                    placeholder="Enter model API key..."
                    className="font-mono text-sm"
                    data-testid="input-model-api-key"
                  />
                  <Button variant="outline" size="icon" onClick={() => toggleShowSecret("modelApiKey")}>
                    {showSecrets.modelApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
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
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Knowledge Entry</DialogTitle>
                      <DialogDescription>Add knowledge specific to this agent</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="kb-title">Title</Label>
                        <Input
                          id="kb-title"
                          value={newKBEntry.title}
                          onChange={(e) => setNewKBEntry({ ...newKBEntry, title: e.target.value })}
                          placeholder="Entry title..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kb-content">Content</Label>
                        <Textarea
                          id="kb-content"
                          value={newKBEntry.content}
                          onChange={(e) => setNewKBEntry({ ...newKBEntry, content: e.target.value })}
                          placeholder="Knowledge content..."
                          className="min-h-[150px] font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kb-tags">Tags (comma-separated)</Label>
                        <Input
                          id="kb-tags"
                          value={newKBEntry.tags}
                          onChange={(e) => setNewKBEntry({ ...newKBEntry, tags: e.target.value })}
                          placeholder="tag1, tag2, tag3"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddKBDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddKBEntry}>Add Entry</Button>
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
        <Button onClick={handleSave} size="lg" data-testid="button-save-all">
          <Save className="mr-2 h-4 w-4" />
          Save All Configuration
        </Button>
      </div>
    </div>
  );
}
