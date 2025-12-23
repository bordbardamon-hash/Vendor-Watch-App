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
  FileCheck,
  Boxes,
  MessageSquare,
  Wrench,
  Menu,
  X,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UI_LABELS, APP_NAME } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    { href: "/", icon: LayoutDashboard, label: UI_LABELS.nav.overview, adminOnly: false },
    { href: "/vendors", icon: Shield, label: UI_LABELS.nav.vendorsIncidents, adminOnly: false },
    { href: "/blockchain", icon: Boxes, label: "Blockchain", adminOnly: false },
    { href: "/maintenance", icon: Wrench, label: "Maintenance", adminOnly: false },
    { href: "/analytics", icon: BarChart3, label: "Analytics", adminOnly: false },
    { href: "/jobs", icon: List, label: UI_LABELS.nav.scrapers, adminOnly: true },
    { href: "/logs", icon: Terminal, label: UI_LABELS.nav.logs, adminOnly: true },
    { href: "/consents", icon: FileCheck, label: "Consents", adminOnly: true },
    { href: "/feedback", icon: MessageSquare, label: "Feedback", adminOnly: true },
    { href: "/settings", icon: Settings, label: UI_LABELS.nav.config, adminOnly: false },
  ];

  const visibleNavItems = navItems.filter(item => !item.adminOnly || user?.isAdmin);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item, index) => (
          <Link key={item.href} href={item.href} onClick={handleNavClick}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer",
                location === item.href
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                !sidebarOpen && !isMobile && "justify-center px-2"
              )}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon size={18} className="shrink-0" />
              {(sidebarOpen || isMobile) && item.label}
            </div>
          </Link>
        ))}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-2">
        {user && (
          <div className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-md bg-sidebar-accent/30",
            !sidebarOpen && !isMobile && "justify-center px-1"
          )}>
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            {(sidebarOpen || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-user-name">
                  {user.firstName || user.email || "User"}
                </p>
              </div>
            )}
            {(sidebarOpen || isMobile) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  try {
                    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                  } catch (e) {
                    console.error("Logout error:", e);
                  }
                  window.location.href = "/";
                }}
                data-testid="button-logout"
              >
                <LogOut size={14} />
              </Button>
            )}
          </div>
        )}

        {!isMobile && (
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
        )}
        
        <FeedbackDialog collapsed={!sidebarOpen && !isMobile} />

        {(sidebarOpen || isMobile) && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-sidebar-accent/30 text-xs text-muted-foreground">
            <Activity size={14} className="text-primary animate-pulse" />
            <span>System Online</span>
            <span className="ml-auto font-mono text-[10px] opacity-70">v1.2.0</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <Bot size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight">Vendor Watch</span>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu size={24} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
              <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                  <Bot size={20} />
                </div>
                <span className="font-bold text-lg tracking-tight">Vendor Watch</span>
              </div>
              <div className="flex flex-col h-[calc(100vh-65px)]">
                <NavContent isMobile={true} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex border-r border-border bg-sidebar flex-col transition-all duration-300",
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
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background pt-14 md:pt-0">
        <div className="min-h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
