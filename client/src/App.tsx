import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Dashboard from "@/pages/dashboard";
import Agents from "@/pages/agents";
import AgentConfigure from "@/pages/agent-configure";
import Monitoring from "@/pages/monitoring";
import ApiKeys from "@/pages/api-keys";
import Integrations from "@/pages/integrations";
import CustomAPIs from "@/pages/custom-apis";
import LiveFeeds from "@/pages/live-feeds";
import Playground from "@/pages/playground";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agents" component={Agents} />
      <Route path="/agent/:id/configure" component={AgentConfigure} />
      <Route path="/monitoring" component={Monitoring} />
      <Route path="/api-keys" component={ApiKeys} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/custom-apis" component={CustomAPIs} />
      <Route path="/live-feeds" component={LiveFeeds} />
      <Route path="/playground" component={Playground} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between p-4 border-b">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-auto p-8">
                <div className="max-w-7xl mx-auto">
                  <Router />
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
