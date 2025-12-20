import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  List, 
  Terminal, 
  Settings, 
  Bot,
  Activity,
  Shield,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UI_LABELS } from "@/lib/labels";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: UI_LABELS.nav.overview },
    { href: "/vendors", icon: Shield, label: UI_LABELS.nav.vendorsIncidents },
    { href: "/jobs", icon: List, label: UI_LABELS.nav.scrapers },
    { href: "/logs", icon: Terminal, label: UI_LABELS.nav.logs },
    { href: "/settings", icon: Settings, label: UI_LABELS.nav.config },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "border-r border-border bg-sidebar flex flex-col transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground shrink-0">
            <Bot size={20} />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-lg tracking-tight">Vendor Watch</span>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  location === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                  !sidebarOpen && "justify-center px-2"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon size={18} className="shrink-0" />
                {sidebarOpen && item.label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "w-full text-muted-foreground hover:text-foreground",
              !sidebarOpen && "px-2"
            )}
            data-testid="button-toggle-sidebar"
          >
            {sidebarOpen ? (
              <>
                <PanelLeftClose size={16} className="mr-2" />
                Collapse
              </>
            ) : (
              <PanelLeft size={16} />
            )}
          </Button>
          
          {sidebarOpen && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-sidebar-accent/30 text-xs text-muted-foreground">
              <Activity size={14} className="text-primary animate-pulse" />
              <span>System Online</span>
              <span className="ml-auto font-mono text-[10px] opacity-70">v1.2.0</span>
            </div>
          )}
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
