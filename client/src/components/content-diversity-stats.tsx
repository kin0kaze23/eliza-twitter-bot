import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { 
  Sparkles, 
  RefreshCw, 
  BookOpen,
  Shuffle,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ContentDiversityData {
  agentId: string;
  agentName: string;
  contentTypes: {
    recentTypes: string[];
    unusedTypes: string[];
    allUsages: Array<{
      contentType: string;
      usageCount: number;
      lastUsedAt: string;
    }>;
    diversityScore: number;
  };
  verses: {
    recentVerses: Array<{
      verseRef: string;
      usageCount: number;
      lastUsedAt: string;
    }>;
    uniqueVersesCount: number;
    diversityScore: number;
  };
  recentPosts: Array<{
    tweetId: string;
    contentType: string | null;
    bibleVerse: string | null;
    postedAt: string;
  }>;
  overallDiversityScore: number;
  checkedAt: string;
}

interface ContentDiversityStatsProps {
  agentId: string;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  "EVENT_BASED": "Market Events",
  "VERSE_REFLECTION": "Verse Reflection",
  "DEEP_QUESTION": "Deep Question",
  "WISDOM_BITE": "Wisdom Bite",
  "CULTURAL_INSIGHT": "Cultural Insight",
  "ENCOURAGEMENT": "Encouragement",
  "ETERNITY_ANCHOR": "Eternity Anchor",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

function getScoreBadge(score: number): { variant: "default" | "secondary" | "destructive"; label: string } {
  if (score >= 80) return { variant: "default", label: "Excellent" };
  if (score >= 50) return { variant: "secondary", label: "Good" };
  return { variant: "destructive", label: "Needs Variety" };
}

export function ContentDiversityStats({ agentId }: ContentDiversityStatsProps) {
  const { data, isLoading, error, refetch } = useQuery<ContentDiversityData>({
    queryKey: ["/api/agents", agentId, "content-diversity"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/content-diversity`);
      if (!res.ok) throw new Error("Failed to fetch diversity data");
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-yellow-500/20">
        <CardHeader>
          <CardTitle className="text-yellow-500">Content Diversity</CardTitle>
          <CardDescription>Unable to load diversity stats</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-retry-diversity">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { variant: overallVariant, label: overallLabel } = getScoreBadge(data.overallDiversityScore);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-diversity-title">
              <Sparkles className="h-5 w-5" />
              Content Diversity
              <Badge variant={overallVariant}>{overallLabel}</Badge>
            </CardTitle>
            <CardDescription>
              Variety in content types and Scripture references
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh-diversity">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Shuffle className="h-4 w-4" />
                Content Types
              </span>
              <span className={`text-lg font-bold ${getScoreColor(data.contentTypes.diversityScore)}`}>
                {data.contentTypes.diversityScore}%
              </span>
            </div>
            <Progress value={data.contentTypes.diversityScore} className="h-2" />
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Recently used:</p>
              <div className="flex flex-wrap gap-1">
                {data.contentTypes.recentTypes.slice(0, 5).map((type, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {CONTENT_TYPE_LABELS[type] || type}
                  </Badge>
                ))}
              </div>
            </div>
            
            {data.contentTypes.unusedTypes.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  Try these next:
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.contentTypes.unusedTypes.slice(0, 3).map((type, i) => (
                    <Badge key={i} variant="outline" className="text-xs border-dashed">
                      {CONTENT_TYPE_LABELS[type] || type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Scripture Variety
              </span>
              <span className={`text-lg font-bold ${getScoreColor(data.verses.diversityScore)}`}>
                {data.verses.diversityScore}%
              </span>
            </div>
            <Progress value={data.verses.diversityScore} className="h-2" />
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {data.verses.uniqueVersesCount} unique verses used
              </p>
              <div className="flex flex-wrap gap-1">
                {data.verses.recentVerses.slice(0, 4).map((verse, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {verse.verseRef}
                    {verse.usageCount > 1 && (
                      <span className="ml-1 text-muted-foreground">x{verse.usageCount}</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
            
            {data.verses.recentVerses.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                No verse repetition detected
              </p>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-right">
          Last checked: {formatDistanceToNow(new Date(data.checkedAt), { addSuffix: true })}
        </div>
      </CardContent>
    </Card>
  );
}
