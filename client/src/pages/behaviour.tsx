import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Behaviour() {
  const { toast } = useToast();
  
  // Posting Schedule
  const [postFrequency, setPostFrequency] = useState("2");
  const [postInterval, setPostInterval] = useState("hours");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
  const [timezone, setTimezone] = useState("UTC");
  
  // Reply Behavior
  const [autoReply, setAutoReply] = useState(true);
  const [replyRate, setReplyRate] = useState([70]);
  const [replyDelay, setReplyDelay] = useState([30]);
  const [maxRepliesPerHour, setMaxRepliesPerHour] = useState("10");
  const [onlyReplyToVerified, setOnlyReplyToVerified] = useState(false);
  const [replyToKeywords, setReplyToKeywords] = useState("bitcoin, crypto, defi, blockchain");
  const [ignoreKeywords, setIgnoreKeywords] = useState("spam, scam, airdrop");
  
  // Content Modules
  const [modules, setModules] = useState({
    devotional: false,
    cryptoCommentary: true,
    newsCommentary: true,
    memeMode: false,
    bibleVerse: false,
    threads: true,
    marketAnalysis: true,
    technicalAnalysis: false,
    sentiment: true,
  });
  
  // Action Triggers
  const [priceChangeThreshold, setPriceChangeThreshold] = useState([5]);
  const [volumeChangeThreshold, setVolumeChangeThreshold] = useState([50]);
  const [autoTweetOnNews, setAutoTweetOnNews] = useState(true);
  const [minNewsSentiment, setMinNewsSentiment] = useState([0.6]);
  
  // Engagement Rules
  const [likeRandomPosts, setLikeRandomPosts] = useState(false);
  const [likeRate, setLikeRate] = useState([20]);
  const [retweetThreshold, setRetweetThreshold] = useState([0.8]);
  const [followBackEnabled, setFollowBackEnabled] = useState(false);

  const toggleModule = (key: keyof typeof modules) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    const config = {
      posting: { postFrequency, postInterval, quietHours: { enabled: quietHoursEnabled, start: quietHoursStart, end: quietHoursEnd }, timezone },
      replies: { autoReply, replyRate: replyRate[0], replyDelay: replyDelay[0], maxRepliesPerHour, onlyReplyToVerified, replyToKeywords, ignoreKeywords },
      modules,
      triggers: { priceChangeThreshold: priceChangeThreshold[0], volumeChangeThreshold: volumeChangeThreshold[0], autoTweetOnNews, minNewsSentiment: minNewsSentiment[0] },
      engagement: { likeRandomPosts, likeRate: likeRate[0], retweetThreshold: retweetThreshold[0], followBackEnabled }
    };
    console.log("Saving behaviour config:", config);
    toast({
      title: "Behaviour saved",
      description: "Agent behaviour and schedule have been updated successfully.",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Behaviour & Schedule</h1>
        <p className="text-sm text-muted-foreground">Configure posting schedule, reply behavior, and content modules</p>
      </div>

      <Tabs defaultValue="posting" className="space-y-6">
        <TabsList>
          <TabsTrigger value="posting">Posting</TabsTrigger>
          <TabsTrigger value="replies">Replies</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="posting" className="space-y-6">
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

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone" data-testid="select-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern (US)</SelectItem>
                    <SelectItem value="America/Chicago">Central (US)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific (US)</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    <SelectItem value="Asia/Singapore">Singapore</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="quiet-hours">Quiet Hours</Label>
                  <p className="text-xs text-muted-foreground">Pause posting during specified hours</p>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={quietHoursEnabled}
                  onCheckedChange={setQuietHoursEnabled}
                  data-testid="switch-quiet-hours"
                />
              </div>

              {quietHoursEnabled && (
                <div className="grid gap-4 md:grid-cols-2 pl-6 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label htmlFor="quiet-start">Start Time</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                      data-testid="input-quiet-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet-end">End Time</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
                      data-testid="input-quiet-end"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Reply Configuration</CardTitle>
              <CardDescription>Configure how the agent responds to mentions and replies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                <p className="text-xs text-muted-foreground">Respond to {replyRate[0]}% of mentions</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reply-delay">Reply Delay (seconds)</Label>
                  <span className="text-sm text-muted-foreground">{replyDelay[0]}s</span>
                </div>
                <Slider
                  id="reply-delay"
                  value={replyDelay}
                  onValueChange={setReplyDelay}
                  min={0}
                  max={300}
                  step={10}
                  disabled={!autoReply}
                  data-testid="slider-reply-delay"
                />
                <p className="text-xs text-muted-foreground">Wait before responding (appears more human)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-replies">Max Replies Per Hour</Label>
                <Input
                  id="max-replies"
                  type="number"
                  value={maxRepliesPerHour}
                  onChange={(e) => setMaxRepliesPerHour(e.target.value)}
                  min="1"
                  max="100"
                  disabled={!autoReply}
                  data-testid="input-max-replies"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="verified-only">Only Reply to Verified Accounts</Label>
                  <p className="text-xs text-muted-foreground">Reduce spam replies</p>
                </div>
                <Switch
                  id="verified-only"
                  checked={onlyReplyToVerified}
                  onCheckedChange={setOnlyReplyToVerified}
                  disabled={!autoReply}
                  data-testid="switch-verified-only"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reply-keywords">Reply to Keywords (comma-separated)</Label>
                <Textarea
                  id="reply-keywords"
                  value={replyToKeywords}
                  onChange={(e) => setReplyToKeywords(e.target.value)}
                  placeholder="bitcoin, crypto, defi"
                  className="min-h-[80px]"
                  disabled={!autoReply}
                  data-testid="input-reply-keywords"
                />
                <p className="text-xs text-muted-foreground">Only reply to mentions containing these keywords</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ignore-keywords">Ignore Keywords (comma-separated)</Label>
                <Textarea
                  id="ignore-keywords"
                  value={ignoreKeywords}
                  onChange={(e) => setIgnoreKeywords(e.target.value)}
                  placeholder="spam, scam, airdrop"
                  className="min-h-[80px]"
                  disabled={!autoReply}
                  data-testid="input-ignore-keywords"
                />
                <p className="text-xs text-muted-foreground">Never reply to mentions with these keywords</p>
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
                  <Label htmlFor="market-analysis">Market Analysis</Label>
                  <p className="text-xs text-muted-foreground">Price action and market trends</p>
                </div>
                <Switch
                  id="market-analysis"
                  checked={modules.marketAnalysis}
                  onCheckedChange={() => toggleModule("marketAnalysis")}
                  data-testid="switch-market-analysis"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="technical-analysis">Technical Analysis</Label>
                  <p className="text-xs text-muted-foreground">Chart patterns and indicators</p>
                </div>
                <Switch
                  id="technical-analysis"
                  checked={modules.technicalAnalysis}
                  onCheckedChange={() => toggleModule("technicalAnalysis")}
                  data-testid="switch-technical-analysis"
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
                  <Label htmlFor="sentiment">Sentiment Analysis</Label>
                  <p className="text-xs text-muted-foreground">Track market sentiment</p>
                </div>
                <Switch
                  id="sentiment"
                  checked={modules.sentiment}
                  onCheckedChange={() => toggleModule("sentiment")}
                  data-testid="switch-sentiment"
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
        </TabsContent>

        <TabsContent value="triggers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Action Triggers</CardTitle>
              <CardDescription>Automatically post when certain conditions are met</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Price Change Alert Threshold</Label>
                  <span className="text-sm text-muted-foreground">{priceChangeThreshold[0]}%</span>
                </div>
                <Slider
                  value={priceChangeThreshold}
                  onValueChange={setPriceChangeThreshold}
                  min={1}
                  max={20}
                  step={0.5}
                  data-testid="slider-price-threshold"
                />
                <p className="text-xs text-muted-foreground">Post when price changes by this percentage</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Volume Change Threshold</Label>
                  <span className="text-sm text-muted-foreground">{volumeChangeThreshold[0]}%</span>
                </div>
                <Slider
                  value={volumeChangeThreshold}
                  onValueChange={setVolumeChangeThreshold}
                  min={10}
                  max={200}
                  step={10}
                  data-testid="slider-volume-threshold"
                />
                <p className="text-xs text-muted-foreground">Post when trading volume changes significantly</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-news-tweet">Auto-Tweet on Breaking News</Label>
                  <p className="text-xs text-muted-foreground">Automatically post when major news breaks</p>
                </div>
                <Switch
                  id="auto-news-tweet"
                  checked={autoTweetOnNews}
                  onCheckedChange={setAutoTweetOnNews}
                  data-testid="switch-auto-news"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Minimum News Sentiment Score</Label>
                  <span className="text-sm text-muted-foreground">{minNewsSentiment[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={minNewsSentiment}
                  onValueChange={setMinNewsSentiment}
                  min={0}
                  max={1}
                  step={0.1}
                  disabled={!autoTweetOnNews}
                  data-testid="slider-news-sentiment"
                />
                <p className="text-xs text-muted-foreground">Only post news with positive sentiment above this score</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Rules</CardTitle>
              <CardDescription>Configure how the agent engages with other content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="like-posts">Like Random Posts</Label>
                  <p className="text-xs text-muted-foreground">Automatically like relevant posts</p>
                </div>
                <Switch
                  id="like-posts"
                  checked={likeRandomPosts}
                  onCheckedChange={setLikeRandomPosts}
                  data-testid="switch-like-posts"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Like Rate</Label>
                  <span className="text-sm text-muted-foreground">{likeRate[0]}%</span>
                </div>
                <Slider
                  value={likeRate}
                  onValueChange={setLikeRate}
                  max={100}
                  step={5}
                  disabled={!likeRandomPosts}
                  data-testid="slider-like-rate"
                />
                <p className="text-xs text-muted-foreground">Percentage of relevant posts to like</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Retweet Quality Threshold</Label>
                  <span className="text-sm text-muted-foreground">{retweetThreshold[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={retweetThreshold}
                  onValueChange={setRetweetThreshold}
                  min={0}
                  max={1}
                  step={0.05}
                  data-testid="slider-retweet-threshold"
                />
                <p className="text-xs text-muted-foreground">Only retweet high-quality content above this score</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="follow-back">Follow Back</Label>
                  <p className="text-xs text-muted-foreground">Automatically follow back relevant accounts</p>
                </div>
                <Switch
                  id="follow-back"
                  checked={followBackEnabled}
                  onCheckedChange={setFollowBackEnabled}
                  data-testid="switch-follow-back"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-behaviour">
          <Save className="mr-2 h-4 w-4" />
          Save All Configuration
        </Button>
      </div>
    </div>
  );
}
