import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Play, Pause, Trash2, Clock, Globe, AlertCircle, RotateCw, FlaskConical, Code, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { stableHash } from "@/lib/hash";

const initialJobs = [
  { id: 1, name: "Amazon Price Monitor", target: "amazon.com/products/tech", schedule: "Every 1h", status: "Running", lastRun: "10m ago", success: true },
  { id: 2, name: "TechCrunch Scraper", target: "techcrunch.com", schedule: "Every 6h", status: "Idle", lastRun: "2h ago", success: true },
  { id: 3, name: "Weather API Poll", target: "api.weather.com/v1", schedule: "Every 15m", status: "Failed", lastRun: "5m ago", success: false },
  { id: 4, name: "Twitter Sentiment", target: "twitter.com/search", schedule: "Daily", status: "Idle", lastRun: "1d ago", success: true },
];

export default function Jobs() {
  const [jobs, setJobs] = useState(initialJobs);
  const { toast } = useToast();

  const toggleStatus = (id: number) => {
    setJobs(jobs.map(job => {
      if (job.id === id) {
        const newStatus = job.status === "Running" ? "Idle" : "Running";
        toast({
          title: `Job ${newStatus === "Running" ? "Started" : "Stopped"}`,
          description: `Successfully ${newStatus === "Running" ? "started" : "stopped"} ${job.name}`,
        });
        return { ...job, status: newStatus };
      }
      return job;
    }));
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Scheduler</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor your Python scraping tasks</p>
        </div>
        <NewJobDialog />
      </div>

      <div className="grid gap-4">
        {jobs.map((job) => (
          <Card key={job.id} className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm transition-all hover:bg-sidebar/50">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`p-3 rounded-full ${job.status === 'Running' ? 'bg-primary/20 text-primary animate-pulse' : 'bg-secondary text-muted-foreground'}`}>
                  <RotateCw size={24} className={job.status === 'Running' ? 'animate-spin' : ''} />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{job.name}</h3>
                    <Badge variant={job.status === 'Running' ? 'default' : 'secondary'} className={job.status === 'Running' ? 'bg-primary/20 text-primary border-primary/20 hover:bg-primary/30' : ''}>
                      {job.status}
                    </Badge>
                    {!job.success && (
                      <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/20 hover:bg-red-500/30">
                        Last Run Failed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                    <span className="flex items-center gap-1"><Globe size={12} /> {job.target}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {job.schedule}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => toggleStatus(job.id)}
                  className="rounded-full hover:bg-primary/20 hover:text-primary border-sidebar-border"
                >
                  {job.status === 'Running' ? <Pause size={16} /> : <Play size={16} />}
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full">
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewJobDialog() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("configure");
  const [testUrl, setTestUrl] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Job Created",
      description: "New scraping job has been added to the queue.",
    });
  };

  const handleTestScrape = async () => {
    if (!testUrl) return;
    
    setIsTesting(true);
    setTestResult(null);

    // Simulate network delay
    setTimeout(async () => {
      const mockText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Status Update: System is fully operational as of today.";
      const incidentId = await stableHash(testUrl);
      const rawHash = await stableHash(mockText);
      
      const result = [{
        "vendor_key": "custom_vendor",
        "incident_id": incidentId.substring(0, 16),
        "title": "Status Update: Operational",
        "status": "page_change",
        "severity": "UNKNOWN",
        "impact": "",
        "url": testUrl,
        "raw_hash": rawHash
      }];

      setTestResult(result);
      setIsTesting(false);
      
      toast({
        title: "Test Complete",
        description: "Scraper successfully extracted data.",
      });
    }, 1500);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          + New Scraper Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-sidebar border-sidebar-border">
        <DialogHeader>
          <DialogTitle>Job Configuration</DialogTitle>
          <DialogDescription>
            Configure a scraping task or test the parser logic.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-black/20">
            <TabsTrigger value="configure">Configure Job</TabsTrigger>
            <TabsTrigger value="test">Test Scraper</TabsTrigger>
          </TabsList>
          
          <TabsContent value="configure" className="py-4">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Job Name</Label>
                <Input id="name" placeholder="e.g. Price Monitor" className="bg-background" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">Target URL</Label>
                <Input id="url" placeholder="https://..." className="bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="schedule">Schedule</Label>
                  <Select defaultValue="hourly">
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="method">Method</Label>
                  <Select defaultValue="get">
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="get">GET</SelectItem>
                      <SelectItem value="post">POST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="mt-4 w-full">Create Job</Button>
            </form>
          </TabsContent>

          <TabsContent value="test" className="py-4 space-y-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="test-url">Test URL</Label>
                <div className="flex gap-2">
                  <Input 
                    id="test-url" 
                    placeholder="https://example.com/status" 
                    className="bg-background font-mono text-sm"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                  />
                  <Button onClick={handleTestScrape} disabled={isTesting || !testUrl}>
                    {isTesting ? <RotateCw className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                    <span className="ml-2">Run Test</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simulates <code>requests.get(url)</code> and runs <code>scrape_generic</code>.
                </p>
              </div>

              {testResult && (
                <div className="rounded-md border border-sidebar-border bg-black/40 overflow-hidden">
                  <div className="bg-sidebar border-b border-sidebar-border px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-medium flex items-center gap-2">
                      <Code className="w-3 h-3 text-primary" />
                      Output Payload
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/30 text-emerald-500">
                      SUCCESS
                    </Badge>
                  </div>
                  <ScrollArea className="h-[200px] w-full p-4">
                    <pre className="text-xs font-mono text-muted-foreground">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
