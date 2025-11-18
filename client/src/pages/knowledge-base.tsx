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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Edit, Trash2, Search, Upload, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type KBEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

type ChangeLog = {
  id: string;
  action: "added" | "updated" | "deleted";
  entryTitle: string;
  timestamp: Date;
};

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({ 
    category: "general", 
    title: "", 
    content: "",
    tags: ""
  });
  
  const [entries, setEntries] = useState<KBEntry[]>([
    {
      id: "1",
      category: "crypto",
      title: "Bitcoin Basics",
      content: "Bitcoin is a decentralized digital currency that operates on a peer-to-peer network without central authority. Key features: limited supply (21M), proof-of-work consensus, blockchain ledger.",
      tags: ["bitcoin", "cryptocurrency", "blockchain"],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: "2",
      category: "crypto",
      title: "DeFi Overview",
      content: "Decentralized Finance (DeFi) refers to financial services using smart contracts on blockchain networks. Includes: DEXs, lending protocols, yield farming, liquidity pools. Major platforms: Uniswap, Aave, Compound.",
      tags: ["defi", "smart-contracts", "ethereum"],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: "3",
      category: "general",
      title: "Agent Response Guidelines",
      content: "Always provide accurate, verifiable information. Cite sources when possible. Maintain professional tone. Avoid financial advice. Disclose uncertainty. Focus on education over speculation.",
      tags: ["guidelines", "best-practices"],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ]);

  const [changeLog, setChangeLog] = useState<ChangeLog[]>([
    { id: "1", action: "added", entryTitle: "Agent Response Guidelines", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { id: "2", action: "added", entryTitle: "DeFi Overview", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    { id: "3", action: "added", entryTitle: "Bitcoin Basics", timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  ]);

  const handleAddEntry = () => {
    if (!newEntry.title || !newEntry.content) return;
    
    const entry: KBEntry = {
      id: Date.now().toString(),
      category: newEntry.category,
      title: newEntry.title,
      content: newEntry.content,
      tags: newEntry.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setEntries([entry, ...entries]);
    
    // Log the change
    const log: ChangeLog = {
      id: Date.now().toString(),
      action: "added",
      entryTitle: entry.title,
      timestamp: new Date(),
    };
    setChangeLog([log, ...changeLog]);
    
    setNewEntry({ category: "general", title: "", content: "", tags: "" });
    setIsAddDialogOpen(false);
    
    toast({
      title: "Entry added",
      description: "Knowledge base entry has been created and logged successfully.",
    });
  };

  const handleDeleteEntry = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    setEntries(entries.filter(e => e.id !== id));
    
    // Log the change
    const log: ChangeLog = {
      id: Date.now().toString(),
      action: "deleted",
      entryTitle: entry.title,
      timestamp: new Date(),
    };
    setChangeLog([log, ...changeLog]);
    
    toast({
      title: "Entry deleted",
      description: "Knowledge base entry has been removed and logged.",
    });
  };

  const handleBulkImport = () => {
    toast({
      title: "Bulk import",
      description: "Bulk import feature ready. Upload JSON or CSV files with KB entries.",
    });
  };

  const filteredEntries = entries.filter(
    (entry) => {
      const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === "all" || entry.category === categoryFilter;
      return matchesSearch && matchesCategory;
    }
  );

  const formatDate = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const categories = Array.from(new Set(entries.map(e => e.category)));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Manage the agent's knowledge and reference material</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBulkImport} data-testid="button-bulk-import">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
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
                      <SelectItem value="defi">DeFi</SelectItem>
                      <SelectItem value="nft">NFT</SelectItem>
                      <SelectItem value="news">News</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="trading">Trading</SelectItem>
                      <SelectItem value="blockchain">Blockchain</SelectItem>
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
                    placeholder="Knowledge base content... (supports up to 50,000 characters)"
                    className="min-h-[200px] font-mono text-sm"
                    data-testid="input-entry-content"
                  />
                  <p className="text-xs text-muted-foreground">{newEntry.content.length} / 50,000 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={newEntry.tags}
                    onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                    placeholder="bitcoin, trading, analysis"
                    data-testid="input-entry-tags"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddEntry} data-testid="button-save-entry">Add Entry</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger data-testid="select-category-filter">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Entries ({filteredEntries.length})</h2>
          {filteredEntries.map((entry) => (
            <Card key={entry.id} data-testid={`card-entry-${entry.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{entry.title}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {entry.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDate(entry.updatedAt)}
                  </p>
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
                <p className="text-sm text-muted-foreground line-clamp-3">{entry.content}</p>
              </CardContent>
            </Card>
          ))}

          {filteredEntries.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No knowledge base entries found</p>
            </div>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Change Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changeLog.slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <Badge 
                      variant={log.action === "added" ? "default" : log.action === "deleted" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {log.action}
                    </Badge>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium line-clamp-1">{log.entryTitle}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Entries</span>
                <span className="text-sm font-semibold">{entries.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Categories</span>
                <span className="text-sm font-semibold">{categories.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Tags</span>
                <span className="text-sm font-semibold">
                  {Array.from(new Set(entries.flatMap(e => e.tags))).length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
