import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, MessageSquare, Zap, AlertCircle, Play, RefreshCw } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const [agentStatus, setAgentStatus] = useState<"active" | "inactive">("active");
  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestart = () => {
    console.log("Restarting agent...");
    setIsRestarting(true);
    setTimeout(() => {
      setIsRestarting(false);
      setAgentStatus("active");
    }, 2000);
  };

  const handleStart = () => {
    console.log("Starting agent...");
    setAgentStatus("active");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Monitor and control your AI agent</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-agent-status">
              <Badge variant={agentStatus === "active" ? "default" : "secondary"}>
                {agentStatus === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {agentStatus === "active" ? "Running normally" : "Agent stopped"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posts Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-posts-count">24</div>
            <p className="text-xs text-muted-foreground">+12% from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-api-calls">1,247</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-errors-count">2</div>
            <p className="text-xs text-muted-foreground">Minor issues only</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              variant={agentStatus === "inactive" ? "default" : "outline"}
              onClick={handleStart}
              disabled={agentStatus === "active"}
              data-testid="button-start-agent"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Agent
            </Button>
            <Button
              className="w-full"
              variant="destructive"
              onClick={handleRestart}
              disabled={isRestarting || agentStatus === "inactive"}
              data-testid="button-restart-agent"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
              {isRestarting ? "Restarting..." : "Restart Agent"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Posted crypto market update</p>
                  <p className="text-xs text-muted-foreground">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Replied to 3 mentions</p>
                  <p className="text-xs text-muted-foreground">15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 mt-2 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Fetched latest news feeds</p>
                  <p className="text-xs text-muted-foreground">1 hour ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
