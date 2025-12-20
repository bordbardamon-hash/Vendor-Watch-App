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
  PanelLeft,
  LogOut,
  User,
  FileCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UI_LABELS, APP_NAME } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeedbackDialog } from "@/components/feedback-dialog";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: UI_LABELS.nav.overview },
    { href: "/vendors", icon: Shield, label: UI_LABELS.nav.vendorsIncidents },
    { href: "/jobs", icon: List, label: UI_LABELS.nav.scrapers },
    { href: "/logs", icon: Terminal, label: UI_LABELS.nav.logs },
    { href: "/consents", icon: FileCheck, label: "Consents" },
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
          {navItems.map((item, index) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer",
                  location === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground hover:translate-x-1",
                  !sidebarOpen && "justify-center px-2",
                  "animate-slide-in-left opacity-0"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon size={18} className="shrink-0" />
                {sidebarOpen && item.label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-2">
          {user && (
            <div className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-md bg-sidebar-accent/30",
              !sidebarOpen && "justify-center px-1"
            )}>
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-user-name">
                    {user.firstName || user.email || "User"}
                  </p>
                </div>
              )}
              {sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  asChild
                  data-testid="button-logout"
                >
                  <a href="/api/logout">
                    <LogOut size={14} />
                  </a>
                </Button>
              )}
            </div>
          )}

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
          
          <FeedbackDialog collapsed={!sidebarOpen} />

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
