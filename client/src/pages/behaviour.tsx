import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Behaviour() {
  const { toast } = useToast();
  const [postFrequency, setPostFrequency] = useState("2");
  const [postInterval, setPostInterval] = useState("hours");
  const [autoReply, setAutoReply] = useState(true);
  const [replyRate, setReplyRate] = useState([70]);
  
  const [modules, setModules] = useState({
    devotional: false,
    cryptoCommentary: true,
    newsCommentary: true,
    memeMode: false,
    bibleVerse: false,
    threads: true,
  });

  const toggleModule = (key: keyof typeof modules) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    console.log("Saving behaviour config:", { postFrequency, postInterval, autoReply, replyRate, modules });
    toast({
      title: "Behaviour saved",
      description: "Agent behaviour and schedule have been updated successfully.",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Behaviour</h1>
        <p className="text-sm text-muted-foreground">Configure posting schedule and agent modules</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Posting Schedule</CardTitle>
            <CardDescription>Control when and how often the agent posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="frequency">Post Frequency</Label>
              <div className="flex gap-2">
                <Input
                  id="frequency"
                  type="number"
                  value={postFrequency}
                  onChange={(e) => setPostFrequency(e.target.value)}
                  min="1"
                  max="24"
                  className="w-24"
                  data-testid="input-post-frequency"
                />
                <Select value={postInterval} onValueChange={setPostInterval}>
                  <SelectTrigger className="w-32" data-testid="select-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Agent will post every {postFrequency} {postInterval}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-reply">Auto-Reply</Label>
                <p className="text-xs text-muted-foreground">Automatically respond to mentions</p>
              </div>
              <Switch
                id="auto-reply"
                checked={autoReply}
                onCheckedChange={setAutoReply}
                data-testid="switch-auto-reply"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="reply-rate">Reply Rate</Label>
                <span className="text-sm text-muted-foreground">{replyRate[0]}%</span>
              </div>
              <Slider
                id="reply-rate"
                value={replyRate}
                onValueChange={setReplyRate}
                max={100}
                step={5}
                disabled={!autoReply}
                data-testid="slider-reply-rate"
              />
              <p className="text-xs text-muted-foreground">
                Respond to {replyRate[0]}% of mentions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Modules</CardTitle>
            <CardDescription>Enable or disable different content types</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="crypto-commentary">Crypto Commentary</Label>
                <p className="text-xs text-muted-foreground">Market analysis and insights</p>
              </div>
              <Switch
                id="crypto-commentary"
                checked={modules.cryptoCommentary}
                onCheckedChange={() => toggleModule("cryptoCommentary")}
                data-testid="switch-crypto-commentary"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="news-commentary">News Commentary</Label>
                <p className="text-xs text-muted-foreground">React to latest crypto news</p>
              </div>
              <Switch
                id="news-commentary"
                checked={modules.newsCommentary}
                onCheckedChange={() => toggleModule("newsCommentary")}
                data-testid="switch-news-commentary"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="threads">Long-form Threads</Label>
                <p className="text-xs text-muted-foreground">Post detailed thread content</p>
              </div>
              <Switch
                id="threads"
                checked={modules.threads}
                onCheckedChange={() => toggleModule("threads")}
                data-testid="switch-threads"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="meme-mode">Meme Mode</Label>
                <p className="text-xs text-muted-foreground">Fun and casual content</p>
              </div>
              <Switch
                id="meme-mode"
                checked={modules.memeMode}
                onCheckedChange={() => toggleModule("memeMode")}
                data-testid="switch-meme-mode"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="devotional">Daily Devotional</Label>
                <p className="text-xs text-muted-foreground">Inspirational content</p>
              </div>
              <Switch
                id="devotional"
                checked={modules.devotional}
                onCheckedChange={() => toggleModule("devotional")}
                data-testid="switch-devotional"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="bible-verse">Bible Verse Mode</Label>
                <p className="text-xs text-muted-foreground">Share scripture verses</p>
              </div>
              <Switch
                id="bible-verse"
                checked={modules.bibleVerse}
                onCheckedChange={() => toggleModule("bibleVerse")}
                data-testid="switch-bible-verse"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-behaviour">
          <Save className="mr-2 h-4 w-4" />
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
