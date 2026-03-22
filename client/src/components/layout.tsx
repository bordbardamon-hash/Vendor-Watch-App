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
  FileCheck,
  Boxes,
  MessageSquare,
  Wrench,
  Menu,
  BarChart3,
  Target,
  Server,
  Users,
  UsersRound,
  BookOpen,
  Smartphone,
  Settings2,
  Globe,
  Ticket,
  TrendingUp,
  Webhook,
  Key,
  FileText,
  ClipboardList,
  Lock,
  Search,
  AlertTriangle,
  ChevronDown,
  Bell,
  Trophy,
  TrendingDown,
  Newspaper
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UI_LABELS, APP_NAME } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VendorWatchLogo } from "@/components/ui/vendor-watch-logo";
import { CommandSearch } from "@/components/command-search";

type NavItem = { href: string; icon: any; label: string; adminOnly: boolean; ownerOnly: boolean; requiresEssential?: boolean; requiresGrowth?: boolean; requiresEnterprise?: boolean };

type NavSection = {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const saveScrollPosition = useCallback(() => {
    if (scrollRef.current) {
      scrollPositionRef.current = scrollRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [location]);

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const isFree = user?.subscriptionTier === 'free';
  const isEssentialOrHigher = user?.subscriptionTier === 'essential' || user?.subscriptionTier === 'growth' || user?.subscriptionTier === 'enterprise';
  const isGrowthOrHigher = user?.subscriptionTier === 'growth' || user?.subscriptionTier === 'enterprise';
  const isEnterprise = user?.subscriptionTier === 'enterprise';

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const navSections: NavSection[] = [
    {
      title: "Monitoring",
      items: [
        { href: "/", icon: LayoutDashboard, label: UI_LABELS.nav.overview, adminOnly: false, ownerOnly: false },
        { href: "/vendors", icon: Shield, label: UI_LABELS.nav.vendors, adminOnly: false, ownerOnly: false },
        { href: "/incidents", icon: AlertTriangle, label: UI_LABELS.nav.incidents, adminOnly: false, ownerOnly: false },
        { href: "/blockchain", icon: Boxes, label: "Blockchain", adminOnly: false, ownerOnly: false },
        { href: "/maintenance", icon: Wrench, label: "Maintenance", adminOnly: false, ownerOnly: false },
        { href: "/monitoring", icon: Activity, label: "Website Monitoring", adminOnly: false, ownerOnly: false },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { href: "/analytics", icon: BarChart3, label: "Analytics", adminOnly: false, ownerOnly: false, requiresEssential: true },
        { href: "/sla", icon: Target, label: "SLA Dashboard", adminOnly: false, ownerOnly: false, requiresEssential: true },
        { href: "/vendor-reliability", icon: Trophy, label: "Reliability Scores", adminOnly: false, ownerOnly: false },
        { href: "/outages", icon: Newspaper, label: "Outage Reports", adminOnly: false, ownerOnly: false },
        { href: "/dependency-map", icon: Activity, label: "Dependency Map", adminOnly: false, ownerOnly: false },
        { href: "/predictions", icon: TrendingUp, label: "Predictions", adminOnly: false, ownerOnly: false, requiresEnterprise: true },
        { href: "/reports", icon: FileText, label: "Reports", adminOnly: false, ownerOnly: false, requiresGrowth: true },
        { href: "/automation", icon: Bot, label: "Automation", adminOnly: false, ownerOnly: false, requiresEssential: true },
      ],
      collapsible: true,
      defaultCollapsed: true,
    },
    {
      title: "MSP Tools",
      items: [
        { href: "/clients", icon: Users, label: "Clients", adminOnly: false, ownerOnly: false, requiresGrowth: true },
        { href: "/playbooks", icon: BookOpen, label: "Playbooks", adminOnly: false, ownerOnly: false, requiresGrowth: true },
        { href: "/portals", icon: Globe, label: "Client Portals", adminOnly: false, ownerOnly: false, requiresGrowth: true },
        { href: "/mobile-status", icon: Smartphone, label: "Mobile Status", adminOnly: false, ownerOnly: false, requiresGrowth: true },
      ],
      collapsible: true,
      defaultCollapsed: true,
    },
    {
      title: "Integrations",
      items: [
        { href: "/integrations", icon: Settings2, label: "Integrations", adminOnly: false, ownerOnly: false, requiresEssential: true },
        { href: "/api-keys", icon: Key, label: "API Access", adminOnly: false, ownerOnly: false, requiresEnterprise: true },
      ],
      collapsible: true,
      defaultCollapsed: true,
    },
    {
      title: "Settings",
      items: [
        { href: "/settings", icon: Settings, label: UI_LABELS.nav.config, adminOnly: false, ownerOnly: false },
        { href: "/team", icon: UsersRound, label: "Team", adminOnly: false, ownerOnly: false },
        { href: "/sso", icon: Lock, label: "SSO", adminOnly: false, ownerOnly: false, requiresEnterprise: true },
        { href: "/audit-logs", icon: ClipboardList, label: "Audit Logs", adminOnly: true, ownerOnly: false },
      ],
      collapsible: true,
      defaultCollapsed: true,
    },
    {
      title: "Admin",
      items: [
        { href: "/jobs", icon: List, label: UI_LABELS.nav.scrapers, adminOnly: true, ownerOnly: false },
        { href: "/logs", icon: Terminal, label: UI_LABELS.nav.logs, adminOnly: true, ownerOnly: false },
        { href: "/consents", icon: FileCheck, label: "Consents", adminOnly: true, ownerOnly: false },
        { href: "/feedback", icon: MessageSquare, label: "Feedback", adminOnly: true, ownerOnly: false },
        { href: "/parser-health", icon: Server, label: "Parser Health", adminOnly: false, ownerOnly: true },
        { href: "/users", icon: Users, label: "Users", adminOnly: false, ownerOnly: true },
        { href: "/blog-admin", icon: Newspaper, label: "Outage Blog", adminOnly: false, ownerOnly: true },
      ],
      collapsible: true,
      defaultCollapsed: true,
    },
  ];

  const filterItems = (items: NavItem[]) => items.filter(item => {
    if (item.ownerOnly && !user?.isOwner) return false;
    if (item.adminOnly && !user?.isAdmin) return false;
    if (item.requiresEssential && !isEssentialOrHigher) return false;
    if (item.requiresGrowth && !isGrowthOrHigher) return false;
    if (item.requiresEnterprise && !isEnterprise) return false;
    return true;
  });

  const handleNavClick = () => {
    saveScrollPosition();
    setMobileMenuOpen(false);
  };

  const sectionHasActiveItem = (items: NavItem[]) => {
    return items.some(item => location === item.href);
  };

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      <nav ref={isMobile ? undefined : scrollRef} className="flex-1 p-2 overflow-y-auto">
        <button
          onClick={() => { setCommandOpen(true); handleNavClick(); }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 mb-2 rounded-md text-sm text-muted-foreground border border-border/50 hover:bg-sidebar-accent/50 hover:text-foreground transition-all cursor-pointer",
            !sidebarOpen && !isMobile && "justify-center px-2"
          )}
          data-testid="button-quick-search"
        >
          <Search size={16} className="shrink-0" />
          {(sidebarOpen || isMobile) && (
            <>
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </>
          )}
        </button>

        {navSections.map((section) => {
          const visibleItems = filterItems(section.items);
          if (visibleItems.length === 0) return null;
          
          const sectionIsCollapsed = section.title in collapsedSections ? collapsedSections[section.title] : !!section.defaultCollapsed;
          const isCollapsed = section.collapsible && (sidebarOpen || isMobile) && sectionIsCollapsed && !sectionHasActiveItem(visibleItems);
          const canCollapse = section.collapsible && (sidebarOpen || isMobile);

          return (
            <div key={section.title} className="mb-1">
              {(sidebarOpen || isMobile) ? (
                <button
                  onClick={canCollapse ? () => toggleSection(section.title) : undefined}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider",
                    canCollapse && "hover:text-muted-foreground cursor-pointer"
                  )}
                >
                  <span>{section.title}</span>
                  {canCollapse && (
                    <ChevronDown size={12} className={cn("transition-transform", isCollapsed && "-rotate-90")} />
                  )}
                </button>
              ) : (
                <div className="h-px bg-border/30 mx-2 my-1" />
              )}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={handleNavClick}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer",
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
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-2 shrink-0">
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
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-destructive/10"
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
                <LogOut size={14} className="mr-1" />
                Sign Out
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
      <CommandSearch open={commandOpen} onOpenChange={setCommandOpen} />

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <VendorWatchLogo size={32} />
            <span className="font-bold text-lg tracking-tight">Vendor Watch</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="button-mobile-notifications">
                <Bell size={20} />
              </Button>
            </Link>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu size={24} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
                <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
                  <VendorWatchLogo size={32} />
                  <span className="font-bold text-lg tracking-tight">Vendor Watch</span>
                </div>
                <div className="flex flex-col h-[calc(100vh-65px)]">
                  <NavContent isMobile={true} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <aside className={cn(
        "hidden md:flex border-r border-border bg-sidebar flex-col transition-all duration-300 overflow-hidden",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <VendorWatchLogo size={32} />
          {sidebarOpen && (
            <>
              <span className="font-bold text-lg tracking-tight flex-1">Vendor Watch</span>
              <Link href="/settings">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" data-testid="button-desktop-notifications">
                  <Bell size={16} />
                </Button>
              </Link>
            </>
          )}
        </div>
        <NavContent />
      </aside>

      <main className="flex-1 overflow-auto bg-background pt-14 md:pt-0">
        <div className="min-h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
