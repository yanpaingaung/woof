"use client";

import { useState, useMemo, useEffect, useCallback } from "react";

/* ─── Types ─── */
type SubStatus = "pending" | "approved" | "declined";
type NavKey = "queue" | "leaderboard" | "analytics" | "adjustments" | "settings" | "content-queue";

interface Submission {
  id: string;          // UUID from Supabase
  user: string;
  xHandle: string;
  link: string;
  tweetId: string;
  points: number;
  status: SubStatus;
  submittedAt: string;
  reviewedAt:  string | null;
  reviewedBy:  string | null;
}

interface Adjustment {
  user: string;
  pts: string;
  reason: string;
  submittedAt: string;
}

interface ContentSubmission {
  id: string;
  xHandle: string;
  title: string;
  contentUrl: string;
  status: SubStatus;
  points: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

interface RewardConfig { key: string; label: string; pts: number; description: string; }

/* ─── Constants ─── */
const DEFAULT_REWARDS: RewardConfig[] = [
  { key: "submitReply",   label: "Submit Reply",   pts: 10,   description: "Awarded when admin approves a Twitter/X reply submission" },
  { key: "submitContent", label: "Submit Content", pts: 1000, description: "Awarded when admin approves a content submission" },
];

/* ─── Helpers ─── */
const F: React.CSSProperties = { fontFamily: "system-ui, -apple-system, sans-serif" };

function parseTweetHandle(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\//i);
  return m ? m[1].toLowerCase() : null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── Sub-components ─── */
function StatusBadge({ status }: { status: SubStatus }) {
  const cfg = {
    pending:  { bg: "rgba(254,188,46,0.12)", border: "rgba(254,188,46,0.3)", color: "#febc2e", dot: "●" },
    approved: { bg: "rgba(0,200,100,0.12)",  border: "rgba(0,200,100,0.3)",  color: "#00c864", dot: "✓" },
    declined: { bg: "rgba(255,68,68,0.12)",  border: "rgba(255,68,68,0.3)",  color: "#ff4444", dot: "✕" },
  }[status];
  return (
    <span style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
      {cfg.dot} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function MatchBadge({ match }: { match: boolean }) {
  return match
    ? <span style={{ background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.3)", color: "#00c864", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>✓ Match</span>
    : <span style={{ background: "rgba(255,68,68,0.1)",  border: "1px solid rgba(255,68,68,0.3)",  color: "#ff4444", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>✕ Mismatch</span>;
}

function StatCard({ label, value, trend, color = "#0052FF" }: { label: string; value: string; trend: string; color?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: "-0.5px" }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{trend}</div>
    </div>
  );
}

function SidebarItem({ icon, label, active, badge, onClick }: { icon: string; label: string; active: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      width: "100%", padding: "9px 16px",
      background: active ? "rgba(0,82,255,0.15)" : "transparent",
      border: "none",
      borderLeft: `3px solid ${active ? "#0052FF" : "transparent"}`,
      borderRadius: "0 10px 10px 0",
      color: active ? "#ffffff" : "rgba(255,255,255,0.45)",
      cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
      fontFamily: "system-ui,sans-serif",
      transition: "all 0.15s",
      textAlign: "left",
    }}>
      <span style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ background: "#ff4444", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>{badge}</span>
      )}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "48px 0", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 14 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🐾</div>
      {message}
    </div>
  );
}

/* ─── Main page ─── */
export default function AdminPage() {
  const [nav, setNav]           = useState<NavKey>("queue");
  const [subs, setSubs]         = useState<Submission[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [search, setSearch]     = useState("");
  const [rewards, setRewards]   = useState<RewardConfig[]>(DEFAULT_REWARDS);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [adjUser, setAdjUser]   = useState("");
  const [adjPts, setAdjPts]     = useState("");
  const [adjNote, setAdjNote]   = useState("");
  const [adjDone, setAdjDone]   = useState(false);
  const [contentSubs, setContentSubs]           = useState<ContentSubmission[]>([]);
  const [contentFilter, setContentFilter]       = useState<SubStatus | "all">("all");
  const [filterStatus, setFilterStatus] = useState<SubStatus | "all">("all");

  /* Export state */
  const [showExport, setShowExport]   = useState(false);
  const [exportTab, setExportTab]     = useState<"csv" | "clipboard" | "script">("csv");
  const [sheetsUrl, setSheetsUrl]     = useState("");
  const [syncStatus, setSyncStatus]   = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [copied, setCopied]           = useState(false);

  /* Load all data from APIs */
  const loadFromStorage = useCallback(async () => {
    const [subsRes, rewardsRes, contentRes, adjRes] = await Promise.allSettled([
      fetch("/api/admin/submissions"),
      fetch("/api/rewards"),
      fetch("/api/content-submissions"),
      fetch("/api/adjustments"),
    ]);

    if (subsRes.status === "fulfilled" && subsRes.value.ok) {
      const { data } = await subsRes.value.json();
      if (Array.isArray(data)) setSubs(data);
    }
    if (rewardsRes.status === "fulfilled" && rewardsRes.value.ok) {
      const { data } = await rewardsRes.value.json();
      if (Array.isArray(data)) {
        const savedMap = Object.fromEntries((data as RewardConfig[]).map(r => [r.key, r.pts]));
        setRewards(DEFAULT_REWARDS.map(d => ({ ...d, pts: savedMap[d.key] ?? d.pts })));
      }
    }
    if (contentRes.status === "fulfilled" && contentRes.value.ok) {
      const { data } = await contentRes.value.json();
      if (Array.isArray(data)) setContentSubs(data);
    }
    if (adjRes.status === "fulfilled" && adjRes.value.ok) {
      const { data } = await adjRes.value.json();
      if (Array.isArray(data)) setAdjustments(data);
    }
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  /* Approve / decline via Supabase API, then update local state */
  const updateSub = async (id: string, status: SubStatus) => {
    const res = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewed_by: "admin" }),
    });
    if (res.ok) {
      setSubs(ss => ss.map(s => s.id === id
        ? { ...s, status, reviewedAt: new Date().toISOString(), reviewedBy: "admin" }
        : s,
      ));
    }
  };

  const updateContentSub = async (id: string, status: SubStatus) => {
    const res = await fetch(`/api/content-submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewed_by: "admin" }),
    });
    if (res.ok) {
      setContentSubs(ss => ss.map(s => s.id === id
        ? { ...s, status, reviewedAt: new Date().toISOString(), reviewedBy: "admin" }
        : s,
      ));
    }
  };

  const pending  = subs.filter(s => s.status === "pending").length;
  const approved = subs.filter(s => s.status === "approved").length;
  const declined = subs.filter(s => s.status === "declined").length;
  const contentPending = contentSubs.filter(s => s.status === "pending").length;
  const totalPtsDistributed =
    subs.filter(s => s.status === "approved").reduce((sum, s) => sum + s.points, 0) +
    contentSubs.filter(s => s.status === "approved").reduce((sum, s) => sum + s.points, 0);
  const uniqueUsers = new Set([...subs.map(s => s.xHandle), ...contentSubs.map(s => s.xHandle)]).size;

  /* Leaderboard: reply subs + content subs + adjustments */
  const leaderboard = useMemo(() => {
    const byUser: Record<string, { approvedPts: number; submissionCount: number; adjustPts: number }> = {};

    subs.forEach(s => {
      if (!byUser[s.xHandle]) byUser[s.xHandle] = { approvedPts: 0, submissionCount: 0, adjustPts: 0 };
      if (s.status === "approved") {
        byUser[s.xHandle].approvedPts += s.points;
        byUser[s.xHandle].submissionCount++;
      }
    });

    contentSubs.forEach(s => {
      if (!byUser[s.xHandle]) byUser[s.xHandle] = { approvedPts: 0, submissionCount: 0, adjustPts: 0 };
      if (s.status === "approved") {
        byUser[s.xHandle].approvedPts += s.points;
        byUser[s.xHandle].submissionCount++;
      }
    });

    adjustments.forEach(a => {
      const handle = a.user.toLowerCase().replace(/^@/, "");
      if (!byUser[handle]) byUser[handle] = { approvedPts: 0, submissionCount: 0, adjustPts: 0 };
      const delta = parseInt(a.pts, 10);
      if (!isNaN(delta)) byUser[handle].adjustPts += delta;
    });

    return Object.entries(byUser)
      .map(([handle, d]) => ({
        handle,
        totalPoints: d.approvedPts + d.adjustPts,
        submissionCount: d.submissionCount,
        adjustPts: d.adjustPts,
      }))
      .filter(u => u.totalPoints > 0 || u.submissionCount > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [subs, contentSubs, adjustments]);

  const filteredLeaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? leaderboard.filter(u => u.handle.toLowerCase().includes(q)) : leaderboard;
  }, [leaderboard, search]);

  const visibleSubs = useMemo(() =>
    subs.filter(s => filterStatus === "all" || s.status === filterStatus),
    [subs, filterStatus]);

  const saveReward = async (key: string) => {
    const reward = rewards.find(r => r.key === key);
    if (!reward) return;
    await fetch("/api/rewards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, pts: reward.pts }),
    });
    setSavedKeys(s => new Set(s).add(key));
    setTimeout(() => setSavedKeys(s => { const n = new Set(s); n.delete(key); return n; }), 2000);
  };

  /* ─── Export helpers ─── */
  const exportRows = () =>
    leaderboard.map((u, i) => ({
      rank: i + 1,
      handle: u.handle,
      totalPoints: u.totalPoints,
      submissionCount: u.submissionCount,
      adjustPts: u.adjustPts,
    }));

  const downloadCSV = () => {
    const rows = exportRows();
    const exportedAt = new Date().toISOString();
    const header = ["Rank", "Handle", "Total Points", "Approved Subs", "Adjustments", "Exported At"];
    const lines = [
      header.join(","),
      ...rows.map(r =>
        [r.rank, `@${r.handle}`, r.totalPoints, r.submissionCount, r.adjustPts, exportedAt].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `woof-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTSV = async () => {
    const rows = exportRows();
    const exportedAt = new Date().toISOString();
    const lines = [
      ["Rank", "Handle", "Total Points", "Approved Subs", "Adjustments", "Exported At"].join("\t"),
      ...rows.map(r =>
        [r.rank, `@${r.handle}`, r.totalPoints, r.submissionCount, r.adjustPts, exportedAt].join("\t")
      ),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const syncToSheets = async () => {
    const url = sheetsUrl.trim();
    if (!url) return;
    setSyncStatus("sending");
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(exportRows()),
      });
      setSyncStatus("sent");
      setTimeout(() => setSyncStatus("idle"), 4000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  };

  const handleAdjust = async () => {
    if (!adjUser.trim() || !adjPts.trim()) return;
    const res = await fetch("/api/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: adjUser.trim(), pts: adjPts.trim(), reason: adjNote.trim() }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setAdjustments(prev => [data, ...prev]);
    }
    setAdjUser(""); setAdjPts(""); setAdjNote("");
    setAdjDone(true);
    setTimeout(() => setAdjDone(false), 2000);
  };

  const NAV: { key: NavKey; icon: string; label: string; badge?: number }[] = [
    { key: "queue",         icon: "📋", label: "Submission Queue", badge: pending },
    { key: "content-queue", icon: "📝", label: "Content Queue",    badge: contentPending },
    { key: "leaderboard",   icon: "🏆", label: "Point Leaderboard" },
    { key: "analytics",     icon: "📊", label: "Analytics" },
    { key: "adjustments",   icon: "⚡", label: "Point Adjustments" },
    { key: "settings",      icon: "⚙️", label: "Reward Settings" },
  ];

  const PAGE_TITLES: Record<NavKey, string> = {
    queue:           "Submission Queue",
    "content-queue": "Content Queue",
    leaderboard:     "Point Leaderboard",
    analytics:       "Analytics",
    adjustments:     "Point Adjustments",
    settings:        "Reward Settings",
  };

  return (
    <div style={{ ...F, display: "flex", minHeight: "100vh", background: "#080c1e", color: "#fff" }}>

      {/* ══ Sidebar ══ */}
      <aside style={{
        width: 228, flexShrink: 0,
        background: "#050814",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", overflow: "hidden",
      }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg,#0052FF,#0035b3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              boxShadow: "0 0 16px rgba(0,82,255,0.4)",
            }}>🐾</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "-0.3px" }}>WOOF</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px" }}>ADMIN PANEL</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "12px 0", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(n => (
            <SidebarItem key={n.key} icon={n.icon} label={n.label} active={nav === n.key} badge={n.badge} onClick={() => setNav(n.key)} />
          ))}
        </nav>

        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{
            background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)",
            borderRadius: 10, padding: "8px 12px",
            fontSize: 11, color: "rgba(255,100,100,0.8)", lineHeight: 1.4,
          }}>
            🔒 Restricted access.<br />Do not share this URL.
          </div>
        </div>
      </aside>

      {/* ══ Main ══ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        <header style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "14px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(5,8,20,0.8)", backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{PAGE_TITLES[nav]}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
              WOOF Admin › {PAGE_TITLES[nav]}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {pending > 0 && (
              <button onClick={() => setNav("queue")} style={{
                background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.3)",
                borderRadius: 8, color: "#ff6666", padding: "7px 14px",
                cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "system-ui,sans-serif",
              }}>
                {pending} pending replies
              </button>
            )}
            {contentPending > 0 && (
              <button onClick={() => setNav("content-queue")} style={{
                background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.3)",
                borderRadius: 8, color: "#ff6666", padding: "7px 14px",
                cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "system-ui,sans-serif",
              }}>
                {contentPending} pending content
              </button>
            )}
            <button onClick={() => { loadFromStorage(); }} style={{
              background: "rgba(0,82,255,0.1)", border: "1px solid rgba(0,82,255,0.25)",
              borderRadius: 8, color: "#3d7eff", padding: "7px 14px",
              cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "system-ui,sans-serif",
            }}>↻ Refresh</button>
          </div>
        </header>

        <div style={{ flex: 1, padding: "28px", overflowY: "auto" }}>

          {/* ── Submission Queue ── */}
          {nav === "queue" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
                <StatCard label="Total"     value={subs.length.toString()} trend="all time"         color="#fff"    />
                <StatCard label="Pending"   value={pending.toString()}      trend="awaiting review" color="#febc2e" />
                <StatCard label="Approved"  value={approved.toString()}     trend="points awarded"  color="#00c864" />
                <StatCard label="Declined"  value={declined.toString()}     trend="rejected"        color="#ff4444" />
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {(["all","pending","approved","declined"] as const).map(f => (
                  <button key={f} onClick={() => setFilterStatus(f)} style={{
                    background: filterStatus === f ? "#0052FF" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${filterStatus === f ? "#0052FF" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 20, color: filterStatus === f ? "#fff" : "rgba(255,255,255,0.5)",
                    padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    fontFamily: "system-ui,sans-serif", transition: "all 0.15s",
                  }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      {f === "all" ? subs.length : subs.filter(s => s.status === f).length}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "140px 130px 110px 1fr 100px 170px",
                  gap: 12, padding: "10px 18px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  fontSize: 10, color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase", letterSpacing: "1px",
                }}>
                  <span>User</span><span>Connected @</span><span>URL @</span>
                  <span>Tweet Link</span><span>Submitted</span><span>Action</span>
                </div>

                {visibleSubs.length === 0
                  ? <EmptyState message={filterStatus === "all" ? "No submissions yet." : `No ${filterStatus} submissions.`} />
                  : visibleSubs.map((s, i) => {
                    const urlHandle = parseTweetHandle(s.link);
                    const isMatch   = urlHandle === s.xHandle.toLowerCase();
                    return (
                      <div key={s.id} style={{
                        display: "grid", gridTemplateColumns: "140px 130px 110px 1fr 100px 170px",
                        gap: 12, padding: "13px 18px",
                        borderBottom: i < visibleSubs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        alignItems: "center",
                        background: !isMatch && s.status === "pending" ? "rgba(255,68,68,0.04)" : "transparent",
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{s.user}</div>
                        <div style={{ fontSize: 12, color: "#3d7eff", fontWeight: 600 }}>@{s.xHandle}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>@{urlHandle ?? "—"}</span>
                          <MatchBadge match={isMatch} />
                        </div>
                        <a href={s.link} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#3d7eff", fontSize: 11, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {s.link}
                        </a>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{timeAgo(s.submittedAt)}</div>
                        {s.status === "pending" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => updateSub(s.id, "approved")} style={{
                              flex: 1, background: "rgba(0,200,100,0.12)", border: "1px solid rgba(0,200,100,0.35)",
                              borderRadius: 8, color: "#00c864", padding: "6px 0",
                              cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "system-ui,sans-serif",
                            }}>✓</button>
                            <button onClick={() => updateSub(s.id, "declined")} style={{
                              flex: 1, background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.35)",
                              borderRadius: 8, color: "#ff4444", padding: "6px 0",
                              cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "system-ui,sans-serif",
                            }}>✕</button>
                          </div>
                        ) : <StatusBadge status={s.status} />}
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* ── Content Queue ── */}
          {nav === "content-queue" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
                <StatCard label="Total"    value={contentSubs.length.toString()}                                          trend="all time"        color="#fff"    />
                <StatCard label="Pending"  value={contentPending.toString()}                                              trend="awaiting review" color="#febc2e" />
                <StatCard label="Approved" value={contentSubs.filter(s => s.status === "approved").length.toString()}     trend="accepted"        color="#00c864" />
                <StatCard label="Declined" value={contentSubs.filter(s => s.status === "declined").length.toString()}     trend="rejected"        color="#ff4444" />
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {(["all", "pending", "approved", "declined"] as const).map(f => (
                  <button key={f} onClick={() => setContentFilter(f)} style={{
                    background: contentFilter === f ? "#0052FF" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${contentFilter === f ? "#0052FF" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 20, color: contentFilter === f ? "#fff" : "rgba(255,255,255,0.5)",
                    padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    fontFamily: "system-ui,sans-serif", transition: "all 0.15s",
                  }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      {f === "all" ? contentSubs.length : contentSubs.filter(s => s.status === f).length}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "160px 1fr 180px 100px 170px",
                  gap: 12, padding: "10px 18px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  fontSize: 10, color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase", letterSpacing: "1px",
                }}>
                  <span>Handle</span><span>Title</span><span>Content URL</span><span>Submitted</span><span>Action</span>
                </div>
                {(() => {
                  const visible = contentSubs.filter(s => contentFilter === "all" || s.status === contentFilter);
                  return visible.length === 0
                    ? <EmptyState message={contentFilter === "all" ? "No content submissions yet." : `No ${contentFilter} content.`} />
                    : visible.map((s, i) => (
                      <div key={s.id} style={{
                        display: "grid", gridTemplateColumns: "160px 1fr 180px 100px 170px",
                        gap: 12, padding: "13px 18px",
                        borderBottom: i < visible.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        alignItems: "center",
                      }}>
                        <div style={{ fontSize: 12, color: "#3d7eff", fontWeight: 600 }}>@{s.xHandle}</div>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                        <a href={s.contentUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#3d7eff", fontSize: 11, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {s.contentUrl}
                        </a>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{timeAgo(s.submittedAt)}</div>
                        {s.status === "pending" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => updateContentSub(s.id, "approved")} style={{
                              flex: 1, background: "rgba(0,200,100,0.12)", border: "1px solid rgba(0,200,100,0.35)",
                              borderRadius: 8, color: "#00c864", padding: "6px 0",
                              cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "system-ui,sans-serif",
                            }}>✓</button>
                            <button onClick={() => updateContentSub(s.id, "declined")} style={{
                              flex: 1, background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.35)",
                              borderRadius: 8, color: "#ff4444", padding: "6px 0",
                              cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "system-ui,sans-serif",
                            }}>✕</button>
                          </div>
                        ) : <StatusBadge status={s.status} />}
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

          {/* ── Point Leaderboard ── */}
          {nav === "leaderboard" && (
            <div>
              {/* Controls row */}
              <div style={{ display: "flex", gap: 10, marginBottom: showExport ? 12 : 20, alignItems: "center" }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍  Search @handle…"
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, color: "#fff", padding: "9px 14px",
                    outline: "none", fontSize: 13, fontFamily: "system-ui,sans-serif",
                  }} />
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  {filteredLeaderboard.length} user{filteredLeaderboard.length !== 1 ? "s" : ""}
                </div>
                <button
                  onClick={() => setShowExport(v => !v)}
                  style={{
                    background: showExport ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${showExport ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 10, color: showExport ? "#34d399" : "rgba(255,255,255,0.7)",
                    padding: "9px 18px", cursor: "pointer", fontSize: 12, fontWeight: 700,
                    fontFamily: "system-ui,sans-serif", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 14 }}>↗</span> Export to Sheets
                </button>
              </div>

              {/* Export panel */}
              {showExport && (
                <div style={{
                  background: "rgba(52,211,153,0.04)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  borderRadius: 16, marginBottom: 20, overflow: "hidden",
                }}>
                  {/* Panel header */}
                  <div style={{
                    padding: "14px 20px 0",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#34d399" }}>
                      ↗ Export to Google Sheets
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                      {leaderboard.length} row{leaderboard.length !== 1 ? "s" : ""} · Rank, Handle, Total Pts, Subs, Adjustments
                    </div>
                  </div>

                  {/* Method tabs */}
                  <div style={{ display: "flex", gap: 0, padding: "12px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {([
                      { key: "csv",       label: "⬇ Download CSV"        },
                      { key: "clipboard", label: "📋 Copy for Sheets"     },
                      { key: "script",    label: "⚡ Apps Script Sync"    },
                    ] as const).map(t => (
                      <button key={t.key} onClick={() => setExportTab(t.key)} style={{
                        background: "none", border: "none",
                        borderBottom: exportTab === t.key ? "2px solid #34d399" : "2px solid transparent",
                        color: exportTab === t.key ? "#34d399" : "rgba(255,255,255,0.4)",
                        padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                        fontFamily: "system-ui,sans-serif", marginBottom: -1,
                      }}>{t.label}</button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div style={{ padding: "20px" }}>

                    {/* ── CSV download ── */}
                    {exportTab === "csv" && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Download as CSV file</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 16 }}>
                            Saves a <code style={{ background: "rgba(255,255,255,0.07)", borderRadius: 4, padding: "1px 5px" }}>.csv</code> file
                            to your computer. Open Google Sheets → <strong>File → Import → Upload</strong> to load it.
                            Filename includes today{"'"}s date for easy versioning.
                          </div>
                          <button
                            onClick={downloadCSV}
                            disabled={leaderboard.length === 0}
                            style={{
                              background: leaderboard.length === 0 ? "rgba(255,255,255,0.05)" : "#34d399",
                              border: "none", borderRadius: 10, color: leaderboard.length === 0 ? "rgba(255,255,255,0.3)" : "#000",
                              padding: "10px 22px", cursor: leaderboard.length === 0 ? "not-allowed" : "pointer",
                              fontSize: 13, fontWeight: 700, fontFamily: "system-ui,sans-serif",
                            }}
                          >
                            ⬇ Download CSV {leaderboard.length > 0 && `(${leaderboard.length} rows)`}
                          </button>
                        </div>
                        <div style={{
                          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 10, padding: "12px 16px", fontSize: 11,
                          color: "rgba(255,255,255,0.4)", lineHeight: 1.8, flexShrink: 0,
                          fontFamily: "monospace",
                        }}>
                          Rank, Handle, Total Points,…<br />
                          1, @alice, 50, 5, 0, …<br />
                          2, @bob, 30, 3, 0, …
                        </div>
                      </div>
                    )}

                    {/* ── Clipboard copy ── */}
                    {exportTab === "clipboard" && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Copy & paste directly into Google Sheets</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 16 }}>
                          Copies tab-separated values. Open Google Sheets, click cell <strong>A1</strong>, then press <strong>Ctrl+V</strong> (or ⌘V).
                          Data fills the columns automatically — no import dialog needed.
                        </div>
                        <button
                          onClick={copyTSV}
                          disabled={leaderboard.length === 0}
                          style={{
                            background: copied ? "rgba(52,211,153,0.15)" : leaderboard.length === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)",
                            border: `1px solid ${copied ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.15)"}`,
                            borderRadius: 10, color: copied ? "#34d399" : leaderboard.length === 0 ? "rgba(255,255,255,0.3)" : "#fff",
                            padding: "10px 22px", cursor: leaderboard.length === 0 ? "not-allowed" : "pointer",
                            fontSize: 13, fontWeight: 700, fontFamily: "system-ui,sans-serif", transition: "all 0.2s",
                          }}
                        >
                          {copied ? "✓ Copied! Paste into Google Sheets" : `📋 Copy ${leaderboard.length} rows to clipboard`}
                        </button>
                      </div>
                    )}

                    {/* ── Apps Script sync ── */}
                    {exportTab === "script" && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Direct sync via Google Apps Script</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 14 }}>
                          Deploy the script below as a Google Apps Script web app, paste the URL, then click Sync.
                          Data is written directly to a sheet named <strong>Leaderboard</strong> in your Google Sheet.
                        </div>

                        {/* Script code block */}
                        <div style={{
                          background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 10, padding: "14px 16px", marginBottom: 16,
                          fontFamily: "monospace", fontSize: 11, color: "#e6edf3", lineHeight: 1.7,
                          overflowX: "auto", whiteSpace: "pre",
                        }}>{`function doPost(e) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var sh   = ss.getSheetByName('Leaderboard') || ss.insertSheet('Leaderboard');
  var rows = JSON.parse(e.postData.contents);
  sh.clearContents();
  sh.appendRow(['Rank','Handle','Total Points','Approved Subs','Adjustments','Exported At']);
  var ts = new Date().toISOString();
  rows.forEach(function(r) {
    sh.appendRow([r.rank,'@'+r.handle,r.totalPoints,r.submissionCount,r.adjustPts,ts]);
  });
  return ContentService.createTextOutput('ok');
}`}</div>

                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 14, lineHeight: 1.7 }}>
                          Deploy: <strong>Extensions → Apps Script → Deploy → New deployment</strong><br />
                          Type: <em>Web app</em> · Execute as: <em>Me</em> · Access: <em>Anyone</em> → copy the URL below.
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <input
                            value={sheetsUrl}
                            onChange={e => setSheetsUrl(e.target.value)}
                            placeholder="https://script.google.com/macros/s/…/exec"
                            style={{
                              flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 10, color: "#fff", padding: "10px 14px",
                              fontSize: 12, fontFamily: "monospace", outline: "none",
                            }}
                          />
                          <button
                            onClick={syncToSheets}
                            disabled={!sheetsUrl.trim() || leaderboard.length === 0 || syncStatus === "sending"}
                            style={{
                              background: syncStatus === "sent" ? "rgba(52,211,153,0.15)"
                                : syncStatus === "error" ? "rgba(255,68,68,0.15)"
                                : syncStatus === "sending" ? "rgba(255,255,255,0.05)"
                                : "#34d399",
                              border: syncStatus === "sent" ? "1px solid rgba(52,211,153,0.4)"
                                : syncStatus === "error" ? "1px solid rgba(255,68,68,0.4)"
                                : "none",
                              borderRadius: 10,
                              color: syncStatus === "sent" ? "#34d399"
                                : syncStatus === "error" ? "#ff4444"
                                : syncStatus === "sending" ? "rgba(255,255,255,0.4)"
                                : "#000",
                              padding: "10px 20px", fontWeight: 700, fontSize: 13,
                              fontFamily: "system-ui,sans-serif", cursor: !sheetsUrl.trim() || leaderboard.length === 0 || syncStatus === "sending" ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap", transition: "all 0.2s",
                            }}
                          >
                            {syncStatus === "sending" ? "Syncing…"
                              : syncStatus === "sent" ? "✓ Sent to Sheets"
                              : syncStatus === "error" ? "✕ Failed — check URL"
                              : "⚡ Sync Now"}
                          </button>
                        </div>
                        {syncStatus === "sent" && (
                          <div style={{ fontSize: 11, color: "rgba(52,211,153,0.7)", marginTop: 8 }}>
                            Data sent. Open your Google Sheet and check the <strong>Leaderboard</strong> tab.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "48px 1fr 140px 130px 100px",
                  gap: 12, padding: "10px 18px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  fontSize: 10, color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase", letterSpacing: "1px",
                }}>
                  <span>#</span><span>Handle</span>
                  <span style={{ textAlign: "right" }}>Total Pts</span>
                  <span style={{ textAlign: "right" }}>Approved Subs</span>
                  <span style={{ textAlign: "right" }}>Adjustments</span>
                </div>

                {filteredLeaderboard.length === 0
                  ? <EmptyState message="No approved submissions yet — leaderboard is empty." />
                  : filteredLeaderboard.map((u, i) => {
                    const rankColor = i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.25)";
                    return (
                      <div key={u.handle} style={{
                        display: "grid", gridTemplateColumns: "48px 1fr 140px 130px 100px",
                        gap: 12, padding: "13px 18px",
                        borderBottom: i < filteredLeaderboard.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        alignItems: "center",
                      }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: rankColor }}>#{i + 1}</div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>@{u.handle}</div>
                        <div style={{ textAlign: "right", fontWeight: 900, fontSize: 14, color: "#fff" }}>
                          {u.totalPoints.toLocaleString()}
                        </div>
                        <div style={{ textAlign: "right", fontSize: 13, color: "#3d7eff" }}>
                          {u.submissionCount} × 10 pts
                        </div>
                        <div style={{ textAlign: "right", fontSize: 13, color: u.adjustPts > 0 ? "#00c864" : u.adjustPts < 0 ? "#ff4444" : "rgba(255,255,255,0.25)" }}>
                          {u.adjustPts > 0 ? `+${u.adjustPts}` : u.adjustPts < 0 ? u.adjustPts.toString() : "—"}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* ── Analytics ── */}
          {nav === "analytics" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
                <StatCard label="Unique Users"       value={uniqueUsers.toString()}            trend="who have submitted"   />
                <StatCard label="Total Submissions"  value={subs.length.toString()}            trend="all time"             />
                <StatCard label="Points Distributed" value={totalPtsDistributed.toLocaleString()} trend="from approved subs" color="#00c864" />
                <StatCard label="Approval Rate"
                  value={subs.length ? `${Math.round((approved / subs.length) * 100)}%` : "—"}
                  trend={`${approved} approved of ${subs.length}`}
                  color="#febc2e"
                />
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 700, fontSize: 13 }}>Top Earners</div>
                {leaderboard.length === 0
                  ? <EmptyState message="No approved submissions yet." />
                  : leaderboard.slice(0, 5).map((u, i) => (
                    <div key={u.handle} style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "12px 18px",
                      borderBottom: i < Math.min(leaderboard.length, 5) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 12, color: i===0?"#ffd700":i===1?"#c0c0c0":i===2?"#cd7f32":"rgba(255,255,255,0.25)", width: 28 }}>#{i+1}</div>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>@{u.handle}</div>
                      <div style={{ fontWeight: 800, color: "#0052FF", fontSize: 13 }}>{u.totalPoints.toLocaleString()} pts</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{u.submissionCount} subs</div>
                    </div>
                  ))
                }
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { label: "Total submissions",    value: subs.length.toString(),    sub: "all time" },
                  { label: "Pending review",       value: pending.toString(),         sub: "awaiting action" },
                  { label: "Approved & rewarded",  value: approved.toString(),        sub: `${totalPtsDistributed} pts distributed` },
                  { label: "Declined",             value: declined.toString(),        sub: "rejected submissions" },
                ].map(r => (
                  <div key={r.label} style={{ background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                    <div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:4}}>{r.label}</div>
                      <div style={{fontSize:22,fontWeight:900}}>{r.value}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>{r.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Point Adjustments ── */}
          {nav === "adjustments" && (
            <div>
              <div style={{ background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:24,marginBottom:20 }}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Manual Adjustment</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:20}}>Add or deduct points from any user. Changes persist and are reflected in the leaderboard.</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14 }}>
                  {[
                    { label:"@handle", val:adjUser, set:setAdjUser, ph:"username (without @)" },
                    { label:"Points (+ or –)", val:adjPts, set:setAdjPts, ph:"+500 or -200" },
                  ].map(field => (
                    <div key={field.label}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:6,textTransform:"uppercase",letterSpacing:"1px"}}>{field.label}</div>
                      <input value={field.val} onChange={e=>field.set(e.target.value)} placeholder={field.ph} style={{
                        background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
                        borderRadius:10,color:"#fff",padding:"10px 14px",width:"100%",
                        outline:"none",fontSize:14,boxSizing:"border-box",fontFamily:"system-ui,sans-serif",
                      }}/>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:6,textTransform:"uppercase",letterSpacing:"1px"}}>Reason (optional)</div>
                  <input value={adjNote} onChange={e=>setAdjNote(e.target.value)} placeholder="e.g. bug compensation, contest reward…" style={{
                    background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:10,color:"#fff",padding:"10px 14px",width:"100%",
                    outline:"none",fontSize:14,boxSizing:"border-box",fontFamily:"system-ui,sans-serif",
                  }}/>
                </div>
                <button onClick={handleAdjust} style={{
                  background:adjDone?"rgba(0,200,100,0.15)":"#0052FF",
                  border:adjDone?"1px solid rgba(0,200,100,0.4)":"none",
                  borderRadius:12,color:adjDone?"#00c864":"#fff",
                  padding:"11px 28px",cursor:"pointer",fontSize:14,fontWeight:700,
                  fontFamily:"system-ui,sans-serif",transition:"all 0.2s",
                }}>{adjDone?"✓ Applied":"Apply Adjustment"}</button>
              </div>

              <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Adjustment History</div>
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,overflow:"hidden"}}>
                {adjustments.length === 0
                  ? <EmptyState message="No adjustments yet." />
                  : adjustments.map((r, i) => (
                    <div key={r.submittedAt + r.user} style={{display:"flex",alignItems:"center",gap:16,padding:"13px 18px",borderBottom:i<adjustments.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                      <div style={{flex:1,fontSize:13,fontWeight:600}}>@{r.user}</div>
                      <div style={{fontWeight:800,color:r.pts.startsWith("-")?"#ff4444":"#00c864",fontSize:14,width:60}}>
                        {r.pts.startsWith("-")||r.pts.startsWith("+")?r.pts:`+${r.pts}`}
                      </div>
                      <div style={{flex:2,fontSize:12,color:"rgba(255,255,255,0.4)"}}>{r.reason || "—"}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.22)"}}>{timeAgo(r.submittedAt)}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* ── Reward Settings ── */}
          {nav === "settings" && (
            <div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:20}}>
                Configure point rewards. Changes are saved to storage and applied to new submissions.
              </div>
              {rewards.map(r => (
                <div key={r.key} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"20px 24px",display:"flex",alignItems:"center",gap:24}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{r.label}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.38)",lineHeight:1.5}}>{r.description}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"1px"}}>Points</div>
                    <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,overflow:"hidden"}}>
                      <button onClick={()=>setRewards(rs=>rs.map(x=>x.key===r.key?{...x,pts:Math.max(1,x.pts-1)}:x))}
                        style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",padding:"8px 14px",cursor:"pointer",fontSize:16,fontFamily:"system-ui,sans-serif"}}>−</button>
                      <input type="number" min={1} value={r.pts}
                        onChange={e=>setRewards(rs=>rs.map(x=>x.key===r.key?{...x,pts:Math.max(1,Number(e.target.value)||1)}:x))}
                        style={{background:"none",border:"none",color:"#fff",width:60,textAlign:"center",fontSize:18,fontWeight:800,outline:"none",fontFamily:"system-ui,sans-serif",padding:"8px 0"}}/>
                      <button onClick={()=>setRewards(rs=>rs.map(x=>x.key===r.key?{...x,pts:x.pts+1}:x))}
                        style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",padding:"8px 14px",cursor:"pointer",fontSize:16,fontFamily:"system-ui,sans-serif"}}>+</button>
                    </div>
                    <button onClick={()=>saveReward(r.key)} style={{
                      background:savedKeys.has(r.key)?"rgba(0,200,100,0.15)":"#0052FF",
                      border:savedKeys.has(r.key)?"1px solid rgba(0,200,100,0.4)":"none",
                      borderRadius:10,color:savedKeys.has(r.key)?"#00c864":"#fff",
                      padding:"9px 20px",cursor:"pointer",fontSize:13,fontWeight:700,
                      fontFamily:"system-ui,sans-serif",minWidth:80,transition:"all 0.2s",
                    }}>{savedKeys.has(r.key)?"✓ Saved":"Save"}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
