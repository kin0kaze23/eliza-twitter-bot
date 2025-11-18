import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

type FeedItem = {
  id: string;
  source: string;
  title: string;
  data: any;
  timestamp: Date;
  type: "crypto" | "news";
};

export default function LiveFeeds() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feeds] = useState<FeedItem[]>([
    {
      id: "1",
      source: "CoinGecko",
      title: "Bitcoin Price Update",
      data: { price: "$43,250", change: "+2.5%" },
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      type: "crypto",
    },
    {
      id: "2",
      source: "DexScreener",
      title: "SOL/USDC Pool Activity",
      data: { volume: "$2.4M", liquidity: "$12.8M" },
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      type: "crypto",
    },
    {
      id: "3",
      source: "CoinGecko",
      title: "Ethereum Market Data",
      data: { price: "$2,315", change: "-0.8%" },
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
      type: "crypto",
    },
    {
      id: "4",
      source: "Crypto News API",
      title: "SEC Approves New Bitcoin ETF",
      data: { category: "Regulation", sentiment: "Positive" },
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      type: "news",
    },
    {
      id: "5",
      source: "Crypto News API",
      title: "Major DeFi Protocol Launches on Layer 2",
      data: { category: "DeFi", sentiment: "Positive" },
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      type: "news",
    },
  ]);

  const handleRefresh = () => {
    console.log("Refreshing feeds...");
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const formatTimestamp = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 minute ago";
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  };

  const cryptoFeeds = feeds.filter((f) => f.type === "crypto");
  const newsFeeds = feeds.filter((f) => f.type === "news");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Live Feeds</h1>
          <p className="text-sm text-muted-foreground">Real-time data from configured integrations</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="button-refresh"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="crypto" className="space-y-6">
        <TabsList>
          <TabsTrigger value="crypto" data-testid="tab-crypto-feeds">
            Crypto Data ({cryptoFeeds.length})
          </TabsTrigger>
          <TabsTrigger value="news" data-testid="tab-news-feeds">
            News Feeds ({newsFeeds.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crypto" className="space-y-4">
          {cryptoFeeds.map((feed) => (
            <Card key={feed.id} data-testid={`card-feed-${feed.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{feed.title}</CardTitle>
                    {feed.data.change && (
                      <Badge variant={feed.data.change.startsWith("+") ? "default" : "secondary"} className="gap-1">
                        {feed.data.change.startsWith("+") ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {feed.data.change}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{feed.source}</Badge>
                    <span>{formatTimestamp(feed.timestamp)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-6">
                  {feed.data.price && (
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="text-lg font-semibold">{feed.data.price}</p>
                    </div>
                  )}
                  {feed.data.volume && (
                    <div>
                      <p className="text-xs text-muted-foreground">Volume</p>
                      <p className="text-lg font-semibold">{feed.data.volume}</p>
                    </div>
                  )}
                  {feed.data.liquidity && (
                    <div>
                      <p className="text-xs text-muted-foreground">Liquidity</p>
                      <p className="text-lg font-semibold">{feed.data.liquidity}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="news" className="space-y-4">
          {newsFeeds.map((feed) => (
            <Card key={feed.id} data-testid={`card-feed-${feed.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-base">{feed.title}</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{feed.source}</Badge>
                    <span>{formatTimestamp(feed.timestamp)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <Badge variant="secondary" className="mt-1">{feed.data.category}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sentiment</p>
                    <Badge
                      variant={feed.data.sentiment === "Positive" ? "default" : "secondary"}
                      className="mt-1"
                    >
                      {feed.data.sentiment}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
