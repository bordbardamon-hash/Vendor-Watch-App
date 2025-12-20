import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  List, 
  Terminal, 
  Settings, 
  Bot,
  Activity,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Overview" },
    { href: "/vendors", icon: Shield, label: "Vendors & Incidents" },
    { href: "/jobs", icon: List, label: "Scrapers" },
    { href: "/logs", icon: Terminal, label: "Live Logs" },
    { href: "/settings", icon: Settings, label: "Configuration" },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <Bot size={20} />
          </div>
          <span className="font-bold text-lg tracking-tight">Vendor Watch</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  location === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </a>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-sidebar-accent/30 text-xs text-muted-foreground">
            <Activity size={14} className="text-primary animate-pulse" />
            <span>System Online</span>
            <span className="ml-auto font-mono text-[10px] opacity-70">v1.2.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
