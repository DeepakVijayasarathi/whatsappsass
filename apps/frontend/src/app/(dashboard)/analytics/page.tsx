"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BarChart2, TrendingUp, Users, MessageSquare,
  Eye, CheckCircle2, XCircle, Clock, RefreshCw, Download, Calendar,
  Reply, ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { SkeletonStatCard } from "@/components/Skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OverviewData {
  totalContacts: number; totalCampaigns: number; totalMessages: number;
  messagesByStatus: Record<string, number>;
  trends?: { messagesThisWeek: number; messagesTrend: number | null; contactsThisWeek: number; contactsTrend: number | null };
}
interface ContactAnalytics { total: number; optedIn: number; tagCounts: Record<string, number> }
interface DailyStats { date: string; sent: number; delivered: number; read: number; failed: number }
interface FunnelData { campaignId: string; campaign: { name: string; template: string }; funnel: Record<string, { count: number; rate: number }> }
interface GrowthPoint { date: string; newContacts: number; cumulative: number }
interface Campaign { id: string; name: string; status: string }

const STATUS_ORDER = ["read", "delivered", "sent", "pending", "failed"];
const statusStyle: Record<string, { bar: string; dot: string; label: string; badge: string }> = {
  delivered: { bar: "bg-emerald-500", dot: "bg-emerald-500", label: "Delivered", badge: "bg-emerald-50 text-emerald-700" },
  read:      { bar: "bg-brand",       dot: "bg-brand",       label: "Read",       badge: "bg-brand/10 text-brand-dark" },
  sent:      { bar: "bg-blue-400",    dot: "bg-blue-400",    label: "Sent",       badge: "bg-blue-50 text-blue-700" },
  failed:    { bar: "bg-red-500",     dot: "bg-red-500",     label: "Failed",     badge: "bg-red-50 text-red-700" },
  pending:   { bar: "bg-amber-400",   dot: "bg-amber-400",   label: "Pending",    badge: "bg-amber-50 text-amber-700" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function toInputDate(d: Date) { return d.toISOString().split("T")[0]; }

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

// ── Funnel chart ──────────────────────────────────────────────────────────────
const FUNNEL_STEPS = [
  { key: "sent",      label: "Sent",      color: "bg-blue-400",    text: "text-blue-600" },
  { key: "delivered", label: "Delivered", color: "bg-emerald-500", text: "text-emerald-700" },
  { key: "read",      label: "Read",      color: "bg-brand",       text: "text-brand" },
  { key: "replied",   label: "Replied",   color: "bg-purple-500",  text: "text-purple-700" },
];

function FunnelChart({ data }: { data: FunnelData }) {
  return (
    <div className="space-y-2 mt-2">
      {FUNNEL_STEPS.map((step, i) => {
        const f = data.funnel[step.key];
        if (!f) return null;
        const width = Math.max(f.rate, 4);
        return (
          <div key={step.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-2">
                {i > 0 && <div className="w-px h-3 bg-gray-200 ml-4" />}
                <span className={`font-semibold ${step.text}`}>{step.label}</span>
              </div>
              <span className="text-gray-500 tabular-nums">{f.count.toLocaleString()} · <span className="font-bold">{f.rate}%</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className={`${step.color} h-6 rounded-full flex items-center px-2 transition-all duration-700`}
                  style={{ width: `${width}%` }}
                >
                  {f.rate >= 15 && <span className="text-[11px] font-bold text-white">{f.rate}%</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {data.funnel.failed && data.funnel.failed.count > 0 && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{data.funnel.failed.count.toLocaleString()} failed ({data.funnel.failed.rate}%)</span>
        </div>
      )}
    </div>
  );
}

// ── SVG line chart ────────────────────────────────────────────────────────────
function GrowthLineChart({ data }: { data: GrowthPoint[] }) {
  if (data.length === 0) return (
    <div className="h-36 flex items-center justify-center text-gray-400 text-sm">No data</div>
  );

  const W = 600, H = 120, PAD = { top: 8, right: 8, bottom: 24, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map((d) => d.cumulative), 1);
  const n = data.length;

  const xOf = (i: number) => PAD.left + (i / (n - 1)) * innerW;
  const yOf = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const cumulPoints = data.map((d, i) => `${xOf(i)},${yOf(d.cumulative)}`).join(" ");
  const newPoints   = data.map((d, i) => `${xOf(i)},${yOf(d.newContacts * (maxVal / Math.max(...data.map((d2) => d2.newContacts), 1)))}`).join(" ");

  // Y-axis labels
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  // X-axis labels (show ~6)
  const xStep = Math.max(1, Math.floor(n / 6));
  const xLabels = data.filter((_, i) => i % xStep === 0 || i === n - 1);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} stroke="#f0f0f0" strokeWidth="1" />
            <text x={PAD.left - 4} y={yOf(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{v >= 1000 ? `${Math.round(v/1000)}k` : v}</text>
          </g>
        ))}
        {/* Cumulative area */}
        <polygon
          points={`${PAD.left},${PAD.top + innerH} ${cumulPoints} ${W - PAD.right},${PAD.top + innerH}`}
          fill="rgb(139,92,246)" fillOpacity="0.08"
        />
        <polyline points={cumulPoints} fill="none" stroke="rgb(139,92,246)" strokeWidth="2" strokeLinejoin="round" />
        {/* X labels */}
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d);
          return (
            <text key={i} x={xOf(idx)} y={H - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">
              {d.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function SendHeatmap({ heatmap, maxVal }: { heatmap: number[][]; maxVal: number }) {
  const intensityBg = (v: number) => {
    if (v === 0) return "bg-gray-50";
    const pct = v / Math.max(maxVal, 1);
    if (pct < 0.2)  return "bg-brand/20";
    if (pct < 0.4)  return "bg-brand/40";
    if (pct < 0.6)  return "bg-brand/60";
    if (pct < 0.8)  return "bg-brand/80";
    return "bg-brand";
  };

  // Show only business hours + some buffer (6–23) in desktop; all hours on scroll
  const displayHours = HOURS.filter((h) => h >= 6 || h <= 2);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[540px]">
        {/* Hour header */}
        <div className="flex mb-1 pl-8">
          {displayHours.map((h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-gray-400 font-mono">
              {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
            </div>
          ))}
        </div>
        {WEEKDAYS.map((day, wd) => (
          <div key={day} className="flex items-center mb-0.5">
            <div className="w-8 text-[10px] text-gray-500 font-medium shrink-0">{day}</div>
            {displayHours.map((h) => {
              const v = heatmap[wd]?.[h] ?? 0;
              return (
                <div
                  key={h}
                  className={clsx("flex-1 h-5 mx-0.5 rounded-sm cursor-default transition-colors", intensityBg(v))}
                  title={`${day} ${h}:00 — ${v} messages`}
                />
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 pl-8">
          <span className="text-[9px] text-gray-400">Less</span>
          {["bg-gray-50", "bg-brand/20", "bg-brand/40", "bg-brand/60", "bg-brand/80", "bg-brand"].map((c, i) => (
            <div key={i} className={`w-4 h-3 rounded-sm ${c} border border-gray-100`} />
          ))}
          <span className="text-[9px] text-gray-400">More</span>
        </div>
      </div>
    </div>
  );
}

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar({ status, count, total }: { status: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const s = statusStyle[status] ?? { bar: "bg-gray-400", dot: "bg-gray-400", label: status, badge: "bg-gray-100 text-gray-600" };
  return (
    <div>
      <div className="flex justify-between items-center text-sm mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
          <span className="font-medium text-gray-700">{s.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-gray-500 text-xs">{count.toLocaleString()}</span>
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${s.badge}`}>{pct}%</span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`${s.bar} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [overview,   setOverview]   = useState<OverviewData | null>(null);
  const [contacts,   setContacts]   = useState<ContactAnalytics | null>(null);
  const [trend,      setTrend]      = useState<DailyStats[]>([]);
  const [funnel,     setFunnel]     = useState<FunnelData | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [growth,     setGrowth]     = useState<GrowthPoint[]>([]);
  const [heatmap,    setHeatmap]    = useState<number[][] | null>(null);
  const [heatmapMax, setHeatmapMax] = useState(0);
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loading, setLoading]       = useState(true);
  const [trendLoading, setTrendLoading]   = useState(true);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [heatLoading, setHeatLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [activePreset, setActivePreset] = useState<number>(7);
  const [activeTab, setActiveTab] = useState<"overview"|"funnel"|"growth"|"heatmap">("overview");

  const defaultTo   = toInputDate(new Date());
  const defaultFrom = toInputDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo,   setDateTo]   = useState(defaultTo);

  const applyPreset = (days: number) => {
    const to   = new Date();
    const from = days === 0 ? to : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setDateTo(toInputDate(to));
    setDateFrom(toInputDate(from));
    setActivePreset(days);
  };

  const loadTrend = useCallback((from: string, to: string) => {
    setTrendLoading(true);
    api.get(`/analytics/messages?from=${from}&to=${to}`)
      .then((r) => {
        const data: DailyStats[] = Object.entries(r.data.data as Record<string, Record<string, number>>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, s]) => ({ date, sent: s.sent ?? 0, delivered: s.delivered ?? 0, read: s.read ?? 0, failed: s.failed ?? 0 }));
        setTrend(data);
      })
      .catch(() => {})
      .finally(() => setTrendLoading(false));
  }, []);

  const load = useCallback((silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/contacts"),
      api.get("/campaigns?limit=50&status=completed"),
    ])
      .then(([o, c, camp]) => {
        setOverview(o.data);
        setContacts(c.data);
        const campList = camp.data.campaigns as Campaign[];
        setCampaigns(campList);
        if (campList.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(campList[0].id);
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGrowth = useCallback(() => {
    setGrowthLoading(true);
    api.get("/analytics/contact-growth?days=30")
      .then((r) => setGrowth(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setGrowthLoading(false));
  }, []);

  const loadHeatmap = useCallback(() => {
    setHeatLoading(true);
    api.get("/analytics/heatmap")
      .then((r) => { setHeatmap(r.data.heatmap); setHeatmapMax(r.data.maxVal ?? 0); })
      .catch(() => {})
      .finally(() => setHeatLoading(false));
  }, []);

  const loadFunnel = useCallback((id: string) => {
    if (!id) return;
    setFunnelLoading(true);
    api.get(`/analytics/funnel/${id}`)
      .then((r) => setFunnel(r.data))
      .catch(() => setFunnel(null))
      .finally(() => setFunnelLoading(false));
  }, []);

  useEffect(() => { load(); loadGrowth(); loadHeatmap(); }, [load, loadGrowth, loadHeatmap]);
  useEffect(() => { loadTrend(dateFrom, dateTo); }, [dateFrom, dateTo, loadTrend]);
  useEffect(() => { if (selectedCampaignId) loadFunnel(selectedCampaignId); }, [selectedCampaignId, loadFunnel]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/analytics/export?from=${dateFrom}&to=${dateTo}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = `analytics-${dateFrom}-${dateTo}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  const dayCount = trend.length;
  const displayTrend: DailyStats[] = (() => {
    if (dayCount <= 30) return trend;
    const buckets: DailyStats[] = [];
    for (let i = 0; i < trend.length; i += 7) {
      const slice = trend.slice(i, i + 7);
      buckets.push({ date: slice[0].date, sent: slice.reduce((s, d) => s + d.sent, 0), delivered: slice.reduce((s, d) => s + d.delivered, 0), read: slice.reduce((s, d) => s + d.read, 0), failed: slice.reduce((s, d) => s + d.failed, 0) });
    }
    return buckets;
  })();

  const trendMax = displayTrend.reduce((m, d) => Math.max(m, d.sent + d.delivered + d.read + d.failed), 1);
  const total     = overview?.totalMessages ?? 0;
  const delivered = overview?.messagesByStatus?.delivered ?? 0;
  const read      = overview?.messagesByStatus?.read ?? 0;
  const failed    = overview?.messagesByStatus?.failed ?? 0;
  const pending   = overview?.messagesByStatus?.pending ?? 0;
  const deliveryRate = total > 0 ? (((delivered + read) / total) * 100).toFixed(1) : "0";
  const readRate     = total > 0 ? ((read / total) * 100).toFixed(1) : "0";
  const failRate     = total > 0 ? ((failed / total) * 100).toFixed(1) : "0";
  const optInRate    = contacts?.total ? Math.round((contacts.optedIn / contacts.total) * 100) : 0;

  const statCards = [
    { label: "Total Messages", value: total.toLocaleString(), icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50", sub: "All time" },
    { label: "Delivery Rate",  value: `${deliveryRate}%`,     icon: CheckCircle2,  color: "text-emerald-500", bg: "bg-emerald-50", sub: `${(delivered+read).toLocaleString()} delivered` },
    { label: "Read Rate",      value: `${readRate}%`,         icon: Eye,           color: "text-brand",       bg: "bg-brand/10",  sub: `${read.toLocaleString()} read` },
    { label: "Failure Rate",   value: `${failRate}%`,         icon: XCircle,       color: "text-red-500",     bg: "bg-red-50",    sub: `${failed.toLocaleString()} failed` },
  ];

  const TABS = [
    { id: "overview" as const, label: "Overview" },
    { id: "funnel"   as const, label: "Campaign Funnel" },
    { id: "growth"   as const, label: "Contact Growth" },
    { id: "heatmap"  as const, label: "Send Heatmap" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Insights into your messaging performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {DATE_PRESETS.map((p) => (
              <button key={p.days} onClick={() => applyPreset(p.days)} className={clsx("px-2.5 py-1 text-xs font-medium rounded-lg transition-colors", activePreset === p.days ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input type="date" value={dateFrom} max={dateTo} onChange={(e) => { setDateFrom(e.target.value); setActivePreset(-1); }} className="outline-none text-gray-700 bg-transparent text-xs" />
            <span className="text-gray-300 text-xs">—</span>
            <input type="date" value={dateTo}   min={dateFrom} onChange={(e) => { setDateTo(e.target.value);   setActivePreset(-1); }} className="outline-none text-gray-700 bg-transparent text-xs" />
          </div>
          <button onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3">
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button onClick={() => load(true)} disabled={refreshing} className="icon-btn" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />) : statCards.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="card flex items-center gap-4 hover:shadow-md transition-all duration-200 group">
            <div className={`${bg} rounded-2xl p-3 shrink-0 group-hover:scale-110 transition-transform duration-200`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={clsx("px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors", activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <>
          {/* Message trend bar chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Message Trend</h2>
                <p className="text-xs text-gray-400 mt-0.5">{dateFrom} — {dateTo}</p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {[{ color: "bg-blue-400", label: "Sent" }, { color: "bg-emerald-500", label: "Delivered" }, { color: "bg-brand", label: "Read" }, { color: "bg-red-400", label: "Failed" }].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${color}`} /><span className="text-gray-500">{label}</span></div>
                ))}
              </div>
            </div>
            {trendLoading ? (
              <div className="h-40 flex items-end gap-1">
                {[55,70,45,80,60,75,50].map((h, i) => <div key={i} className="flex-1 animate-pulse bg-gray-100 rounded-t" style={{ height: `${h}%` }} />)}
              </div>
            ) : trend.length === 0 ? (
              <div className="empty-state py-8"><BarChart2 className="empty-icon" /><p className="empty-title">No data for this period</p></div>
            ) : (
              <div className="flex items-end gap-1 h-40 overflow-x-auto">
                {displayTrend.map((d) => {
                  const dayTotal = d.sent + d.delivered + d.read + d.failed;
                  const pct = trendMax > 0 ? (dayTotal / trendMax) * 100 : 0;
                  const label = dayCount > 30 ? `Week of ${d.date.slice(5)}` : d.date.slice(5);
                  return (
                    <div key={d.date} className="flex-1 min-w-[28px] flex flex-col items-center group relative">
                      <div className="w-full rounded-t flex flex-col overflow-hidden transition-all duration-300" style={{ height: `${Math.max(pct, 2)}%` }}>
                        {d.failed > 0 && <div className="bg-red-400" style={{ flex: d.failed }} />}
                        {d.sent > 0 && <div className="bg-blue-400" style={{ flex: d.sent }} />}
                        {d.delivered > 0 && <div className="bg-emerald-500" style={{ flex: d.delivered }} />}
                        {d.read > 0 && <div className="bg-brand" style={{ flex: d.read }} />}
                      </div>
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                        <p className="font-semibold mb-0.5">{label}</p>
                        <p>Sent: {d.sent}</p><p>Delivered: {d.delivered}</p><p>Read: {d.read}</p>
                        {d.failed > 0 && <p className="text-red-300">Failed: {d.failed}</p>}
                      </div>
                      <span className="text-[9px] text-gray-400 mt-1 hidden sm:block truncate w-full text-center">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-900">Message Status Breakdown</h2>
                {!loading && total > 0 && <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{deliveryRate}% delivered</span>}
              </div>
              {loading ? (
                <div className="space-y-5">{[1,2,3,4].map((i) => (<div key={i} className="space-y-2"><div className="animate-pulse bg-gray-200 rounded h-4 w-32" /><div className="animate-pulse bg-gray-100 rounded-full h-2 w-full" /></div>))}</div>
              ) : total > 0 ? (
                <div className="space-y-5">
                  {Object.entries(overview?.messagesByStatus ?? {}).sort(([a],[b]) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b)).map(([status, count]) => (
                    <StatusBar key={status} status={status} count={count} total={total} />
                  ))}
                </div>
              ) : (
                <div className="empty-state"><MessageSquare className="empty-icon" /><p className="empty-title">No message data yet</p></div>
              )}
              {!loading && pending > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-50 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />{pending.toLocaleString()} messages pending — updates when delivered.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-purple-500" /><h2 className="font-semibold text-gray-900 text-sm">Opt-in Rate</h2></div>
                {loading ? <div className="animate-pulse bg-gray-200 rounded h-6 w-20" /> : (
                  <>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-3xl font-bold text-gray-900">{optInRate}%</span>
                      <span className="text-xs text-gray-400">{contacts?.optedIn ?? 0}/{contacts?.total ?? 0}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-purple-500 h-2.5 rounded-full transition-all duration-700" style={{ width: `${optInRate}%` }} />
                    </div>
                  </>
                )}
              </div>
              {!loading && total > 0 && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-brand" /><h2 className="font-semibold text-gray-900 text-sm">Engagement</h2></div>
                  <div className="space-y-3">
                    {[{ label:"Delivery rate", val:deliveryRate, color:"bg-emerald-500", text:"text-emerald-600" }, { label:"Read rate", val:readRate, color:"bg-brand", text:"text-brand" }].map(({ label, val, color, text }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1.5"><span className="text-gray-600 font-medium">{label}</span><span className={`font-bold ${text}`}>{val}%</span></div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5"><div className={`${color} h-1.5 rounded-full`} style={{ width: `${val}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><BarChart2 className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-gray-900 text-sm">Contact Tags</h2></div>
                {contacts?.tagCounts && Object.keys(contacts.tagCounts).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(contacts.tagCounts).sort(([,a],[,b]) => b-a).slice(0,12).map(([tag, count]) => (
                      <div key={tag} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                        <span className="text-xs text-gray-700">{tag}</span>
                        <span className="text-[10px] font-bold text-brand bg-brand/10 rounded-full px-1.5 leading-4">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-400 text-xs">No tagged contacts yet</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Campaign Funnel tab ──────────────────────────────────────────────── */}
      {activeTab === "funnel" && (
        <div className="card max-w-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">Campaign Funnel</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sent → Delivered → Read → Replied</p>
            </div>
          </div>

          {/* Campaign selector */}
          {campaigns.length === 0 ? (
            <p className="text-sm text-gray-400">No completed campaigns yet. Run a campaign first.</p>
          ) : (
            <>
              <div className="relative mb-6 max-w-xs">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="input pr-8 appearance-none text-sm"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {funnelLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4].map((i) => <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-8" />)}
                </div>
              ) : funnel ? (
                <>
                  <FunnelChart data={funnel} />
                  <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                    {[
                      { label:"Sent",        v: funnel.funnel.sent?.count,      color:"bg-blue-400" },
                      { label:"Delivered",   v: funnel.funnel.delivered?.count, color:"bg-emerald-500" },
                      { label:"Read",        v: funnel.funnel.read?.count,      color:"bg-brand" },
                      { label:"Replied",     v: funnel.funnel.replied?.count,   color:"bg-purple-500" },
                    ].map(({ label, v, color }) => v !== undefined && (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                        <span className="text-gray-600">{label}:</span>
                        <span className="font-bold text-gray-900 tabular-nums">{(v ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">No funnel data for this campaign.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Contact Growth tab ──────────────────────────────────────────────── */}
      {activeTab === "growth" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Contact Growth</h2>
                <p className="text-xs text-gray-400 mt-0.5">Cumulative contacts over last 30 days</p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block rounded" /><span className="text-gray-500">Cumulative</span></div>
              </div>
            </div>
            {growthLoading ? (
              <div className="h-36 animate-pulse bg-gray-50 rounded-xl" />
            ) : growth.length === 0 ? (
              <div className="empty-state py-8"><Users className="empty-icon" /><p className="empty-title">No data yet</p></div>
            ) : (
              <GrowthLineChart data={growth} />
            )}
          </div>

          <div className="space-y-4">
            <div className="card">
              <p className="text-sm font-semibold text-gray-900 mb-3">Last 30 days</p>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New contacts</span>
                  <span className="font-bold tabular-nums text-gray-900">
                    {growth.reduce((s, d) => s + d.newContacts, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total now</span>
                  <span className="font-bold tabular-nums text-gray-900">
                    {(growth[growth.length - 1]?.cumulative ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Peak day</span>
                  <span className="font-bold tabular-nums text-gray-900">
                    {Math.max(...growth.map((d) => d.newContacts), 0).toLocaleString()} contacts
                  </span>
                </div>
              </div>
            </div>
            <div className="card">
              <p className="text-sm font-semibold text-gray-900 mb-1">Opt-in rate</p>
              <p className="text-3xl font-bold text-purple-600">{optInRate}%</p>
              <p className="text-xs text-gray-400 mt-1">{contacts?.optedIn ?? 0} of {contacts?.total ?? 0} opted in</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Heatmap tab ────────────────────────────────────────────────── */}
      {activeTab === "heatmap" && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">Best Send Times</h2>
              <p className="text-xs text-gray-400 mt-0.5">Message volume by hour and day of week (last 90 days, UTC)</p>
            </div>
            <Reply className="w-4 h-4 text-gray-300" />
          </div>
          {heatLoading ? (
            <div className="h-40 animate-pulse bg-gray-50 rounded-xl" />
          ) : !heatmap ? (
            <div className="empty-state py-8"><BarChart2 className="empty-icon" /><p className="empty-title">No send data yet</p></div>
          ) : (
            <>
              <SendHeatmap heatmap={heatmap} maxVal={heatmapMax} />
              <p className="text-xs text-gray-400 mt-3">
                Darker cells = more messages sent at that time. Use this to schedule campaigns when your audience is most active.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
