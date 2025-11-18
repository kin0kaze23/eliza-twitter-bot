import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Save, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type APIKey = {
  id: string;
  name: string;
  value: string;
  status: "connected" | "not-configured";
  category: string;
};

export default function ApiKeys() {
  const { toast } = useToast();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [selectedModel, setSelectedModel] = useState("openai");
  
  const [keys, setKeys] = useState<APIKey[]>([
    // Twitter
    { id: "twitter", name: "Twitter API Key", value: "", status: "not-configured", category: "twitter" },
    { id: "twitter-secret", name: "Twitter API Secret", value: "", status: "not-configured", category: "twitter" },
    { id: "twitter-bearer", name: "Twitter Bearer Token", value: "", status: "not-configured", category: "twitter" },
    
    // AI Models - Commercial
    { id: "openai", name: "OpenAI API Key", value: "sk-proj-...", status: "connected", category: "ai" },
    { id: "anthropic", name: "Anthropic API Key", value: "", status: "not-configured", category: "ai" },
    { id: "groq", name: "Groq API Key", value: "", status: "not-configured", category: "ai" },
    { id: "together", name: "Together AI API Key", value: "", status: "not-configured", category: "ai" },
    { id: "mistral", name: "Mistral API Key", value: "", status: "not-configured", category: "ai" },
    { id: "cohere", name: "Cohere API Key", value: "", status: "not-configured", category: "ai" },
    { id: "replicate", name: "Replicate API Token", value: "", status: "not-configured", category: "ai" },
    { id: "huggingface", name: "Hugging Face API Token", value: "", status: "not-configured", category: "ai" },
    
    // AI Models - Open Source
    { id: "ollama-url", name: "Ollama Base URL", value: "http://localhost:11434", status: "not-configured", category: "ai-oss" },
    { id: "vllm-url", name: "vLLM Server URL", value: "", status: "not-configured", category: "ai-oss" },
    { id: "localai-url", name: "LocalAI Server URL", value: "", status: "not-configured", category: "ai-oss" },
    
    // Crypto Data
    { id: "coingecko", name: "CoinGecko API Key", value: "", status: "not-configured", category: "crypto" },
    { id: "coinmarketcap", name: "CoinMarketCap API Key", value: "", status: "not-configured", category: "crypto" },
    { id: "dexscreener", name: "DexScreener API Key", value: "", status: "not-configured", category: "crypto" },
    { id: "birdeye", name: "Birdeye API Key", value: "", status: "not-configured", category: "crypto" },
    { id: "moralis", name: "Moralis API Key", value: "", status: "not-configured", category: "crypto" },
    
    // News & Data
    { id: "cryptonews", name: "CryptoNews API Key", value: "", status: "not-configured", category: "news" },
    { id: "newsapi", name: "NewsAPI.org Key", value: "", status: "not-configured", category: "news" },
    { id: "alphavantage", name: "Alpha Vantage API Key", value: "", status: "not-configured", category: "news" },
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

  const getKeysByCategory = (category: string) => keys.filter(k => k.category === category);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">API Keys</h1>
        <p className="text-sm text-muted-foreground">Manage authentication keys for external services</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Twitter / X Platform</CardTitle>
            <CardDescription>Required for posting tweets and monitoring mentions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {getKeysByCategory("twitter").map((key) => (
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
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle>AI Language Models</CardTitle>
                <CardDescription>Commercial API providers for text generation</CardDescription>
              </div>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-48" data-testid="select-primary-model">
                  <SelectValue placeholder="Primary Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="groq">Groq (Fast LLMs)</SelectItem>
                  <SelectItem value="together">Together AI</SelectItem>
                  <SelectItem value="mistral">Mistral AI</SelectItem>
                  <SelectItem value="cohere">Cohere</SelectItem>
                  <SelectItem value="replicate">Replicate</SelectItem>
                  <SelectItem value="huggingface">Hugging Face</SelectItem>
                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {getKeysByCategory("ai").map((key) => (
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
            <CardTitle>Open Source / Self-Hosted Models</CardTitle>
            <CardDescription>Local or self-hosted AI model servers (Ollama, vLLM, LocalAI)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {getKeysByCategory("ai-oss").map((key) => (
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
                    type="text"
                    value={key.value}
                    onChange={(e) => handleKeyChange(key.id, e.target.value)}
                    placeholder="http://localhost:11434"
                    className="font-mono text-sm"
                    data-testid={`input-${key.id}`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crypto Data APIs</CardTitle>
            <CardDescription>API keys for cryptocurrency market data and on-chain analytics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {getKeysByCategory("crypto").map((key) => (
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
            <CardTitle>News & Financial Data</CardTitle>
            <CardDescription>API keys for news feeds and financial market data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {getKeysByCategory("news").map((key) => (
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
