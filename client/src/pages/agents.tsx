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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Play, Pause, Settings, Copy, Trash2, Edit, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type Agent = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused";
  model: string;
  lastActive: Date | null;
  postsToday: number;
  createdAt: Date;
};

export default function Agents() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", description: "", model: "openai" });
  
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: "1",
      name: "CryptoAnalyst",
      description: "Main crypto commentary agent focused on Bitcoin and Ethereum analysis",
      status: "active",
      model: "openai",
      lastActive: new Date(),
      postsToday: 24,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: "2",
      name: "DeFiExpert",
      description: "DeFi protocols and yield farming specialist",
      status: "draft",
      model: "anthropic",
      lastActive: null,
      postsToday: 0,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: "3",
      name: "NewsBot",
      description: "Breaking crypto news aggregator and commentator",
      status: "paused",
      model: "groq",
      lastActive: new Date(Date.now() - 4 * 60 * 60 * 1000),
      postsToday: 8,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  ]);

  const handleCreateAgent = () => {
    if (!newAgent.name) return;
    
    const agent: Agent = {
      id: Date.now().toString(),
      name: newAgent.name,
      description: newAgent.description,
      status: "draft",
      model: newAgent.model,
      lastActive: null,
      postsToday: 0,
      createdAt: new Date(),
    };
    
    setAgents([agent, ...agents]);
    setNewAgent({ name: "", description: "", model: "openai" });
    setIsCreateDialogOpen(false);
    
    toast({
      title: "Agent created",
      description: `${agent.name} has been created as a draft. Configure it before deploying.`,
    });
  };

  const handleDeploy = (id: string) => {
    setAgents(prev =>
      prev.map(agent =>
        agent.id === id ? { ...agent, status: "active" as const, lastActive: new Date() } : agent
      )
    );
    toast({
      title: "Agent deployed",
      description: "Agent is now active and will start posting according to its schedule.",
    });
  };

  const handlePause = (id: string) => {
    setAgents(prev =>
      prev.map(agent =>
        agent.id === id ? { ...agent, status: "paused" as const } : agent
      )
    );
    toast({
      title: "Agent paused",
      description: "Agent has been paused and will not post until resumed.",
    });
  };

  const handleResume = (id: string) => {
    setAgents(prev =>
      prev.map(agent =>
        agent.id === id ? { ...agent, status: "active" as const, lastActive: new Date() } : agent
      )
    );
    toast({
      title: "Agent resumed",
      description: "Agent is now active again.",
    });
  };

  const handleDuplicate = (id: string) => {
    const original = agents.find(a => a.id === id);
    if (!original) return;
    
    const duplicate: Agent = {
      ...original,
      id: Date.now().toString(),
      name: `${original.name} (Copy)`,
      status: "draft",
      lastActive: null,
      postsToday: 0,
      createdAt: new Date(),
    };
    
    setAgents([duplicate, ...agents]);
    toast({
      title: "Agent duplicated",
      description: "New draft agent created with same configuration.",
    });
  };

  const handleDelete = (id: string) => {
    const agent = agents.find(a => a.id === id);
    setAgents(prev => prev.filter(a => a.id !== id));
    toast({
      title: "Agent deleted",
      description: `${agent?.name} has been removed.`,
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const activeAgents = agents.filter(a => a.status === "active").length;
  const draftAgents = agents.filter(a => a.status === "draft").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage multiple AI agents with different configurations and purposes
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-agent">
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>Set up a new AI agent with custom configuration</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="e.g., CryptoAnalyst"
                  data-testid="input-agent-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-desc">Description</Label>
                <Input
                  id="agent-desc"
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="Brief description of agent's purpose"
                  data-testid="input-agent-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-model">Primary AI Model</Label>
                <Select value={newAgent.model} onValueChange={(v) => setNewAgent({ ...newAgent, model: v })}>
                  <SelectTrigger id="agent-model" data-testid="select-agent-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateAgent} data-testid="button-save-agent">
                Create Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{agents.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeAgents} active, {draftAgents} draft
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {agents.reduce((sum, a) => sum + a.postsToday, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all active agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activeAgents}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {agents.map((agent) => (
          <Card key={agent.id} data-testid={`card-agent-${agent.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <Badge
                      variant={
                        agent.status === "active" ? "default" :
                        agent.status === "draft" ? "secondary" : "outline"
                      }
                    >
                      {agent.status === "active" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {agent.model}
                    </Badge>
                  </div>
                  <CardDescription>{agent.description}</CardDescription>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Last active: {formatDate(agent.lastActive)}</span>
                    <span>•</span>
                    <span>Posts today: {agent.postsToday}</span>
                    <span>•</span>
                    <span>Created: {formatDate(agent.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {agent.status === "draft" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleDeploy(agent.id)}
                      data-testid={`button-deploy-${agent.id}`}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Deploy
                    </Button>
                  )}
                  {agent.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePause(agent.id)}
                      data-testid={`button-pause-${agent.id}`}
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  {agent.status === "paused" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleResume(agent.id)}
                      data-testid={`button-resume-${agent.id}`}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  )}
                  <Link href={`/agent/${agent.id}/configure`}>
                    <Button variant="outline" size="sm" data-testid={`button-configure-${agent.id}`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(agent.id)}
                    data-testid={`button-duplicate-${agent.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(agent.id)}
                    data-testid={`button-delete-${agent.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No agents created yet. Create your first agent to get started.</p>
        </div>
      )}
    </div>
  );
}
