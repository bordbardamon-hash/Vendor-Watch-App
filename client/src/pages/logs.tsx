import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal as TerminalIcon, Search, Pause, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  module: string;
  message: string;
}

const mockLogs: LogEntry[] = [
  { id: 1, timestamp: "2024-03-20 14:23:01", level: 'INFO', module: 'scheduler', message: 'Starting job scheduler service...' },
  { id: 2, timestamp: "2024-03-20 14:23:02", level: 'INFO', module: 'worker.main', message: 'Worker pool initialized with 4 threads' },
  { id: 3, timestamp: "2024-03-20 14:23:05", level: 'DEBUG', module: 'scraper.amazon', message: 'Requesting https://amazon.com/dp/B08...' },
  { id: 4, timestamp: "2024-03-20 14:23:06", level: 'INFO', module: 'scraper.amazon', message: 'Successfully parsed product data: "Wireless Headphones"' },
  { id: 5, timestamp: "2024-03-20 14:23:10", level: 'WARN', module: 'network', message: 'High latency detected on proxy server us-east-1' },
  { id: 6, timestamp: "2024-03-20 14:23:15", level: 'ERROR', module: 'scraper.weather', message: 'ConnectionRefusedError: [Errno 111] Connection refused' },
  { id: 7, timestamp: "2024-03-20 14:23:16", level: 'INFO', module: 'scheduler', message: 'Retrying job weather-api in 60s...' },
];

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>(mockLogs);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Simulate live logs
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').split('.')[0],
        level: Math.random() > 0.9 ? 'ERROR' : Math.random() > 0.7 ? 'WARN' : 'INFO',
        module: ['scraper.core', 'network', 'db.writer', 'scheduler'][Math.floor(Math.random() * 4)],
        message: `Processing batch operation #${Math.floor(Math.random() * 1000)}...`
      };
      setLogs(prev => [...prev.slice(-100), newLog]);
    }, 2000);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Auto-scroll
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TerminalIcon className="w-6 h-6 text-primary" />
          Live Terminal
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filter logs..." className="pl-8 bg-sidebar border-sidebar-border" />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsPaused(!isPaused)}
            className={isPaused ? "text-amber-500 border-amber-500/50 bg-amber-500/10" : ""}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </Button>
          <Button variant="outline" size="icon">
            <Download size={16} />
          </Button>
        </div>
      </div>

      <Card className="flex-1 bg-black border-sidebar-border overflow-hidden font-mono text-sm relative group">
        <div className="absolute top-0 left-0 w-full h-8 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-amber-500/50" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
          <span className="ml-2">runner@scraper-os:~/logs/production.log</span>
        </div>
        
        <div 
          ref={scrollRef}
          className="h-full pt-10 pb-4 px-4 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent"
        >
          {logs.map((log) => (
            <div key={log.id} className="flex gap-4 py-0.5 hover:bg-white/5 transition-colors">
              <span className="text-muted-foreground/50 shrink-0 select-none w-36">{log.timestamp}</span>
              <span className={`w-16 shrink-0 font-bold ${
                log.level === 'ERROR' ? 'text-red-500' :
                log.level === 'WARN' ? 'text-amber-500' :
                log.level === 'DEBUG' ? 'text-blue-500' :
                'text-emerald-500'
              }`}>
                {log.level}
              </span>
              <span className="text-purple-400 shrink-0 w-32 hidden md:block">[{log.module}]</span>
              <span className="text-gray-300 break-all">{log.message}</span>
            </div>
          ))}
          {/* Cursor effect */}
          <div className="w-2 h-4 bg-primary animate-pulse mt-1" />
        </div>
      </Card>
    </div>
  );
}
