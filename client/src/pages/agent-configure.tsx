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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, AlertCircle, CheckCircle2, XCircle, Eye, EyeOff, Play } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function AgentConfigure() {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Twitter API Credentials (All Required)
  const [twitterConfig, setTwitterConfig] = useState({
    apiKey: "",
    apiKeySecret: "",
    accessToken: "",
    accessTokenSecret: "",
    bearerToken: "",
    appId: "",
  });
  
  // Character Configuration
  const [character, setCharacter] = useState({
    name: "CryptoAnalyst",
    username: "@cryptoanalyst_ai",
    description: "AI-powered cryptocurrency analyst providing market insights and analysis",
    bio: "Cryptocurrency analyst powered by AI. Providing data-driven insights on Bitcoin, Ethereum, and DeFi. Not financial advice. DYOR.",
  });
  
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
  });
  
  // Posting Configuration
  const [postingConfig, setPostingConfig] = useState({
    enabled: true,
    frequency: "2",
    interval: "hours",
    maxPostsPerDay: "12",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  });
  
  // Reply Configuration
  const [replyConfig, setReplyConfig] = useState({
    enabled: true,
    replyRate: [70],
    replyDelay: [30],
    maxRepliesPerHour: "10",
    onlyVerified: false,
    keywordTriggers: "bitcoin, crypto, defi, blockchain",
    ignoreKeywords: "spam, scam, airdrop",
  });
  
  // Content Modules
  const [modules, setModules] = useState({
    cryptoCommentary: true,
    marketAnalysis: true,
    newsCommentary: true,
    technicalAnalysis: false,
    threads: true,
    memes: false,
  });

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskSecret = (secret: string) => {
    if (!secret) return "";
    if (secret.length <= 8) return "•".repeat(secret.length);
    return secret.substring(0, 8) + "•".repeat(Math.max(12, secret.length - 8));
  };

  const handleSave = () => {
    console.log("Saving agent configuration:", {
      twitter: twitterConfig,
      character,
      model: modelConfig,
      posting: postingConfig,
      reply: replyConfig,
      modules,
    });
    
    toast({
      title: "Configuration saved",
      description: "Agent configuration has been updated successfully.",
    });
  };

  const handleTestDeploy = () => {
    toast({
      title: "Deploying to test environment",
      description: "Agent is being deployed to playground for testing...",
    });
  };

  // Validation checks
  const twitterComplete = Object.values(twitterConfig).every(v => v !== "");
  const modelComplete = modelConfig.apiKey !== "";
  const characterComplete = character.name && character.username;
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
            Configure Agent: {character.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete agent configuration for deployment
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
            Save Configuration
          </Button>
        </div>
      </div>

      {!isConfigurationComplete && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Configuration Incomplete:</strong> Please complete all required fields before deploying.
            {!twitterComplete && <span className="block mt-1">• Twitter API credentials required</span>}
            {!modelComplete && <span className="block mt-1">• AI model API key required</span>}
            {!characterComplete && <span className="block mt-1">• Character name and username required</span>}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="twitter" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="twitter">
            Twitter API
            {twitterComplete ? <CheckCircle2 className="ml-2 h-3 w-3" /> : <XCircle className="ml-2 h-3 w-3" />}
          </TabsTrigger>
          <TabsTrigger value="character">Character</TabsTrigger>
          <TabsTrigger value="model">AI Model</TabsTrigger>
          <TabsTrigger value="posting">Posting</TabsTrigger>
          <TabsTrigger value="replies">Replies</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
        </TabsList>

        <TabsContent value="twitter" className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Required:</strong> All Twitter API credentials are required for the agent to post and interact.
              Get your credentials from{" "}
              <a
                href="https://developer.twitter.com/en/portal/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Twitter Developer Portal
              </a>
              .
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Twitter API v2 Credentials</CardTitle>
              <CardDescription>
                All fields are required. Create an app with Read and Write permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="twitter-app-id">App ID</Label>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
                <Input
                  id="twitter-app-id"
                  value={twitterConfig.appId}
                  onChange={(e) => setTwitterConfig({ ...twitterConfig, appId: e.target.value })}
                  placeholder="Your Twitter App ID"
                  className="font-mono text-sm"
                  data-testid="input-twitter-app-id"
                />
                <p className="text-xs text-muted-foreground">
                  Found in Developer Portal → Your App → Keys and tokens
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="twitter-api-key">API Key (Consumer Key)</Label>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowSecret("apiKey")}
                    data-testid="button-toggle-api-key"
                  >
                    {showSecrets.apiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="twitter-api-secret">API Key Secret (Consumer Secret)</Label>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowSecret("apiKeySecret")}
                  >
                    {showSecrets.apiKeySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="twitter-access-token">Access Token</Label>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowSecret("accessToken")}
                  >
                    {showSecrets.accessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate with Read and Write permissions
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="twitter-access-secret">Access Token Secret</Label>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowSecret("accessTokenSecret")}
                  >
                    {showSecrets.accessTokenSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="twitter-bearer">Bearer Token</Label>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowSecret("bearerToken")}
                  >
                    {showSecrets.bearerToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for read-only operations and monitoring mentions
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="font-medium">1. Create a Twitter Developer Account</p>
                <p className="text-muted-foreground">
                  Go to{" "}
                  <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer" className="underline">
                    developer.twitter.com
                  </a>{" "}
                  and sign up
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">2. Create a New App</p>
                <p className="text-muted-foreground">
                  In the Developer Portal, create a new app with "Read and Write" permissions
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">3. Generate Keys and Tokens</p>
                <p className="text-muted-foreground">
                  Navigate to "Keys and tokens" tab and generate all required credentials
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">4. Copy Credentials to This Form</p>
                <p className="text-muted-foreground">
                  Paste each credential into the corresponding field above
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="character" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Character Profile</CardTitle>
              <CardDescription>Define the agent's identity and personality</CardDescription>
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
                <Label htmlFor="char-desc">Description (Internal)</Label>
                <Textarea
                  id="char-desc"
                  value={character.description}
                  onChange={(e) => setCharacter({ ...character, description: e.target.value })}
                  placeholder="Internal description of agent's purpose"
                  className="min-h-[80px]"
                  data-testid="input-char-desc"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="char-bio">Twitter Bio (Public)</Label>
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
                    {modelConfig.provider === "openai" && (
                      <>
                        <SelectItem value="gpt-4-turbo-preview">GPT-4 Turbo</SelectItem>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      </>
                    )}
                    {modelConfig.provider === "anthropic" && (
                      <>
                        <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                        <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                      </>
                    )}
                    {modelConfig.provider === "groq" && (
                      <>
                        <SelectItem value="mixtral-8x7b">Mixtral 8x7B</SelectItem>
                        <SelectItem value="llama2-70b">Llama 2 70B</SelectItem>
                      </>
                    )}
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowSecret("modelApiKey")}
                  >
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
                  data-testid="slider-temperature"
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
                  data-testid="slider-max-tokens"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Posting Schedule</CardTitle>
              <CardDescription>Configure when and how often the agent posts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="posting-enabled">Enable Automated Posting</Label>
                  <p className="text-xs text-muted-foreground">Allow agent to post automatically</p>
                </div>
                <Switch
                  id="posting-enabled"
                  checked={postingConfig.enabled}
                  onCheckedChange={(v) => setPostingConfig({ ...postingConfig, enabled: v })}
                  data-testid="switch-posting-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>Post Frequency</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={postingConfig.frequency}
                    onChange={(e) => setPostingConfig({ ...postingConfig, frequency: e.target.value })}
                    min="1"
                    className="w-24"
                    disabled={!postingConfig.enabled}
                  />
                  <Select
                    value={postingConfig.interval}
                    onValueChange={(v) => setPostingConfig({ ...postingConfig, interval: v })}
                    disabled={!postingConfig.enabled}
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
                  value={postingConfig.maxPostsPerDay}
                  onChange={(e) => setPostingConfig({ ...postingConfig, maxPostsPerDay: e.target.value })}
                  min="1"
                  max="100"
                  disabled={!postingConfig.enabled}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reply Behavior</CardTitle>
              <CardDescription>Configure how the agent responds to mentions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="replies-enabled">Enable Auto-Reply</Label>
                  <p className="text-xs text-muted-foreground">Automatically respond to mentions</p>
                </div>
                <Switch
                  id="replies-enabled"
                  checked={replyConfig.enabled}
                  onCheckedChange={(v) => setReplyConfig({ ...replyConfig, enabled: v })}
                  data-testid="switch-replies-enabled"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Reply Rate</Label>
                  <span className="text-sm text-muted-foreground">{replyConfig.replyRate[0]}%</span>
                </div>
                <Slider
                  value={replyConfig.replyRate}
                  onValueChange={(v) => setReplyConfig({ ...replyConfig, replyRate: v })}
                  max={100}
                  step={5}
                  disabled={!replyConfig.enabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keyword-triggers">Keyword Triggers (comma-separated)</Label>
                <Textarea
                  id="keyword-triggers"
                  value={replyConfig.keywordTriggers}
                  onChange={(e) => setReplyConfig({ ...replyConfig, keywordTriggers: e.target.value })}
                  placeholder="bitcoin, crypto, defi"
                  className="min-h-[80px]"
                  disabled={!replyConfig.enabled}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content Modules</CardTitle>
              <CardDescription>Enable or disable different content types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Crypto Commentary</Label>
                  <p className="text-xs text-muted-foreground">Market insights and analysis</p>
                </div>
                <Switch
                  checked={modules.cryptoCommentary}
                  onCheckedChange={(v) => setModules({ ...modules, cryptoCommentary: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Market Analysis</Label>
                  <p className="text-xs text-muted-foreground">Price trends and movements</p>
                </div>
                <Switch
                  checked={modules.marketAnalysis}
                  onCheckedChange={(v) => setModules({ ...modules, marketAnalysis: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>News Commentary</Label>
                  <p className="text-xs text-muted-foreground">React to breaking news</p>
                </div>
                <Switch
                  checked={modules.newsCommentary}
                  onCheckedChange={(v) => setModules({ ...modules, newsCommentary: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Long-form Threads</Label>
                  <p className="text-xs text-muted-foreground">Multi-tweet threads</p>
                </div>
                <Switch
                  checked={modules.threads}
                  onCheckedChange={(v) => setModules({ ...modules, threads: v })}
                />
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
          {!isConfigurationComplete && (
            <p className="text-sm text-muted-foreground">
              Complete all required fields to enable deployment
            </p>
          )}
        </div>
        <Button onClick={handleSave} size="lg" data-testid="button-save-all">
          <Save className="mr-2 h-4 w-4" />
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
