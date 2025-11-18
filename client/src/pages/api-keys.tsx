import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Save, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type APIKey = {
  id: string;
  name: string;
  value: string;
  status: "connected" | "not-configured";
};

export default function ApiKeys() {
  const { toast } = useToast();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keys, setKeys] = useState<APIKey[]>([
    { id: "twitter", name: "Twitter API Key", value: "", status: "not-configured" },
    { id: "twitter-secret", name: "Twitter API Secret", value: "", status: "not-configured" },
    { id: "openai", name: "OpenAI API Key", value: "sk-proj-...", status: "connected" },
    { id: "anthropic", name: "Anthropic API Key", value: "", status: "not-configured" },
    { id: "coingecko", name: "CoinGecko API Key", value: "", status: "not-configured" },
    { id: "coinmarketcap", name: "CoinMarketCap API Key", value: "", status: "not-configured" },
  ]);

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKeyChange = (id: string, value: string) => {
    setKeys((prev) =>
      prev.map((key) =>
        key.id === id
          ? { ...key, value, status: value ? "connected" : "not-configured" }
          : key
      )
    );
  };

  const handleSave = () => {
    console.log("Saving API keys:", keys);
    toast({
      title: "API keys saved",
      description: "All API key configurations have been updated securely.",
    });
  };

  const maskKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "•".repeat(key.length);
    return key.substring(0, 8) + "•".repeat(Math.max(8, key.length - 8));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">API Keys</h1>
        <p className="text-sm text-muted-foreground">Manage authentication keys for external services</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Twitter / X</CardTitle>
            <CardDescription>Required for posting tweets and monitoring mentions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {keys.slice(0, 2).map((key) => (
              <div key={key.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={key.id}>{key.name}</Label>
                  <Badge variant={key.status === "connected" ? "default" : "secondary"} className="gap-1">
                    {key.status === "connected" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Not Configured
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    id={key.id}
                    type={showKeys[key.id] ? "text" : "password"}
                    value={showKeys[key.id] ? key.value : maskKey(key.value)}
                    onChange={(e) => handleKeyChange(key.id, e.target.value)}
                    placeholder="Enter API key..."
                    className="font-mono text-sm"
                    data-testid={`input-${key.id}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowKey(key.id)}
                    data-testid={`button-toggle-${key.id}`}
                  >
                    {showKeys[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Models</CardTitle>
            <CardDescription>API keys for AI language models</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {keys.slice(2, 4).map((key) => (
              <div key={key.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={key.id}>{key.name}</Label>
                  <Badge variant={key.status === "connected" ? "default" : "secondary"} className="gap-1">
                    {key.status === "connected" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Not Configured
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    id={key.id}
                    type={showKeys[key.id] ? "text" : "password"}
                    value={showKeys[key.id] ? key.value : maskKey(key.value)}
                    onChange={(e) => handleKeyChange(key.id, e.target.value)}
                    placeholder="Enter API key..."
                    className="font-mono text-sm"
                    data-testid={`input-${key.id}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowKey(key.id)}
                    data-testid={`button-toggle-${key.id}`}
                  >
                    {showKeys[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crypto Data APIs</CardTitle>
            <CardDescription>API keys for cryptocurrency market data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {keys.slice(4, 6).map((key) => (
              <div key={key.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={key.id}>{key.name}</Label>
                  <Badge variant={key.status === "connected" ? "default" : "secondary"} className="gap-1">
                    {key.status === "connected" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Not Configured
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    id={key.id}
                    type={showKeys[key.id] ? "text" : "password"}
                    value={showKeys[key.id] ? key.value : maskKey(key.value)}
                    onChange={(e) => handleKeyChange(key.id, e.target.value)}
                    placeholder="Enter API key..."
                    className="font-mono text-sm"
                    data-testid={`input-${key.id}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowKey(key.id)}
                    data-testid={`button-toggle-${key.id}`}
                  >
                    {showKeys[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-keys">
            <Save className="mr-2 h-4 w-4" />
            Save All Keys
          </Button>
        </div>
      </div>
    </div>
  );
}
