import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface FeedbackDialogProps {
  collapsed?: boolean;
}

export function FeedbackDialog({ collapsed }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("suggestion");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const submitFeedback = useMutation({
    mutationFn: async (data: { type: string; title: string; description: string }) => {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error("Failed to submit feedback");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Feedback submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      setOpen(false);
      setType("suggestion");
      setTitle("");
      setDescription("");
    },
    onError: () => {
      toast.error("Failed to submit feedback. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    submitFeedback.mutate({ type, title, description });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={collapsed ? "w-full px-2 justify-center" : "w-full justify-start"}
          data-testid="button-feedback"
        >
          <MessageSquarePlus size={16} className={collapsed ? "" : "mr-2"} />
          {!collapsed && "Send Feedback"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help us improve by sharing your suggestions or reporting issues.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type" data-testid="select-feedback-type">
                  <SelectValue placeholder="Select feedback type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggestion" data-testid="option-suggestion">
                    Suggestion
                  </SelectItem>
                  <SelectItem value="bug" data-testid="option-bug">
                    Bug Report
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder={type === "bug" ? "Brief description of the issue" : "What's your idea?"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-feedback-title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder={
                  type === "bug"
                    ? "Steps to reproduce, expected vs actual behavior..."
                    : "Tell us more about your suggestion..."
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                data-testid="input-feedback-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitFeedback.isPending}
              data-testid="button-submit-feedback"
            >
              {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
