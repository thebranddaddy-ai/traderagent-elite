import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Brain,
  Heart,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  X,
  RefreshCw,
} from "lucide-react";

export default function TradeJournal() {
  const { toast } = useToast();
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [tags, setTags] = useState("");
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Fetch journal entries
  const { data: journalEntries, isLoading, refetch } = useQuery({
    queryKey: ["/api/trade-journal"],
  });

  // Add notes mutation
  const addNotesMutation = useMutation({
    mutationFn: async ({ entryId, notes, tags }: { entryId: string; notes: string; tags?: string[] }) => {
      return await apiRequest("POST", `/api/trade-journal/${entryId}/notes`, { notes, tags });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trade-journal"] });
      setEditingNotes(null);
      toast({
        title: "Notes Saved",
        description: "Your notes have been added to the journal entry",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    },
  });

  const toggleExpand = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const startEditingNotes = (entryId: string, currentNotes?: string, currentTags?: string[]) => {
    setEditingNotes(entryId);
    setNotesText(currentNotes || "");
    setTags(currentTags ? currentTags.join(", ") : "");
  };

  const saveNotes = (entryId: string) => {
    const tagArray = tags.trim() ? tags.split(",").map(t => t.trim()).filter(t => t) : [];
    addNotesMutation.mutate({ entryId, notes: notesText, tags: tagArray.length > 0 ? tagArray : [] });
    setTags("");
  };

  const cancelEdit = () => {
    setEditingNotes(null);
    setNotesText("");
    setTags("");
  };

  const entries = (journalEntries as any)?.entries || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Trade Journal</h1>
            <p className="text-muted-foreground">Auto-logged trades with AI-generated insights</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading journal entries...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Trade Journal</h1>
          <p className="text-muted-foreground">Auto-logged trades with AI-generated insights</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <BookOpen className="h-4 w-4" />
          {entries.length} Entries
        </Badge>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">No journal entries yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Trades will be automatically logged here with AI-generated insights
            </p>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              className="gap-2"
              data-testid="button-refresh-journal"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry: any) => {
            const isExpanded = expandedEntries.has(entry.id);
            const isEditing = editingNotes === entry.id;
            const isProfitable = entry.profitLoss && parseFloat(entry.profitLoss) > 0;

            return (
              <Card key={entry.id} className="hover-elevate">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{entry.symbol}</CardTitle>
                        <Badge variant={entry.side === "buy" ? "default" : "secondary"}>
                          {entry.side.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{entry.tradeType}</Badge>
                        {entry.profitLoss && (
                          <Badge variant={isProfitable ? "default" : "destructive"} className="gap-1">
                            {isProfitable ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            ${parseFloat(entry.profitLoss).toFixed(2)}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {new Date(entry.timestamp).toLocaleString()} • {parseFloat(entry.quantity).toFixed(4)} @ $
                        {parseFloat(entry.entryPrice).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(entry.id)}
                      data-testid={`button-toggle-${entry.id}`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>

                <Collapsible open={isExpanded}>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      <Separator />

                      {/* AI Insights */}
                      {entry.aiInsights && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" />
                            <h4 className="text-sm font-semibold">AI Insights</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{entry.aiInsights}</p>
                        </div>
                      )}

                      {/* Patterns Detected */}
                      {entry.patternsDetected && entry.patternsDetected.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" />
                            <h4 className="text-sm font-semibold">Patterns Detected</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {entry.patternsDetected.map((pattern: string, idx: number) => (
                              <Badge key={idx} variant="outline">
                                {pattern}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Emotional State */}
                      {entry.emotionalState && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-primary" />
                            <h4 className="text-sm font-semibold">Emotional State</h4>
                          </div>
                          <Badge variant="secondary">{entry.emotionalState}</Badge>
                        </div>
                      )}

                      {/* Lessons Learned */}
                      {entry.lessonsLearned && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-primary" />
                            <h4 className="text-sm font-semibold">Lessons Learned</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{entry.lessonsLearned}</p>
                        </div>
                      )}

                      <Separator />

                      {/* User Notes */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Edit className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-semibold">Your Notes</h4>
                          </div>
                          {!isEditing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditingNotes(entry.id, entry.userNotes, entry.tags)}
                              data-testid={`button-edit-notes-${entry.id}`}
                            >
                              {entry.userNotes ? "Edit" : "Add Notes"}
                            </Button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              placeholder="Add your thoughts, reflections, or lessons..."
                              className="min-h-[100px]"
                              data-testid={`textarea-notes-${entry.id}`}
                            />
                            <Input
                              value={tags}
                              onChange={(e) => setTags(e.target.value)}
                              placeholder="Tags (comma-separated)"
                              data-testid={`input-tags-${entry.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => saveNotes(entry.id)}
                                size="sm"
                                disabled={addNotesMutation.isPending}
                                data-testid={`button-save-notes-${entry.id}`}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                onClick={cancelEdit}
                                size="sm"
                                data-testid={`button-cancel-notes-${entry.id}`}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : entry.userNotes ? (
                          <p className="text-sm text-muted-foreground">{entry.userNotes}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No notes added yet</p>
                        )}

                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {entry.tags.map((tag: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
