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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@shared/schema";

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
  
  // Fetch all agents
  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });
  
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(agents?.[0]?.id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  // Conversation mode state
  const [conversationMode, setConversationMode] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [conversationInput, setConversationInput] = useState("");
  
  // Set first agent as selected when agents load
  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].id);
    }
  }, [agents, selectedAgent]);
  
  const [configValidation, setConfigValidation] = useState({
    prompts: { valid: false, message: "Not validated yet" },
    apiKeys: { valid: false, message: "Not validated yet" },
    knowledge: { valid: false, message: "Not validated yet" },
    twitterCredentials: { valid: false, message: "Not validated yet" },
    schedule: { valid: false, message: "Not validated yet" },
  });

  // Get currently selected agent
  const currentAgent = agents?.find(a => a.id === selectedAgent);

  // Auto-validate when agent changes
  useEffect(() => {
    if (currentAgent) {
      validateConfig(currentAgent);
    }
  }, [currentAgent]);

  const handleGenerate = async () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setTestResult(null);
    
    try {
      const response = await fetch("/api/playground/test-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent,
          // No prompt provided - auto-generate from KB
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate tweet");
      }

      const data = await response.json();
      
      const result: TestResult = {
        success: data.success,
        output: data.tweet,
        errors: [],
        warnings: [],
        timestamp: new Date(),
      };
      
      // Store KB sources for display
      (result as any).kbSources = data.kbSources || [];
      (result as any).kbEntriesCount = data.kbEntriesCount || 0;
      (result as any).mode = data.mode;
      
      setTestResult(result);
      
      toast({
        title: "Tweet Generated",
        description: `${data.mode === "auto-generated" ? "Auto-generated" : "Generated"} using ${data.kbEntriesCount} KB entries`,
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate tweet",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendConversation = async () => {
    if (!conversationInput.trim() || !selectedAgent) return;
    
    setIsGenerating(true);
    
    // Add user message
    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: "user",
      content: conversationInput,
      timestamp: new Date(),
    };
    
    const updatedHistory = [...conversationHistory, userMessage];
    setConversationHistory(updatedHistory);
    const currentInput = conversationInput;
    setConversationInput("");
    
    try {
      // Call backend with conversation context
      const response = await fetch(`/api/agents/${selectedAgent}/test/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          conversationHistory: updatedHistory.slice(-10), // Last 10 messages for context
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to get response");
      }
      
      const data = await response.json();
      
      const aiMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(data.timestamp),
      };
      
      setConversationHistory(prev => [...prev, aiMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get agent response. Please try again.",
        variant: "destructive",
      });
      
      // Remove the user message if request failed
      setConversationHistory(conversationHistory);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetConversation = () => {
    setConversationHistory([]);
    setConversationInput("");
    toast({
      title: "Conversation reset",
      description: "Started a new conversation session.",
    });
  };

  const validateConfig = (agent: Agent) => {
    // Check if posting is enabled and has valid frequency
    const postingValid = agent.postingEnabled && agent.postFrequency && agent.postFrequency > 0;
    
    const validation = {
      prompts: {
        valid: !!(agent.systemPrompt || agent.personalityPrompt),
        message: (agent.systemPrompt || agent.personalityPrompt) 
          ? "System or personality prompt configured"
          : "Missing system prompt or personality prompt - configure in Agent → Prompts tab"
      },
      apiKeys: {
        valid: !!(agent.modelProvider && agent.modelName),
        message: (agent.modelProvider && agent.modelName)
          ? `${agent.modelProvider}/${agent.modelName} configured (ensure API key is set in environment)`
          : "Model provider or model name missing - configure in Agent → Model tab"
      },
      twitterCredentials: {
        valid: !!(agent.twitterApiKey && agent.twitterApiSecret && agent.twitterAccessToken && agent.twitterAccessSecret),
        message: (agent.twitterApiKey && agent.twitterApiSecret && agent.twitterAccessToken && agent.twitterAccessSecret)
          ? "All Twitter OAuth 1.0a credentials configured"
          : "Missing Twitter API credentials - configure in Agent → Credentials tab"
      },
      schedule: {
        valid: postingValid,
        message: postingValid
          ? `Auto-posting enabled: ${agent.postFrequency} tweets per hour`
          : agent.postingEnabled 
            ? "Posting enabled but frequency not set - configure in Agent → Behavior tab"
            : "Auto-posting disabled - enable in Agent → Behavior tab if needed"
      },
    };
    
    setConfigValidation(validation);
  };

  const handleValidateConfig = () => {
    if (currentAgent) {
      validateConfig(currentAgent);
      
      const hasIssues = Object.values(configValidation).some(v => !v.valid);
      
      toast({
        title: hasIssues ? "Configuration issues found" : "Configuration valid",
        description: hasIssues
          ? "Please fix the issues before deploying"
          : "Agent is ready to deploy",
        variant: hasIssues ? "destructive" : "default",
      });
    }
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
          {agentsLoading ? (
            <div className="text-sm text-muted-foreground">Loading agents...</div>
          ) : agents && agents.length > 0 ? (
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger data-testid="select-test-agent">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} ({agent.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground">
              No agents found. Create an agent first.
            </div>
          )}
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
              <CardDescription>Auto-generates tweets from active knowledge base entries using the agent's AI model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Click the button below to test tweet generation. The agent will automatically create a tweet based on your active knowledge base entries.
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedAgent}
                data-testid="button-generate-test"
                size="lg"
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
              {!selectedAgent && (
                <p className="text-xs text-muted-foreground text-yellow-600">
                  Please select an agent above to generate a tweet
                </p>
              )}
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

                {/* KB Sources Used */}
                {(testResult as any).kbSources && (testResult as any).kbSources.length > 0 && (
                  <div className="space-y-2">
                    <Label>Knowledge Sources Used ({(testResult as any).kbEntriesCount})</Label>
                    <div className="space-y-2">
                      {(testResult as any).kbSources.map((source: any, idx: number) => (
                        <div key={idx} className="bg-muted/50 border border-border p-3 rounded-md text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium">{source.title}</p>
                              <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                                {source.source && <span>Source: {source.source}</span>}
                                {source.category && (
                                  <>
                                    <span>•</span>
                                    <span>Category: {source.category}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              Priority: {source.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(testResult as any).mode === "auto-generated" && (
                      <p className="text-xs text-muted-foreground">
                        🤖 This tweet was auto-generated using the above knowledge sources
                      </p>
                    )}
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
              {currentAgent ? (
                <>
                  <div className="space-y-2">
                    <Label>Agent ID</Label>
                    <code className="block bg-muted p-2 rounded text-sm font-mono">{currentAgent.id}</code>
                  </div>
                  <div className="space-y-2">
                    <Label>Agent Name</Label>
                    <code className="block bg-muted p-2 rounded text-sm font-mono">{currentAgent.name} (@{currentAgent.username})</code>
                  </div>
                  <div className="space-y-2">
                    <Label>Active Model</Label>
                    <code className="block bg-muted p-2 rounded text-sm font-mono">
                      {currentAgent.modelProvider || 'Not set'}/{currentAgent.modelName || 'Not set'}
                    </code>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <code className="block bg-muted p-2 rounded text-sm font-mono">{currentAgent.maxTokens || 'Not set'} tokens</code>
                  </div>
                  <div className="space-y-2">
                    <Label>Model Parameters</Label>
                    <pre className="bg-muted p-3 rounded text-xs font-mono overflow-auto">
{JSON.stringify({
  temperature: currentAgent.temperature ?? 'Not set',
  maxTokens: currentAgent.maxTokens ?? 'Not set',
  topP: currentAgent.topP ?? 'Not set',
  frequencyPenalty: currentAgent.frequencyPenalty ?? 'Not set',
  presencePenalty: currentAgent.presencePenalty ?? 'Not set'
}, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <Label>Posting Schedule</Label>
                    <code className="block bg-muted p-2 rounded text-sm font-mono">
                      {currentAgent.postFrequency ? `${currentAgent.postFrequency} posts/hour` : 'Not configured'}
                    </code>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <code className="block bg-muted p-2 rounded text-sm font-mono">
                      {currentAgent.status || 'draft'}
                    </code>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select an agent to view debug info</p>
              )}
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
