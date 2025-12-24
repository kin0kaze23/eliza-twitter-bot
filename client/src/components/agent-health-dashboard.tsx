import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Clock, 
  Wifi,
  WifiOff,
  Activity,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AgentHealthData {
  agentId: string;
  agentName: string;
  status: string;
  healthStatus: "healthy" | "warning" | "critical";
  issues: string[];
  safeModeActivated?: boolean;
  safeModeReason?: string;
  credentials: {
    hasApiCredentials: boolean;
    hasScraperCredentials: boolean;
    hasCookies: boolean;
    canPost: boolean;
  };
  posting: {
    enabled: boolean;
    frequency: string;
    intervalMs: number;
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    successRate: number;
    lastSuccessfulPost: string | null;
    lastFailedPost: string | null;
    timeSinceLastPost: number | null;
    recentErrors: string[];
    isStalled: boolean;
    lastPostedAt: string | null;
    lastPostAttemptAt: string | null;
  };
  replies: {
    enabled: boolean;
    rate: number;
    maxPerHour: number;
  };
  checkedAt: string;
}

interface AgentHealthDashboardProps {
  agentId: string;
}

function HealthStatusBadge({ status }: { status: "healthy" | "warning" | "critical" }) {
  const config = {
    healthy: { color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle2, label: "Healthy" },
    warning: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: AlertTriangle, label: "Warning" },
    critical: { color: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle, label: "Critical" },
  };
  
  const { color, icon: Icon, label } = config[status];
  
  return (
    <Badge variant="outline" className={`${color} gap-1 px-3 py-1`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

function CredentialIndicator({ 
  label, 
  hasCredential, 
  description 
}: { 
  label: string; 
  hasCredential: boolean; 
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2">
        {hasCredential ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant={hasCredential ? "default" : "secondary"} className="text-xs">
        {hasCredential ? "Connected" : "Not configured"}
      </Badge>
    </div>
  );
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  return `${minutes}m ago`;
}

export function AgentHealthDashboard({ agentId }: AgentHealthDashboardProps) {
  const { data: health, isLoading, error, refetch } = useQuery<AgentHealthData>({
    queryKey: ["/api/agents", agentId, "health"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/health`);
      if (!res.ok) throw new Error("Failed to fetch health data");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-500">Health Check Failed</CardTitle>
          <CardDescription>Unable to retrieve agent health data</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-retry-health">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={health.healthStatus === "critical" ? "border-red-500/30" : health.healthStatus === "warning" ? "border-yellow-500/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-health-title">
              Agent Health
              <HealthStatusBadge status={health.healthStatus} />
              {health.safeModeActivated && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Safe Mode
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Real-time monitoring for {health.agentName}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh-health">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {health.issues.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm font-medium text-destructive mb-2">Issues Detected:</p>
            <ul className="text-sm text-destructive/80 space-y-1">
              {health.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <CredentialIndicator 
                label="API Credentials" 
                hasCredential={health.credentials.hasApiCredentials}
                description="OAuth 1.0a for posting"
              />
              <CredentialIndicator 
                label="Session Cookies" 
                hasCredential={health.credentials.hasCookies}
                description="Scraper authentication"
              />
              <CredentialIndicator 
                label="Login Credentials" 
                hasCredential={health.credentials.hasScraperCredentials}
                description="Username/password fallback"
              />
              <div className="mt-3 pt-2 border-t">
                <Badge 
                  variant={health.credentials.canPost ? "default" : "destructive"}
                  className="w-full justify-center"
                >
                  {health.credentials.canPost ? "Can Post" : "Cannot Post"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Posting Activity (24h)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className={`text-lg font-bold ${health.posting.successRate >= 80 ? "text-green-500" : health.posting.successRate >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                  {Math.round(health.posting.successRate)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Posts</span>
                <span className="font-medium">{health.posting.totalPosts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  Successful
                </span>
                <span className="font-medium text-green-500">{health.posting.successfulPosts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  Failed
                </span>
                <span className="font-medium text-red-500">{health.posting.failedPosts}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Frequency</span>
                <span className="font-medium">{health.posting.frequency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Post</span>
                <span className={`font-medium ${health.posting.isStalled ? "text-red-500" : ""}`}>
                  {health.posting.lastSuccessfulPost 
                    ? formatDistanceToNow(new Date(health.posting.lastSuccessfulPost), { addSuffix: true })
                    : "Never"
                  }
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={health.posting.isStalled ? "destructive" : health.posting.enabled ? "default" : "secondary"}>
                  {health.posting.isStalled ? "Stalled" : health.posting.enabled ? "Active" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Agent Status</span>
                <Badge variant={health.status === "deployed" ? "default" : "secondary"}>
                  {health.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {health.posting.recentErrors.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-medium mb-2">Recent Errors:</p>
            <ul className="text-xs text-muted-foreground space-y-1 font-mono">
              {health.posting.recentErrors.slice(0, 3).map((error, i) => (
                <li key={i} className="truncate">{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-right">
          Last checked: {new Date(health.checkedAt).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
