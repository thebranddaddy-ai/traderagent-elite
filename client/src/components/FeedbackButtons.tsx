import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface FeedbackButtonsProps {
  contextType: 'trade_suggestion' | 'briefing' | 'risk_warning' | 'pattern_alert';
  contextId: string;
  aiInput: Record<string, any>;
  aiOutput: Record<string, any>;
  aiReasoning: string;
  userAction?: 'accepted' | 'rejected' | 'modified' | 'ignored';
  onFeedbackSubmitted?: () => void;
}

export function FeedbackButtons({
  contextType,
  contextId,
  aiInput,
  aiOutput,
  aiReasoning,
  userAction,
  onFeedbackSubmitted
}: FeedbackButtonsProps) {
  const { toast } = useToast();
  const [feedbackType, setFeedbackType] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submittedFeedback, setSubmittedFeedback] = useState<string | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: async (feedback: {
      contextType: string;
      contextId: string;
      aiInput: Record<string, any>;
      aiOutput: Record<string, any>;
      aiReasoning: string;
      feedbackType: string;
      feedbackNotes?: string;
      userAction?: string;
    }) => {
      const response = await apiRequest("/api/ai/feedback", "POST", feedback);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/agent-health'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai/examples'] });
      
      toast({
        title: "Feedback recorded",
        description: "Your AI agent is learning from your input",
      });
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to record feedback",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleFeedback = (type: 'thumbs_up' | 'thumbs_down') => {
    // If already submitted, ignore
    if (submittedFeedback) return;

    setFeedbackType(type);
    
    // For thumbs down, always show notes dialog
    // For thumbs up, submit directly or show optional notes dialog
    if (type === 'thumbs_down') {
      setNotesDialogOpen(true);
    } else {
      // Direct submission for thumbs up
      submitFeedback(type, "");
    }
  };

  const submitFeedback = (type: 'thumbs_up' | 'thumbs_down', feedbackNotes: string) => {
    setSubmittedFeedback(type);
    
    feedbackMutation.mutate({
      contextType,
      contextId,
      aiInput,
      aiOutput,
      aiReasoning,
      feedbackType: type,
      feedbackNotes: feedbackNotes || undefined,
      userAction,
    });
    
    setNotesDialogOpen(false);
    setNotes("");
  };

  const handleNotesSubmit = () => {
    if (feedbackType) {
      submitFeedback(feedbackType, notes);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2" data-testid="feedback-buttons">
        <Button
          size="sm"
          variant={submittedFeedback === 'thumbs_up' ? 'default' : 'outline'}
          onClick={() => handleFeedback('thumbs_up')}
          disabled={!!submittedFeedback || feedbackMutation.isPending}
          data-testid="button-thumbs-up"
          className="gap-1.5"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          {submittedFeedback === 'thumbs_up' ? 'Helpful' : 'Helpful'}
        </Button>
        
        <Button
          size="sm"
          variant={submittedFeedback === 'thumbs_down' ? 'destructive' : 'outline'}
          onClick={() => handleFeedback('thumbs_down')}
          disabled={!!submittedFeedback || feedbackMutation.isPending}
          data-testid="button-thumbs-down"
          className="gap-1.5"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
          {submittedFeedback === 'thumbs_down' ? 'Not helpful' : 'Not helpful'}
        </Button>
      </div>

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent data-testid="dialog-feedback-notes">
          <DialogHeader>
            <DialogTitle>Help your AI learn</DialogTitle>
            <DialogDescription>
              Tell us why this recommendation wasn't helpful. Your feedback makes the AI smarter.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-notes">What went wrong? (optional)</Label>
              <Textarea
                id="feedback-notes"
                placeholder="e.g., The timing was off, or the analysis missed key factors..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                data-testid="textarea-feedback-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotesDialogOpen(false)}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNotesSubmit}
              data-testid="button-submit-feedback"
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
