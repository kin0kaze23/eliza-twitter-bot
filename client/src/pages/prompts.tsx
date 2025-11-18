import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Save } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Prompts() {
  const { toast } = useToast();
  
  // Character & System Prompts
  const [characterName, setCharacterName] = useState("ElizaBot");
  const [bio, setBio] = useState("An AI agent specialized in cryptocurrency analysis and blockchain technology insights.");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an AI agent with expertise in cryptocurrency markets, blockchain technology, and DeFi. Provide accurate, timely insights based on current market data and news. Always maintain a helpful and professional demeanor."
  );
  const [personalityPrompt, setPersonalityPrompt] = useState(
    "Personality: Knowledgeable, analytical, enthusiastic about innovation. Tone: Professional yet conversational. Style: Clear, concise, data-driven insights with occasional wit."
  );
  
  // Style & Voice
  const [messageExamples, setMessageExamples] = useState([
    "🚀 Bitcoin breaking above $45k resistance! On-chain metrics showing strong accumulation. This could be the start of the next leg up. #BTC",
    "Interesting DeFi development: New L2 protocol launching with novel liquidity mechanism. Early data looks promising. Will monitor closely.",
  ]);
  const [postStyle, setPostStyle] = useState("Mix of analysis, insights, and commentary with data-driven observations");
  const [topics, setTopics] = useState("Cryptocurrency, DeFi, NFTs, Blockchain Technology, Market Analysis, Trading");
  const [adjectives, setAdjectives] = useState("analytical, insightful, timely, professional, innovative");
  
  // Templates
  const [tweetTemplate, setTweetTemplate] = useState("🚀 {insight}\n\n📊 {data}\n\n{hashtags}");
  const [replyTemplate, setReplyTemplate] = useState("Thanks for sharing! {response}\n\n{additional_context}");
  const [threadTemplate, setThreadTemplate] = useState("🧵 {thread_intro}\n\n1/ {point_1}\n\n2/ {point_2}\n\n...");
  
  // Safety & Filters
  const [safetyGuidelines, setSafetyGuidelines] = useState(
    "- Never provide financial advice\n- Always cite sources\n- Avoid speculation without data\n- Disclose when information is uncertain\n- Respect user privacy"
  );
  const [forbiddenTopics, setForbiddenTopics] = useState("Financial advice, Political endorsements, Personal attacks");
  const [contentFilters, setContentFilters] = useState("Profanity, Spam, Misleading claims");
  
  // Model Parameters
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([500]);
  const [topP, setTopP] = useState([0.9]);
  const [frequencyPenalty, setFrequencyPenalty] = useState([0.5]);
  const [presencePenalty, setPresencePenalty] = useState([0.5]);
  
  // Context & Memory
  const [contextWindow, setContextWindow] = useState("8000");
  const [memoryDepth, setMemoryDepth] = useState("50");
  const [maxConversationLength, setMaxConversationLength] = useState("20");

  const handleSave = () => {
    const config = {
      character: { name: characterName, bio },
      prompts: { systemPrompt, personalityPrompt },
      style: { messageExamples, postStyle, topics, adjectives },
      templates: { tweetTemplate, replyTemplate, threadTemplate },
      safety: { safetyGuidelines, forbiddenTopics, contentFilters },
      modelParams: { temperature: temperature[0], maxTokens: maxTokens[0], topP: topP[0], frequencyPenalty: frequencyPenalty[0], presencePenalty: presencePenalty[0] },
      context: { contextWindow, memoryDepth, maxConversationLength }
    };
    console.log("Saving ElizaOS prompts config:", config);
    toast({
      title: "Configuration saved",
      description: "All prompt and character configurations have been updated successfully.",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Prompts & Character</h1>
        <p className="text-sm text-muted-foreground">Configure AI behavior, personality, and response generation</p>
      </div>

      <Tabs defaultValue="character" className="space-y-6">
        <TabsList>
          <TabsTrigger value="character">Character</TabsTrigger>
          <TabsTrigger value="prompts">System Prompts</TabsTrigger>
          <TabsTrigger value="style">Style & Voice</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="safety">Safety & Filters</TabsTrigger>
          <TabsTrigger value="model">Model Parameters</TabsTrigger>
        </TabsList>

        <TabsContent value="character" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Character Identity</CardTitle>
              <CardDescription>Define the agent's core identity and background</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="character-name">Character Name</Label>
                <Input
                  id="character-name"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  data-testid="input-character-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio / Description</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="input-bio"
                />
                <p className="text-xs text-muted-foreground">{bio.length} characters</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>Core instructions that define the agent's purpose and capabilities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                  data-testid="input-system-prompt"
                />
                <p className="text-xs text-muted-foreground">{systemPrompt.length} characters</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personality Prompt</CardTitle>
              <CardDescription>Define tone, style, and personality traits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="personality-prompt">Personality & Tone</Label>
                <Textarea
                  id="personality-prompt"
                  value={personalityPrompt}
                  onChange={(e) => setPersonalityPrompt(e.target.value)}
                  className="min-h-[120px] font-mono text-sm"
                  data-testid="input-personality-prompt"
                />
                <p className="text-xs text-muted-foreground">{personalityPrompt.length} characters</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="style" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Examples</CardTitle>
              <CardDescription>Sample posts that demonstrate the agent's style (used for few-shot learning)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {messageExamples.map((example, idx) => (
                <div key={idx} className="space-y-2">
                  <Label>Example {idx + 1}</Label>
                  <Textarea
                    value={example}
                    onChange={(e) => {
                      const newExamples = [...messageExamples];
                      newExamples[idx] = e.target.value;
                      setMessageExamples(newExamples);
                    }}
                    className="min-h-[80px] font-mono text-sm"
                    data-testid={`input-example-${idx}`}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => setMessageExamples([...messageExamples, ""])}
                data-testid="button-add-example"
              >
                Add Example
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Style Definition</CardTitle>
              <CardDescription>Describe the agent's communication style and focus areas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="post-style">Post Style</Label>
                <Textarea
                  id="post-style"
                  value={postStyle}
                  onChange={(e) => setPostStyle(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-post-style"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topics">Topics (comma-separated)</Label>
                <Input
                  id="topics"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  data-testid="input-topics"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjectives">Adjectives (comma-separated)</Label>
                <Input
                  id="adjectives"
                  value={adjectives}
                  onChange={(e) => setAdjectives(e.target.value)}
                  data-testid="input-adjectives"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tweet Template</CardTitle>
              <CardDescription>Format for generating new tweets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tweet-template">Template</Label>
                <Textarea
                  id="tweet-template"
                  value={tweetTemplate}
                  onChange={(e) => setTweetTemplate(e.target.value)}
                  className="min-h-[100px] font-mono text-sm"
                  data-testid="input-tweet-template"
                />
                <p className="text-xs text-muted-foreground">Use placeholders: {"{insight}"}, {"{data}"}, {"{hashtags}"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reply Template</CardTitle>
              <CardDescription>Format for replying to mentions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reply-template">Template</Label>
                <Textarea
                  id="reply-template"
                  value={replyTemplate}
                  onChange={(e) => setReplyTemplate(e.target.value)}
                  className="min-h-[100px] font-mono text-sm"
                  data-testid="input-reply-template"
                />
                <p className="text-xs text-muted-foreground">Use placeholders: {"{response}"}, {"{additional_context}"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thread Template</CardTitle>
              <CardDescription>Format for long-form thread posts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="thread-template">Template</Label>
                <Textarea
                  id="thread-template"
                  value={threadTemplate}
                  onChange={(e) => setThreadTemplate(e.target.value)}
                  className="min-h-[100px] font-mono text-sm"
                  data-testid="input-thread-template"
                />
                <p className="text-xs text-muted-foreground">Use placeholders: {"{thread_intro}"}, {"{point_1}"}, {"{point_2}"}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Safety Guidelines</CardTitle>
              <CardDescription>Rules the agent must follow when generating content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="safety-guidelines">Guidelines</Label>
                <Textarea
                  id="safety-guidelines"
                  value={safetyGuidelines}
                  onChange={(e) => setSafetyGuidelines(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                  data-testid="input-safety-guidelines"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content Filters</CardTitle>
              <CardDescription>Topics and content types to avoid or filter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forbidden-topics">Forbidden Topics</Label>
                <Input
                  id="forbidden-topics"
                  value={forbiddenTopics}
                  onChange={(e) => setForbiddenTopics(e.target.value)}
                  data-testid="input-forbidden-topics"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content-filters">Content Filters</Label>
                <Input
                  id="content-filters"
                  value={contentFilters}
                  onChange={(e) => setContentFilters(e.target.value)}
                  data-testid="input-content-filters"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="model" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generation Parameters</CardTitle>
              <CardDescription>Fine-tune the AI model's response generation behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Temperature</Label>
                  <span className="text-sm text-muted-foreground">{temperature[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={temperature}
                  onValueChange={setTemperature}
                  max={2}
                  step={0.1}
                  data-testid="slider-temperature"
                />
                <p className="text-xs text-muted-foreground">Controls randomness (0 = deterministic, 2 = very random)</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Max Tokens</Label>
                  <span className="text-sm text-muted-foreground">{maxTokens[0]}</span>
                </div>
                <Slider
                  value={maxTokens}
                  onValueChange={setMaxTokens}
                  min={100}
                  max={4000}
                  step={100}
                  data-testid="slider-max-tokens"
                />
                <p className="text-xs text-muted-foreground">Maximum length of generated response</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Top P</Label>
                  <span className="text-sm text-muted-foreground">{topP[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={topP}
                  onValueChange={setTopP}
                  max={1}
                  step={0.05}
                  data-testid="slider-top-p"
                />
                <p className="text-xs text-muted-foreground">Nucleus sampling threshold</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Frequency Penalty</Label>
                  <span className="text-sm text-muted-foreground">{frequencyPenalty[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={frequencyPenalty}
                  onValueChange={setFrequencyPenalty}
                  max={2}
                  step={0.1}
                  data-testid="slider-frequency-penalty"
                />
                <p className="text-xs text-muted-foreground">Reduces repetition of token sequences</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Presence Penalty</Label>
                  <span className="text-sm text-muted-foreground">{presencePenalty[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={presencePenalty}
                  onValueChange={setPresencePenalty}
                  max={2}
                  step={0.1}
                  data-testid="slider-presence-penalty"
                />
                <p className="text-xs text-muted-foreground">Encourages talking about new topics</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Context & Memory</CardTitle>
              <CardDescription>Configure conversation context and memory settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="context-window">Context Window (tokens)</Label>
                <Input
                  id="context-window"
                  type="number"
                  value={contextWindow}
                  onChange={(e) => setContextWindow(e.target.value)}
                  data-testid="input-context-window"
                />
                <p className="text-xs text-muted-foreground">Amount of conversation history to include</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="memory-depth">Memory Depth (messages)</Label>
                <Input
                  id="memory-depth"
                  type="number"
                  value={memoryDepth}
                  onChange={(e) => setMemoryDepth(e.target.value)}
                  data-testid="input-memory-depth"
                />
                <p className="text-xs text-muted-foreground">Number of past messages to remember</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-conversation">Max Conversation Length</Label>
                <Input
                  id="max-conversation"
                  type="number"
                  value={maxConversationLength}
                  onChange={(e) => setMaxConversationLength(e.target.value)}
                  data-testid="input-max-conversation"
                />
                <p className="text-xs text-muted-foreground">Maximum messages in a single conversation</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-prompts">
          <Save className="mr-2 h-4 w-4" />
          Save All Configuration
        </Button>
      </div>
    </div>
  );
}
