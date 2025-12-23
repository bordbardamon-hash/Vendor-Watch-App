import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  HelpCircle,
  Loader2,
  User,
  Calendar
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Feedback {
  id: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

export default function FeedbackAdmin() {
  const { data: feedback = [], isLoading } = useQuery<Feedback[]>({
    queryKey: ["feedback"],
    queryFn: async () => {
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return res.json();
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <Bug className="w-4 h-4 text-red-400" />;
      case 'feature':
        return <Lightbulb className="w-4 h-4 text-yellow-400" />;
      case 'question':
        return <HelpCircle className="w-4 h-4 text-blue-400" />;
      default:
        return <MessageSquare className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'bug':
        return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">Bug Report</Badge>;
      case 'feature':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Feature Request</Badge>;
      case 'question':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">Question</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">General</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">New</Badge>;
      case 'reviewed':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Reviewed</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Feedback</h1>
        <p className="text-muted-foreground mt-1">Review feedback submitted by users</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{feedback.length}</div>
            <div className="text-sm text-muted-foreground">Total Submissions</div>
          </CardContent>
        </Card>
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">
              {feedback.filter(f => f.type === 'bug').length}
            </div>
            <div className="text-sm text-muted-foreground">Bug Reports</div>
          </CardContent>
        </Card>
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-400">
              {feedback.filter(f => f.type === 'feature').length}
            </div>
            <div className="text-sm text-muted-foreground">Feature Requests</div>
          </CardContent>
        </Card>
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {feedback.filter(f => f.status === 'new').length}
            </div>
            <div className="text-sm text-muted-foreground">Unreviewed</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-sidebar/20 border-sidebar-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            All Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No feedback submitted yet.</p>
              <p className="text-sm opacity-50">User submissions will appear here.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {feedback.map((item) => (
                  <Card key={item.id} className="bg-background border-sidebar-border" data-testid={`card-feedback-${item.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(item.type)}
                          <h3 className="font-semibold">{item.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTypeBadge(item.type)}
                          {getStatusBadge(item.status)}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          User ID: {item.userId.substring(0, 8)}...
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
