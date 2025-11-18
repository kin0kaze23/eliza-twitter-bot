import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type KBEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
};

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({ category: "general", title: "", content: "" });
  const [entries, setEntries] = useState<KBEntry[]>([
    {
      id: "1",
      category: "crypto",
      title: "Bitcoin Basics",
      content: "Bitcoin is a decentralized digital currency that operates on a peer-to-peer network...",
    },
    {
      id: "2",
      category: "crypto",
      title: "DeFi Overview",
      content: "Decentralized Finance (DeFi) refers to financial services using smart contracts on blockchain...",
    },
    {
      id: "3",
      category: "general",
      title: "Agent Guidelines",
      content: "Always provide accurate information, cite sources when possible, and maintain a helpful tone...",
    },
  ]);

  const handleAddEntry = () => {
    if (!newEntry.title || !newEntry.content) return;
    
    const entry: KBEntry = {
      id: Date.now().toString(),
      ...newEntry,
    };
    
    setEntries([entry, ...entries]);
    setNewEntry({ category: "general", title: "", content: "" });
    setIsAddDialogOpen(false);
    
    toast({
      title: "Entry added",
      description: "Knowledge base entry has been created successfully.",
    });
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
    toast({
      title: "Entry deleted",
      description: "Knowledge base entry has been removed.",
    });
  };

  const filteredEntries = entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Manage the agent's knowledge and reference material</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-entry">
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Knowledge Base Entry</DialogTitle>
              <DialogDescription>Create a new entry to expand the agent's knowledge</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={newEntry.category} onValueChange={(v) => setNewEntry({ ...newEntry, category: v })}>
                  <SelectTrigger id="category" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                  placeholder="Entry title..."
                  data-testid="input-entry-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                  placeholder="Knowledge base content..."
                  className="min-h-[200px] font-mono text-sm"
                  data-testid="input-entry-content"
                />
                <p className="text-xs text-muted-foreground">{newEntry.content.length} characters</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddEntry} data-testid="button-save-entry">Add Entry</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      <div className="grid gap-4">
        {filteredEntries.map((entry) => (
          <Card key={entry.id} data-testid={`card-entry-${entry.id}`}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{entry.title}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {entry.category}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" data-testid={`button-edit-${entry.id}`}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteEntry(entry.id)}
                  data-testid={`button-delete-${entry.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{entry.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEntries.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No knowledge base entries found</p>
        </div>
      )}
    </div>
  );
}
