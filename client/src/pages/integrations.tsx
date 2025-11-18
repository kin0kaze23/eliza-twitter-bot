import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type Integration = {
  id: string;
  name: string;
  type: "crypto" | "news";
  url: string;
  interval: number;
  enabled: boolean;
};

export default function Integrations() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newIntegration, setNewIntegration] = useState({
    name: "",
    type: "crypto" as "crypto" | "news",
    url: "",
    interval: 5,
  });

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "1",
      name: "CoinGecko API",
      type: "crypto",
      url: "https://api.coingecko.com/api/v3/coins/markets",
      interval: 5,
      enabled: true,
    },
    {
      id: "2",
      name: "DexScreener",
      type: "crypto",
      url: "https://api.dexscreener.com/latest/dex/tokens/",
      interval: 10,
      enabled: true,
    },
    {
      id: "3",
      name: "Crypto News API",
      type: "news",
      url: "https://cryptonews-api.com/api/v1/category",
      interval: 15,
      enabled: false,
    },
  ]);

  const handleAddIntegration = () => {
    if (!newIntegration.name || !newIntegration.url) return;

    const integration: Integration = {
      id: Date.now().toString(),
      ...newIntegration,
      enabled: true,
    };

    setIntegrations([...integrations, integration]);
    setNewIntegration({ name: "", type: "crypto", url: "", interval: 5 });
    setIsAddDialogOpen(false);

    toast({
      title: "Integration added",
      description: "Data source has been configured successfully.",
    });
  };

  const toggleIntegration = (id: string) => {
    setIntegrations((prev) =>
      prev.map((int) => (int.id === id ? { ...int, enabled: !int.enabled } : int))
    );
  };

  const deleteIntegration = (id: string) => {
    setIntegrations((prev) => prev.filter((int) => int.id !== id));
    toast({
      title: "Integration removed",
      description: "Data source has been deleted.",
    });
  };

  const cryptoIntegrations = integrations.filter((i) => i.type === "crypto");
  const newsIntegrations = integrations.filter((i) => i.type === "news");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Integrations</h1>
          <p className="text-sm text-muted-foreground">Manage data sources for live crypto and news feeds</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-integration">
              <Plus className="mr-2 h-4 w-4" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Data Source</DialogTitle>
              <DialogDescription>Configure a new crypto or news API integration</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="int-name">Name</Label>
                <Input
                  id="int-name"
                  value={newIntegration.name}
                  onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                  placeholder="e.g., CoinMarketCap"
                  data-testid="input-integration-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="int-type">Type</Label>
                <Select
                  value={newIntegration.type}
                  onValueChange={(v: "crypto" | "news") =>
                    setNewIntegration({ ...newIntegration, type: v })
                  }
                >
                  <SelectTrigger id="int-type" data-testid="select-integration-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crypto">Crypto Data</SelectItem>
                    <SelectItem value="news">News Feed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="int-url">API URL</Label>
                <Input
                  id="int-url"
                  value={newIntegration.url}
                  onChange={(e) => setNewIntegration({ ...newIntegration, url: e.target.value })}
                  placeholder="https://api.example.com/endpoint"
                  className="font-mono text-sm"
                  data-testid="input-integration-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="int-interval">Fetch Interval (minutes)</Label>
                <Input
                  id="int-interval"
                  type="number"
                  value={newIntegration.interval}
                  onChange={(e) => setNewIntegration({ ...newIntegration, interval: parseInt(e.target.value) })}
                  min="1"
                  max="1440"
                  data-testid="input-integration-interval"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddIntegration} data-testid="button-save-integration">
                Add Integration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="crypto" className="space-y-6">
        <TabsList>
          <TabsTrigger value="crypto" data-testid="tab-crypto">
            Crypto Sources ({cryptoIntegrations.length})
          </TabsTrigger>
          <TabsTrigger value="news" data-testid="tab-news">
            News Sources ({newsIntegrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crypto" className="space-y-4">
          {cryptoIntegrations.map((integration) => (
            <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                    <Badge variant={integration.enabled ? "default" : "secondary"}>
                      {integration.enabled ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">{integration.url}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={integration.enabled}
                    onCheckedChange={() => toggleIntegration(integration.id)}
                    data-testid={`switch-integration-${integration.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteIntegration(integration.id)}
                    data-testid={`button-delete-integration-${integration.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fetches data every {integration.interval} minutes
                </p>
              </CardContent>
            </Card>
          ))}
          {cryptoIntegrations.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No crypto data sources configured</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="news" className="space-y-4">
          {newsIntegrations.map((integration) => (
            <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                    <Badge variant={integration.enabled ? "default" : "secondary"}>
                      {integration.enabled ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">{integration.url}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={integration.enabled}
                    onCheckedChange={() => toggleIntegration(integration.id)}
                    data-testid={`switch-integration-${integration.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteIntegration(integration.id)}
                    data-testid={`button-delete-integration-${integration.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fetches data every {integration.interval} minutes
                </p>
              </CardContent>
            </Card>
          ))}
          {newsIntegrations.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No news sources configured</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
