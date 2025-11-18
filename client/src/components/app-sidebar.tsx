import {
  LayoutDashboard,
  Key,
  Plug,
  Activity,
  Bot,
  FlaskConical,
  Blocks,
  BarChart3,
  Database,
  ExternalLink,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    testId: "link-dashboard",
    group: "overview",
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Bot,
    testId: "link-agents",
    group: "overview",
  },
  {
    title: "Monitoring",
    url: "/monitoring",
    icon: BarChart3,
    testId: "link-monitoring",
    group: "overview",
  },
  {
    title: "KB Snippets",
    url: "/kb-snippets",
    icon: Database,
    testId: "link-kb-snippets",
    group: "overview",
  },
  {
    title: "API Management",
    url: "/api-management",
    icon: ExternalLink,
    testId: "link-api-management",
    group: "data",
  },
  {
    title: "API Keys",
    url: "/api-keys",
    icon: Key,
    testId: "link-api-keys",
    group: "global",
  },
  {
    title: "Integrations",
    url: "/integrations",
    icon: Plug,
    testId: "link-integrations",
    group: "data",
  },
  {
    title: "Live Feeds",
    url: "/live-feeds",
    icon: Activity,
    testId: "link-live-feeds",
    group: "data",
  },
  {
    title: "Playground",
    url: "/playground",
    icon: FlaskConical,
    testId: "link-playground",
    group: "testing",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  const groupedItems = {
    overview: menuItems.filter(item => item.group === "overview"),
    global: menuItems.filter(item => item.group === "global"),
    data: menuItems.filter(item => item.group === "data"),
    testing: menuItems.filter(item => item.group === "testing"),
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">ElizaOS</h2>
            <p className="text-xs text-muted-foreground">Agent Dashboard</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedItems.overview.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Global Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedItems.global.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Data Sources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedItems.data.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Testing</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedItems.testing.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
