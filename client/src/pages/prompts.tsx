import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Prompts() {
  const { toast } = useToast();
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an AI agent specialized in cryptocurrency and blockchain technology. Provide insightful, accurate, and engaging commentary on crypto markets, trends, and news."
  );
  const [personalityPrompt, setPersonalityPrompt] = useState(
    "You are friendly, knowledgeable, and enthusiastic about crypto. Use a conversational tone while maintaining professionalism. Occasionally use relevant crypto terminology."
  );
  const [tweetTemplate, setTweetTemplate] = useState(
    "🚀 {insight}\n\n{hashtags}"
  );
  const [replyTemplate, setReplyTemplate] = useState(
    "Thanks for sharing! {response}"
  );

  const handleSave = () => {
    console.log("Saving prompts:", { systemPrompt, personalityPrompt, tweetTemplate, replyTemplate });
    toast({
      title: "Prompts saved",
      description: "All prompt configurations have been updated successfully.",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Prompts</h1>
        <p className="text-sm text-muted-foreground">Configure AI behavior and response templates</p>
      </div>

      <div className="space-y-6">
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
                className="min-h-[120px] font-mono text-sm"
                data-testid="input-system-prompt"
              />
              <p className="text-xs text-muted-foreground">{systemPrompt.length} characters</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personality Prompt</CardTitle>
            <CardDescription>Define the agent's tone, style, and personality traits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="personality-prompt">Personality</Label>
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
                className="min-h-[80px] font-mono text-sm"
                data-testid="input-tweet-template"
              />
              <p className="text-xs text-muted-foreground">Use placeholders like {"{insight}"} and {"{hashtags}"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reply Template</CardTitle>
            <CardDescription>Format for replying to mentions and comments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reply-template">Template</Label>
              <Textarea
                id="reply-template"
                value={replyTemplate}
                onChange={(e) => setReplyTemplate(e.target.value)}
                className="min-h-[80px] font-mono text-sm"
                data-testid="input-reply-template"
              />
              <p className="text-xs text-muted-foreground">Use {"{response}"} placeholder for dynamic content</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-prompts">
            <Save className="mr-2 h-4 w-4" />
            Save All Prompts
          </Button>
        </div>
      </div>
    </div>
  );
}
