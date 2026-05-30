"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Users, Megaphone, MessageSquare, CheckCircle2,
  Send, Plus, ArrowRight, TrendingUp,
  RefreshCw, Zap, Eye, Clock, Activity, Reply,
  Wallet, Phone, BarChart2, FileText, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { SkeletonStatCard } from "@/components/Skeleton";
import { getUser } from "@/lib/auth";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import clsx from "clsx";

interface OverviewData {
  totalContacts: number;
  totalCampaigns: number;
  totalMessages: number;
  messagesByStatus: Record<string, number>;
  trends?: {
    messagesThisWeek: number;
    messagesTrend: number | null;
    contactsThisWeek: number;
    contactsTrend: number | null;
  };
}

interface RecentCampaign {
  id: string; name: string; status: string; scheduledAt: string | null;
}
interface CampaignReplyCounts {
  [campaignId: string]: { total: number; unread: number };
}
interface RecentContact {
  id: string; name: string; phone: string; createdAt: string;
}
interface BalanceData {
  prepaid_balance?: number;
  plan_status?: string;
  subscription_id?: number;
  [key: string]: unknown;
}
interface WaNumber {
  number?: string; integrated_number?: string; phone?: string; status?: string;
  [key: string]: unknown;
}
interface Msg91Analytics {
  [key: string]: unknown;
}
interface Msg91Log {
  requestId?: string;
  customerNumber?: string;
  templateName?: string;
  status?: string;
  requestedAt?: string;
  price?: number | null;
  failureReason?: string | null;
  metaErrorCode?: string | null;
  origin?: string | null;
  sentTime?: { value?: string } | null;
  deliveryTime?: { value?: string } | null;
  readTime?: { value?: string } | null;
  [key: string]: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-emerald-500", read: "bg-brand",
  sent: "bg-blue-400", failed: "bg-red-500", pending: "bg-amber-400",
};

const quickActions = [
  { href: "/send",      icon: Send,      label: "Send Message",  desc: "One-off template message", color: "text-brand",     bg: "bg-brand/10" },
  { href: "/contacts",  icon: Users,     label: "Add Contact",   desc: "Grow your audience",       color: "text-blue-500",  bg: "bg-blue-50" },
  { href: "/campaigns", icon: Megaphone, label: "New Campaign",  desc: "Bulk WhatsApp send",       color: "text-purple-500",bg: "bg-purple-50" },
  { href: "/templates", icon: FileText,  label: "Templates",     desc: "Manage WA templates",      color: "text-orange-500",bg: "bg-orange-50" },
];

function StatCard({ label, value, icon: Icon, color, bg, trend, trendCls }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; bg: string; trend?: string; trendCls?: string;
}) {
  return (
    <div className="card flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 hover:shadow-md transition-all duration-200 group p-4">
      <div className={`${bg} rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shrink-0 group-hover:scale-110 transition-transform duration-200`}>
        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums leading-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-tight">{label}</p>
        {trend && (
          <span className={`inline-block mt-1.5 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md ${trendCls ?? "text-emerald-600 bg-emerald-50"}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data,             setData]             = useState<OverviewData | null>(null);
  const [whatsappEnabled,  setWhatsappEnabled]  = useState(false);
  const [provider,         setProvider]         = useState<"meta" | "msg91" | "">("");
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [error,            setError]            = useState(false);
  const [lastUpdated,      setLastUpdated]      = useState<Date | null>(null);
  const [recentCampaigns,  setRecentCampaigns]  = useState<RecentCampaign[]>([]);
  const [recentContacts,   setRecentContacts]   = useState<RecentContact[]>([]);
  const [campaignReplies,  setCampaignReplies]  = useState<CampaignReplyCounts>({});
  // MSG91-specific
  const [balance,          setBalance]          = useState<BalanceData | null>(null);
  const [waNumbers,        setWaNumbers]        = useState<WaNumber[]>([]);
  const [msg91Analytics,   setMsg91Analytics]   = useState<Msg91Analytics | null>(null);
  const [msg91Logs,        setMsg91Logs]        = useState<Msg91Log[]>([]);

  const user = getUser();

  const today    = new Date().toISOString().slice(0, 10);
  const weekAgo  = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);

    Promise.allSettled([
      api.get("/analytics/overview"),
      api.get("/meta/status"),
      api.get("/campaigns?limit=5"),
      api.get("/contacts?limit=5&sort=recent"),
      api.get("/whatsapp/campaign-replies"),
      api.get("/workspace/provider"),
    ]).then(([overview, meta, campaigns, contacts, replies, prov]) => {
      let anyError = false;
      if (overview.status === "fulfilled") setData(overview.value.data); else anyError = true;
      if (meta.status === "fulfilled")     setWhatsappEnabled(meta.value.data.metaWhatsappEnabled ?? false);
      if (campaigns.status === "fulfilled") setRecentCampaigns(campaigns.value.data.campaigns ?? []);
      if (contacts.status === "fulfilled")  setRecentContacts(contacts.value.data.contacts ?? []);
      if (replies.status === "fulfilled")   setCampaignReplies(replies.value.data.replies ?? {});
      if (prov.status === "fulfilled") {
        const p = prov.value.data.whatsappProvider ?? "";
        setProvider(p);
      }
      if (!anyError) setLastUpdated(new Date());
      if (anyError) setError(true);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  // Load MSG91-specific data after provider is known
  useEffect(() => {
    if (provider !== "msg91") return;
    Promise.allSettled([
      api.get("/whatsapp/balance"),
      api.get("/whatsapp/numbers"),
      api.get(`/whatsapp/msg91-analytics?startDate=${weekAgo}&endDate=${today}`),
      api.get(`/whatsapp/logs?startDate=${weekAgo}&endDate=${today}`),
    ]).then(([bal, nums, analytics, logs]) => {
      if (bal.status === "fulfilled") {
        const d = bal.value.data;
        setBalance((d?.data && typeof d.data === "object") ? d.data : d);
      }
      if (nums.status === "fulfilled") {
        const raw = nums.value.data;
        const list: WaNumber[] = Array.isArray(raw) ? raw
          : Array.isArray(raw?.data) ? raw.data
          : Array.isArray(raw?.numbers) ? raw.numbers
          : [];
        setWaNumbers(list);
      }
      if (analytics.status === "fulfilled") setMsg91Analytics(analytics.value.data);
      if (logs.status === "fulfilled") {
        const raw = logs.value.data;
        // MSG91 returns { data: [...], metadata: { total } }
        const list: Msg91Log[] = Array.isArray(raw?.data) ? raw.data
          : Array.isArray(raw) ? raw
          : Array.isArray(raw?.logs) ? raw.logs
          : [];
        setMsg91Logs(list.slice(0, 10));
      }
    });
  }, [provider, today, weekAgo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const totalMessages = data?.totalMessages ?? 0;
  const delivered     = data?.messagesByStatus?.delivered ?? 0;
  const read          = data?.messagesByStatus?.read ?? 0;
  const deliveryRate  = totalMessages > 0 ? Math.round(((delivered + read) / totalMessages) * 100) : 0;
  const readRate      = totalMessages > 0 ? Math.round((read / totalMessages) * 100) : 0;

  const fmtTrend   = (v: number | null | undefined) => v == null ? undefined : v >= 0 ? `+${v}% vs last week` : `${v}% vs last week`;
  const trendColor = (v: number | null | undefined) => v == null ? "" : v >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50";

  const stats = [
    { label: "Total Contacts", value: data?.totalContacts  ?? 0, icon: Users,         color: "text-blue-500",   bg: "bg-blue-50",   trend: fmtTrend(data?.trends?.contactsTrend),  trendCls: trendColor(data?.trends?.contactsTrend) },
    { label: "Campaigns",      value: data?.totalCampaigns ?? 0, icon: Megaphone,     color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Messages Sent",  value: totalMessages,             icon: MessageSquare, color: "text-emerald-500",bg: "bg-emerald-50", trend: fmtTrend(data?.trends?.messagesTrend),  trendCls: trendColor(data?.trends?.messagesTrend) },
    { label: "Delivery Rate",  value: `${deliveryRate}%`,        icon: CheckCircle2,  color: "text-brand",      bg: "bg-brand/10",  trend: deliveryRate >= 90 ? "Excellent" : undefined, trendCls: "text-emerald-600 bg-emerald-50" },
    ...(balance?.prepaid_balance != null ? [{
      label: "WA Balance", value: `₹${Number(balance.prepaid_balance).toFixed(2)}`,
      icon: Wallet, color: "text-amber-500", bg: "bg-amber-50",
      trend: balance.plan_status ? String(balance.plan_status) : undefined,
      trendCls: balance.plan_status === "active" ? "text-emerald-600 bg-emerald-50" : "text-gray-600 bg-gray-100",
    }] : []),
  ];

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <OnboardingChecklist />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</h1>
          <p className="page-subtitle">
            Here&apos;s what&apos;s happening with your workspace
            {lastUpdated && <span className="ml-2 text-gray-400 hidden sm:inline">· updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {provider && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide hidden sm:inline">
              {provider}
            </span>
          )}
          <span className={whatsappEnabled ? "badge-green" : "badge-red"}>
            {whatsappEnabled ? "● Active" : "● Off"}
          </span>
          <button onClick={() => load(true)} disabled={refreshing} className="icon-btn" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between">
          <p className="text-sm text-red-600 font-medium">Failed to load dashboard data.</p>
          <button onClick={() => load()} className="text-sm text-red-600 underline font-semibold">Retry</button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : stats.map((s) => <StatCard key={s.label} {...s} />)
        }
      </div>

      {/* ── MSG91 Numbers ── */}
      {provider === "msg91" && waNumbers.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-500" /> Registered WhatsApp Numbers
          </h2>
          <div className="flex flex-wrap gap-2">
            {waNumbers.map((n, i) => {
              const num    = String(n.number ?? n.integrated_number ?? n.phone ?? "—");
              const status = String(n.status ?? "");
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full text-xs font-mono font-semibold text-green-800">
                  <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", status.toLowerCase() === "active" || status.toLowerCase() === "enabled" ? "bg-green-500" : "bg-gray-400")} />
                  {num}{status && <span className="ml-1 font-sans font-normal text-green-600">({status})</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Middle row: Delivery chart + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Message Delivery Breakdown</h2>
            {!loading && totalMessages > 0 && <span className="text-xs text-gray-400 tabular-nums">{totalMessages.toLocaleString()} total</span>}
          </div>
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-28" />
                  <div className="animate-pulse bg-gray-100 rounded-full h-2 w-full" />
                </div>
              ))}
            </div>
          ) : totalMessages > 0 ? (
            <div className="space-y-4">
              {Object.entries(data?.messagesByStatus ?? {})
                .sort(([a], [b]) => ["read","delivered","sent","pending","failed"].indexOf(a) - ["read","delivered","sent","pending","failed"].indexOf(b))
                .map(([status, count]) => {
                  const pct = Math.round((count / totalMessages) * 100);
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status] ?? "bg-gray-400"}`} />
                          <span className="capitalize font-medium text-gray-700">{status}</span>
                        </div>
                        <span className="tabular-nums text-gray-500">{count.toLocaleString()} · {pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={`${STATUS_COLORS[status] ?? "bg-gray-400"} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="empty-state">
              <MessageSquare className="empty-icon" />
              <p className="empty-title">No messages yet</p>
              <p className="empty-desc">Send your first message or run a campaign</p>
            </div>
          )}
          {!loading && totalMessages > 0 && (
            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-50">
              <div className="flex items-center gap-2 bg-brand/8 rounded-xl px-3 py-2">
                <TrendingUp className="w-4 h-4 text-brand" />
                <span className="text-xs font-semibold text-brand-dark">{deliveryRate}% Delivery rate</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                <Eye className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-blue-700">{readRate}% Read rate</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Quick Actions
          </h2>
          <div className="space-y-2">
            {quickActions.map(({ href, icon: Icon, label, desc, color, bg }) => (
              <Link key={href} href={href}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group">
                <div className={`${bg} rounded-xl p-2.5 shrink-0`}><Icon className={`w-4 h-4 ${color}`} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-brand transition-colors">{label}</p>
                  <p className="text-xs text-gray-400 truncate">{desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
          {!whatsappEnabled && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs">
              <p className="font-semibold text-amber-800 mb-0.5">WhatsApp API disabled</p>
              <p className="text-amber-600"><Link href="/settings" className="underline font-semibold">Settings → Provider</Link> to enable</p>
            </div>
          )}
        </div>
      </div>

      {/* ── MSG91 Analytics (7-day) ── */}
      {provider === "msg91" && msg91Analytics && Object.keys(msg91Analytics).length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-500" />
            <span>MSG91 Analytics</span>
            <span className="text-xs font-normal text-gray-400 ml-1">Last 7 days</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {Object.entries(msg91Analytics)
              .filter(([, v]) => v !== null && typeof v !== "object")
              .map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums">{String(v)}</p>
                  <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 capitalize leading-tight">{k.replace(/_/g, " ")}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── MSG91 Logs ── */}
      {provider === "msg91" && msg91Logs.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500 shrink-0" />
            <h2 className="font-semibold text-gray-900">Recent WhatsApp Logs</h2>
            <span className="ml-auto text-xs text-gray-400 shrink-0">Last 7 days</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">To</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Template</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 hidden md:table-cell">Price</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 hidden sm:table-cell">Requested At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {msg91Logs.map((log, i) => {
                  const to       = String(log.customerNumber ?? "—");
                  const tpl      = String(log.templateName ?? "—");
                  const status   = String(log.status ?? "—").toLowerCase();
                  const date     = log.requestedAt ?? "—";
                  const price    = log.price != null ? `₹${Number(log.price).toFixed(4)}` : "—";
                  const failure  = log.failureReason ?? log.metaErrorCode;
                  const statusCls = status === "delivered" ? "text-emerald-600 bg-emerald-50"
                    : status === "read"   ? "text-brand bg-brand/10"
                    : status === "failed" ? "text-red-600 bg-red-50"
                    : status === "sent"   ? "text-blue-600 bg-blue-50"
                    : "text-gray-500 bg-gray-100";
                  return (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-mono text-gray-700 whitespace-nowrap">{to}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-500 whitespace-nowrap">{tpl}</td>
                      <td className="px-4 py-2.5">
                        <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap", statusCls)}>
                          {status}
                        </span>
                        {failure && (
                          <p className="text-[10px] text-red-500 mt-0.5 truncate max-w-[160px]" title={String(failure)}>{String(failure)}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell">{price}</td>
                      <td className="px-4 py-2.5 text-gray-400 hidden sm:table-cell whitespace-nowrap">
                        {date !== "—" ? date.replace("T", " ").slice(0, 16) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recent activity ── */}
      {!loading && (recentCampaigns.length > 0 || recentContacts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {recentCampaigns.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" /> Recent Campaigns
                </h2>
                <Link href="/campaigns" className="text-xs text-brand hover:underline font-medium">View all</Link>
              </div>
              <div className="space-y-2">
                {recentCampaigns.map((c) => {
                  const STATUS_BADGE: Record<string, string> = {
                    draft: "badge badge-gray", running: "badge badge-blue",
                    paused: "badge badge-yellow", completed: "badge badge-green",
                  };
                  const replyInfo = campaignReplies[c.id];
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        {c.scheduledAt && (
                          <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(c.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {replyInfo && replyInfo.total > 0 && (
                          <span className={clsx("flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                            replyInfo.unread > 0 ? "bg-brand text-white" : "bg-gray-100 text-gray-500")}>
                            <Reply className="w-3 h-3" />
                            {replyInfo.unread > 0 ? replyInfo.unread : replyInfo.total}
                          </span>
                        )}
                        <span className={STATUS_BADGE[c.status] ?? "badge badge-gray"}>{c.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recentContacts.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" /> Recent Contacts
                </h2>
                <Link href="/contacts" className="text-xs text-brand hover:underline font-medium">View all</Link>
              </div>
              <div className="space-y-2">
                {recentContacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-400">{c.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty CTA ── */}
      {!loading && !error && (data?.totalCampaigns ?? 0) === 0 && (
        <div className="card border-2 border-dashed border-gray-200 bg-gradient-to-br from-white to-brand/5 text-center py-12">
          <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-brand" />
          </div>
          <p className="font-bold text-gray-900 text-lg mb-1">Start your first campaign</p>
          <p className="text-sm text-gray-400 mb-5 max-w-xs mx-auto">
            Create a WhatsApp campaign to reach all your opted-in contacts at once
          </p>
          <Link href="/campaigns" className="btn-primary">
            <Plus className="w-4 h-4" /> Create Campaign
          </Link>
        </div>
      )}

      {/* ── Provider not configured ── */}
      {!loading && !whatsappEnabled && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">WhatsApp provider not active</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Go to <Link href="/settings" className="underline font-semibold">Settings → WhatsApp Provider</Link> to connect Meta Cloud API or MSG91.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
