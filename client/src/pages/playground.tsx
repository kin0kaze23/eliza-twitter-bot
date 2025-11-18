import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, RefreshCw, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type TestResult = {
  success: boolean;
  output: string;
  errors: string[];
  warnings: string[];
  timestamp: Date;
};

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function Playground() {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState("1");
  const [testPrompt, setTestPrompt] = useState("What's the current state of Bitcoin? Should I be bullish or bearish?");
  const [isGenerating, setIsGenerating] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  // Conversation mode state
  const [conversationMode, setConversationMode] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [conversationInput, setConversationInput] = useState("");
  
  const [configValidation, setConfigValidation] = useState({
    prompts: { valid: true, message: "All prompts configured" },
    apiKeys: { valid: false, message: "Twitter API key missing" },
    knowledge: { valid: true, message: "3 knowledge base entries" },
    schedule: { valid: true, message: "Post every 2 hours" },
    modules: { valid: true, message: "2 modules enabled" },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    setTestResult(null);
    
    // Simulate API call
    setTimeout(() => {
      const mockResult: TestResult = {
        success: true,
        output: "🚀 Bitcoin holding strong above $43k support! \n\nOn-chain metrics showing accumulation by long-term holders. Reduced exchange reserves suggest supply squeeze building.\n\n📊 Key levels to watch:\n• Resistance: $45.5k\n• Support: $42k\n\nBullish structure intact as long as we hold $42k. #BTC #Bitcoin",
        errors: [],
        warnings: [
          "Reply delay set to 0s - might appear bot-like",
        ],
        timestamp: new Date(),
      };
      
      setTestResult(mockResult);
      setIsGenerating(false);
      
      toast({
        title: "Test completed",
        description: "Tweet generated successfully with 1 warning.",
      });
    }, 3000);
  };

  const handleSendConversation = () => {
    if (!conversationInput.trim()) return;
    
    setIsGenerating(true);
    
    // Add user message
    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: "user",
      content: conversationInput,
      timestamp: new Date(),
    };
    
    setConversationHistory(prev => [...prev, userMessage]);
    setConversationInput("");
    
    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "Based on current market conditions, I see strong bullish signals. The on-chain data suggests accumulation by smart money.",
        "That's an interesting perspective! Looking at the technical analysis, we're approaching a critical resistance level.",
        "I agree. Historical patterns suggest this could be a turning point. Let me elaborate on the fundamentals...",
        "Great question! The macroeconomic factors we need to consider include: 1) Fed policy 2) Institutional adoption 3) Regulatory clarity",
      ];
      
      const aiMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };
      
      setConversationHistory(prev => [...prev, aiMessage]);
      setIsGenerating(false);
    }, 2000);
  };

  const handleResetConversation = () => {
    setConversationHistory([]);
    setConversationInput("");
    toast({
      title: "Conversation reset",
      description: "Started a new conversation session.",
    });
  };

  const handleValidateConfig = () => {
    // Simulate validation
    const newValidation = { ...configValidation };
    const hasIssues = Object.values(newValidation).some(v => !v.valid);
    
    toast({
      title: hasIssues ? "Configuration issues found" : "Configuration valid",
      description: hasIssues
        ? "Please fix the issues before deploying"
        : "Agent is ready to deploy",
      variant: hasIssues ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Testing Playground</h1>
        <p className="text-sm text-muted-foreground">
          Test your AI agent configuration before deployment
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Agent to Test</CardTitle>
          <CardDescription>Choose which agent configuration to test</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger data-testid="select-test-agent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">CryptoAnalyst (Active)</SelectItem>
              <SelectItem value="2">DeFiExpert (Draft)</SelectItem>
              <SelectItem value="3">NewsBot (Paused)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generate">Tweet Generation</TabsTrigger>
          <TabsTrigger value="conversation">Conversation Test</TabsTrigger>
          <TabsTrigger value="validation">Config Validation</TabsTrigger>
          <TabsTrigger value="debug">Debug Info</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Tweet Generation</CardTitle>
              <CardDescription>Provide a prompt to test how the agent would respond</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-prompt">Test Prompt</Label>
                <Textarea
                  id="test-prompt"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Enter a test prompt or scenario..."
                  className="min-h-[100px]"
                  data-testid="input-test-prompt"
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                data-testid="button-generate-test"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Test Tweet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {testResult && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Test Result</CardTitle>
                  <Badge variant={testResult.success ? "default" : "destructive"} className="gap-1">
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Success
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Failed
                      </>
                    )}
                  </Badge>
                </div>
                <CardDescription>
                  Generated at {testResult.timestamp.toLocaleTimeString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Generated Tweet</Label>
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{testResult.output}</p>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{testResult.output.length} characters</span>
                    <span>•</span>
                    <span>{testResult.output.split('\n').filter(l => l.trim()).length} lines</span>
                  </div>
                </div>

                {testResult.warnings.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-yellow-600">
                      <AlertCircle className="h-4 w-4" />
                      Warnings ({testResult.warnings.length})
                    </Label>
                    <div className="space-y-1">
                      {testResult.warnings.map((warning, idx) => (
                        <div key={idx} className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3 rounded text-sm">
                          {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {testResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-4 w-4" />
                      Errors ({testResult.errors.length})
                    </Label>
                    <div className="space-y-1">
                      {testResult.errors.map((error, idx) => (
                        <div key={idx} className="bg-destructive/10 border border-destructive/20 p-3 rounded text-sm">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="conversation" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Multi-Turn Conversation Test</CardTitle>
                  <CardDescription>Test the agent's ability to maintain context across multiple exchanges</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={handleResetConversation}
                  disabled={conversationHistory.length === 0}
                  data-testid="button-reset-conversation"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Conversation History */}
              <div className="border rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto space-y-4">
                {conversationHistory.length === 0 ? (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    <p>Start a conversation to test multi-turn context management</p>
                  </div>
                ) : (
                  conversationHistory.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${message.role}-${message.id}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {message.role === "user" ? "You" : "Agent"}
                          </span>
                          <span className="text-xs opacity-70">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input Area */}
              <div className="flex gap-2">
                <Textarea
                  value={conversationInput}
                  onChange={(e) => setConversationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendConversation();
                    }
                  }}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  className="min-h-[60px]"
                  disabled={isGenerating}
                  data-testid="input-conversation"
                />
                <Button
                  onClick={handleSendConversation}
                  disabled={isGenerating || !conversationInput.trim()}
                  size="icon"
                  className="h-[60px] w-[60px]"
                  data-testid="button-send-message"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{conversationHistory.length} messages</span>
                <span>•</span>
                <span>Press Enter to send, Shift+Enter for new line</span>
              </div>
            </CardContent>
          </Card>

          {conversationHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Conversation Analysis</CardTitle>
                <CardDescription>Context management and coherence metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Turns</p>
                    <p className="text-2xl font-bold">{conversationHistory.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">User Messages</p>
                    <p className="text-2xl font-bold">
                      {conversationHistory.filter(m => m.role === "user").length}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Agent Responses</p>
                    <p className="text-2xl font-bold">
                      {conversationHistory.filter(m => m.role === "assistant").length}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Context maintained across {Math.floor(conversationHistory.length / 2)} turns
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configuration Validation</CardTitle>
                  <CardDescription>Check if all required configurations are set correctly</CardDescription>
                </div>
                <Button variant="outline" onClick={handleValidateConfig} data-testid="button-validate">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-validate
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(configValidation).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-4 p-3 rounded border"
                  data-testid={`validation-${key}`}
                >
                  <div className="flex items-start gap-3">
                    {value.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                      <p className="text-sm text-muted-foreground">{value.message}</p>
                    </div>
                  </div>
                  <Badge variant={value.valid ? "default" : "destructive"}>
                    {value.valid ? "OK" : "Issue"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pre-Deployment Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>System prompt configured</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>At least one AI model API key set</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>Twitter API credentials (required for posting)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Posting schedule configured</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Safety guidelines set</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
              <CardDescription>Technical details about the agent configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Agent ID</Label>
                <code className="block bg-muted p-2 rounded text-sm font-mono">agent_1_cryptoanalyst</code>
              </div>
              <div className="space-y-2">
                <Label>Active Model</Label>
                <code className="block bg-muted p-2 rounded text-sm font-mono">openai/gpt-4-turbo-preview</code>
              </div>
              <div className="space-y-2">
                <Label>Context Window</Label>
                <code className="block bg-muted p-2 rounded text-sm font-mono">8000 tokens</code>
              </div>
              <div className="space-y-2">
                <Label>Model Parameters</Label>
                <pre className="bg-muted p-3 rounded text-xs font-mono overflow-auto">
{`{
  "temperature": 0.7,
  "max_tokens": 500,
  "top_p": 0.9,
  "frequency_penalty": 0.5,
  "presence_penalty": 0.5
}`}
                </pre>
              </div>
              <div className="space-y-2">
                <Label>Active Modules</Label>
                <div className="flex gap-2 flex-wrap">
                  <Badge>Crypto Commentary</Badge>
                  <Badge>Market Analysis</Badge>
                  <Badge>Threads</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Knowledge Base Entries</Label>
                <code className="block bg-muted p-2 rounded text-sm font-mono">3 entries loaded</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
