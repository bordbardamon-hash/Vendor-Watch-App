import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Shield,
  Boxes,
  LayoutDashboard,
  BarChart3,
  Target,
  Activity,
  Wrench,
  Bot,
  Settings2,
  Users,
  BookOpen,
  Globe,
  Smartphone,
  Ticket,
  Webhook,
  Key,
  FileText,
  TrendingUp,
  Settings,
  Lock,
  UsersRound,
  ClipboardList,
} from "lucide-react";
import { LogoAvatar } from "@/components/ui/logo-avatar";

interface Vendor {
  key: string;
  name: string;
  category?: string;
  logoUrl?: string | null;
  status: string;
}

interface BlockchainChain {
  key: string;
  name: string;
  symbol?: string;
  category: string;
  status: string;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { href: "/vendors", label: "Vendors & Incidents", icon: Shield, keywords: "services monitoring status" },
  { href: "/blockchain", label: "Blockchain", icon: Boxes, keywords: "crypto chains networks" },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, keywords: "scheduled downtime" },
  { href: "/monitoring", label: "Website Monitoring", icon: Activity, keywords: "synthetic probes uptime" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, keywords: "charts data trends" },
  { href: "/sla", label: "SLA Dashboard", icon: Target, keywords: "service level agreement" },
  { href: "/predictions", label: "Predictions", icon: TrendingUp, keywords: "ai forecast outage" },
  { href: "/reports", label: "Reports", icon: FileText, keywords: "uptime mttr generate" },
  { href: "/automation", label: "Automation", icon: Bot, keywords: "orchestrator response" },
  { href: "/clients", label: "Clients", icon: Users, keywords: "customers msp labels" },
  { href: "/playbooks", label: "Playbooks", icon: BookOpen, keywords: "incident response runbook" },
  { href: "/portals", label: "Client Portals", icon: Globe, keywords: "branded status pages embed" },
  { href: "/mobile-status", label: "Mobile Status", icon: Smartphone, keywords: "phone view" },
  { href: "/integrations", label: "Integrations", icon: Settings2, keywords: "slack teams discord pagerduty" },
  { href: "/webhooks", label: "Webhooks", icon: Webhook, keywords: "hooks notifications" },
  { href: "/psa-integrations", label: "PSA Ticketing", icon: Ticket, keywords: "connectwise autotask" },
  { href: "/api-keys", label: "API Access", icon: Key, keywords: "api keys token" },
  { href: "/team", label: "Team", icon: UsersRound, keywords: "members roles permissions" },
  { href: "/settings", label: "Settings", icon: Settings, keywords: "configuration preferences notifications" },
  { href: "/sso", label: "SSO", icon: Lock, keywords: "single sign on saml" },
  { href: "/audit-logs", label: "Audit Logs", icon: ClipboardList, keywords: "activity trail" },
];

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: chains = [] } = useQuery<BlockchainChain[]>({
    queryKey: ["/api/blockchain/chains"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/chains", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const handleSelect = useCallback((value: string) => {
    onOpenChange(false);
    if (value.startsWith("/")) {
      navigate(value);
    } else if (value.startsWith("vendor:")) {
      navigate("/vendors");
    } else if (value.startsWith("chain:")) {
      navigate("/blockchain");
    }
  }, [navigate, onOpenChange]);

  const filteredVendors = search.length > 0
    ? vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.key.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const filteredChains = search.length > 0
    ? chains.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.key.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search vendors, blockchains, or pages..."
        value={search}
        onValueChange={setSearch}
        data-testid="input-command-search"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {filteredVendors.length > 0 && (
          <CommandGroup heading="Vendors">
            {filteredVendors.map((v) => (
              <CommandItem
                key={`vendor:${v.key}`}
                value={`vendor:${v.key} ${v.name}`}
                onSelect={() => handleSelect("vendor:" + v.key)}
                data-testid={`cmd-vendor-${v.key}`}
              >
                <LogoAvatar name={v.name} src={v.logoUrl} size="sm" />
                <span className="flex-1">{v.name}</span>
                {v.category && (
                  <span className="text-xs text-muted-foreground">{v.category}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredChains.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Blockchain Networks">
              {filteredChains.map((c) => (
                <CommandItem
                  key={`chain:${c.key}`}
                  value={`chain:${c.key} ${c.name}`}
                  onSelect={() => handleSelect("chain:" + c.key)}
                  data-testid={`cmd-chain-${c.key}`}
                >
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{c.name}</span>
                  {c.symbol && (
                    <span className="text-xs text-muted-foreground">{c.symbol}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Pages">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.label} ${item.keywords}`}
              onSelect={() => handleSelect(item.href)}
              data-testid={`cmd-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
