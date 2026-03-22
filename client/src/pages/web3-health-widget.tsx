import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  green:  { bg: "#dcfce7", text: "#15803d", label: "All Systems Healthy" },
  yellow: { bg: "#fef9c3", text: "#a16207", label: "Minor Disruptions" },
  orange: { bg: "#ffedd5", text: "#c2410c", label: "Degraded Performance" },
  red:    { bg: "#fee2e2", text: "#b91c1c", label: "Major Outage" },
};

const SEV_COLORS: Record<string, string> = {
  critical: "#ef4444",
  major: "#f97316",
  minor: "#f59e0b",
  info: "#94a3b8",
};

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Web3HealthWidget() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/web3-health/summary"],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    document.title = "Web3 Health Status Widget | VendorWatch";
  }, []);

  const style = data ? (VERDICT_STYLES[data.verdictColor] || VERDICT_STYLES.green) : null;
  const top5 = data?.incidents?.slice(0, 5) || [];

  return (
    <div
      style={{
        width: 400,
        height: 300,
        fontFamily: "system-ui, -apple-system, sans-serif",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: style?.bg ?? "#f8fafc",
          padding: "12px 16px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: style?.text ?? "#94a3b8",
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 15, color: style?.text ?? "#334155" }}>
            {isLoading ? "Loading…" : (data?.verdict ?? "Unknown")}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
            VendorWatch
          </span>
        </div>
        {data && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {data.chainsMonitored} chains · {data.vendorsMonitored} vendors · {data.activeIncidents} active incidents
          </div>
        )}
      </div>

      {/* Incident feed */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {isLoading ? (
          <div style={{ padding: "20px 16px", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
            Loading status…
          </div>
        ) : top5.length === 0 ? (
          <div style={{ padding: "20px 16px", color: "#16a34a", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
            ✓ No active incidents
          </div>
        ) : (
          top5.map((inc: any) => (
            <div
              key={inc.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "6px 16px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: SEV_COLORS[inc.severity] || "#94a3b8",
                  marginTop: 4,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {inc.name}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {inc.title}
                </div>
              </div>
              <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                {timeAgo(inc.startedAt)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "6px 16px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <a
          href="/web3-health"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#6366f1", textDecoration: "none", fontWeight: 600 }}
        >
          View full dashboard →
        </a>
        {data?.lastUpdated && (
          <span style={{ fontSize: 10, color: "#94a3b8" }}>
            Updated {timeAgo(data.lastUpdated)}
          </span>
        )}
      </div>
    </div>
  );
}
