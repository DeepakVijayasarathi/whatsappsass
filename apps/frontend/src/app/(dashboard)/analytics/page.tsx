"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BarChart2, TrendingUp, Users, MessageSquare,
  Eye, CheckCircle2, XCircle, Clock, RefreshCw, Download, Calendar,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { SkeletonStatCard } from "@/components/Skeleton";

interface OverviewData {
  totalContacts: number;
  totalCampaigns: number;
  totalMessages: number;
  messagesByStatus: Record<string, number>;
}

interface ContactAnalytics {
  total: number;
  optedIn: number;
  tagCounts: Record<string, number>;
}

interface DailyStats {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

const STATUS_ORDER = ["read", "delivered", "sent", "pending", "failed"];

const statusStyle: Record<string, { bar: string; dot: string; label: string; badge: string }> = {
  delivered: { bar: "bg-emerald-500", dot: "bg-emerald-500", label: "Delivered", badge: "bg-emerald-50 text-emerald-700" },
  read:      { bar: "bg-brand",       dot: "bg-brand",       label: "Read",       badge: "bg-brand/10 text-brand-dark" },
  sent:      { bar: "bg-blue-400",    dot: "bg-blue-400",    label: "Sent",       badge: "bg-blue-50 text-blue-700" },
  failed:    { bar: "bg-red-500",     dot: "bg-red-500",     label: "Failed",     badge: "bg-red-50 text-red-700" },
  pending:   { bar: "bg-amber-400",   dot: "bg-amber-400",   label: "Pending",    badge: "bg-amber-50 text-amber-700" },
};

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
        <div
          className={`${s.bar} h-2 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function toInputDate(d: Date) {
  return d.toISOString().split("T")[0];
}

const DATE_PRESETS = [
  { label: "Today",   days: 0 },
  { label: "7 days",  days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [contacts, setContacts] = useState<ContactAnalytics | null>(null);
  const [trend, setTrend] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activePreset, setActivePreset] = useState<number>(7);

  const defaultTo = toInputDate(new Date());
  const defaultFrom = toInputDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = days === 0 ? to : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setDateTo(toInputDate(to));
    setDateFrom(toInputDate(from));
    setActivePreset(days);
  };

  const loadTrend = (from: string, to: string) => {
    setTrendLoading(true);
    api.get(`/analytics/messages?from=${from}&to=${to}`)
      .then((r) => {
        const data: DailyStats[] = Object.entries(r.data.data as Record<string, Record<string, number>>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, s]) => ({ date, sent: s.sent ?? 0, delivered: s.delivered ?? 0, read: s.read ?? 0, failed: s.failed ?? 0 }));
        setTrend(data);
      })
      .catch(() => { /* toast already shown by interceptor */ })
      .finally(() => setTrendLoading(false));
  };

  const load = (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/contacts"),
    ])
      .then(([o, c]) => { setOverview(o.data); setContacts(c.data); })
      .catch(() => { /* toast already shown by interceptor */ })
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadTrend(dateFrom, dateTo); }, [dateFrom, dateTo]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/analytics/export?from=${dateFrom}&to=${dateTo}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-${dateFrom}-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setExporting(false);
    }
  };

  // For >30-day ranges, aggregate daily bars into weekly buckets to avoid cramped rendering
  const dayCount = trend.length;
  const displayTrend: DailyStats[] = (() => {
    if (dayCount <= 30) return trend;
    // Group into ISO weeks (every 7 days from start)
    const buckets: DailyStats[] = [];
    for (let i = 0; i < trend.length; i += 7) {
      const slice = trend.slice(i, i + 7);
      buckets.push({
        date: slice[0].date,
        sent: slice.reduce((s, d) => s + d.sent, 0),
        delivered: slice.reduce((s, d) => s + d.delivered, 0),
        read: slice.reduce((s, d) => s + d.read, 0),
        failed: slice.reduce((s, d) => s + d.failed, 0),
      });
    }
    return buckets;
  })();

  const trendMax = displayTrend.reduce((m, d) => Math.max(m, d.sent + d.delivered + d.read + d.failed), 1);

  const total = overview?.totalMessages ?? 0;
  const delivered = overview?.messagesByStatus?.delivered ?? 0;
  const read = overview?.messagesByStatus?.read ?? 0;
  const failed = overview?.messagesByStatus?.failed ?? 0;
  const pending = overview?.messagesByStatus?.pending ?? 0;

  const deliveryRate = total > 0 ? (((delivered + read) / total) * 100).toFixed(1) : "0";
  const readRate = total > 0 ? ((read / total) * 100).toFixed(1) : "0";
  const failRate = total > 0 ? ((failed / total) * 100).toFixed(1) : "0";
  const optInRate = contacts && contacts.total > 0 ? Math.round((contacts.optedIn / contacts.total) * 100) : 0;

  const statCards = [
    {
      label: "Total Messages", value: total.toLocaleString(),
      icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50",
      sub: "All time sends",
    },
    {
      label: "Delivery Rate", value: `${deliveryRate}%`,
      icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50",
      sub: `${(delivered + read).toLocaleString()} delivered`,
    },
    {
      label: "Read Rate", value: `${readRate}%`,
      icon: Eye, color: "text-brand", bg: "bg-brand/10",
      sub: `${read.toLocaleString()} read`,
    },
    {
      label: "Failure Rate", value: `${failRate}%`,
      icon: XCircle, color: "text-red-500", bg: "bg-red-50",
      sub: `${failed.toLocaleString()} failed`,
    },
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
          {/* Quick presets */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => applyPreset(p.days)}
                className={clsx(
                  "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
                  activePreset === p.days
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(-1); }}
              className="outline-none text-gray-700 bg-transparent text-xs"
            />
            <span className="text-gray-300 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(-1); }}
              className="outline-none text-gray-700 bg-transparent text-xs"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="icon-btn"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : statCards.map(({ label, value, icon: Icon, color, bg, sub }) => (
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

      {/* Message trend chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Message Trend</h2>
            <p className="text-xs text-gray-400 mt-0.5">{dateFrom} — {dateTo}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            {[{ color: "bg-blue-400", label: "Sent" }, { color: "bg-emerald-500", label: "Delivered" }, { color: "bg-brand", label: "Read" }, { color: "bg-red-400", label: "Failed" }].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
        {trendLoading ? (
          <div className="h-40 flex items-end gap-1">
            {[55, 70, 45, 80, 60, 75, 50].map((h, i) => (
              <div key={i} className="flex-1 animate-pulse bg-gray-100 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        ) : trend.length === 0 ? (
          <div className="empty-state py-8">
            <BarChart2 className="empty-icon" />
            <p className="empty-title">No data for this period</p>
            <p className="empty-desc">Try a different date range</p>
          </div>
        ) : (
          <>
            {dayCount > 30 && (
              <p className="text-[10px] text-gray-400 mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Showing weekly aggregates for {dayCount}-day range
              </p>
            )}
            <div className="flex items-end gap-1 h-40 overflow-x-auto">
              {displayTrend.map((d) => {
                const dayTotal = d.sent + d.delivered + d.read + d.failed;
                const pct = trendMax > 0 ? (dayTotal / trendMax) * 100 : 0;
                const label = dayCount > 30
                  ? `Week of ${d.date.slice(5)}`
                  : d.date.slice(5);
                return (
                  <div key={d.date} className="flex-1 min-w-[28px] flex flex-col items-center group relative">
                    <div
                      className="w-full rounded-t flex flex-col overflow-hidden transition-all duration-300"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    >
                      {d.failed > 0 && <div className="bg-red-400" style={{ flex: d.failed }} />}
                      {d.sent > 0 && <div className="bg-blue-400" style={{ flex: d.sent }} />}
                      {d.delivered > 0 && <div className="bg-emerald-500" style={{ flex: d.delivered }} />}
                      {d.read > 0 && <div className="bg-brand" style={{ flex: d.read }} />}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                      <p className="font-semibold mb-0.5">{label}</p>
                      <p>Sent: {d.sent}</p>
                      <p>Delivered: {d.delivered}</p>
                      <p>Read: {d.read}</p>
                      {d.failed > 0 && <p className="text-red-300">Failed: {d.failed}</p>}
                    </div>
                    <span className="text-[9px] text-gray-400 mt-1 hidden sm:block truncate w-full text-center">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Message breakdown */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">Message Status Breakdown</h2>
              {!loading && total > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{total.toLocaleString()} total messages</p>
              )}
            </div>
            {!loading && total > 0 && (
              <div className="flex gap-2">
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  {deliveryRate}% delivered
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-32" />
                  <div className="animate-pulse bg-gray-100 rounded-full h-2 w-full" />
                </div>
              ))}
            </div>
          ) : total > 0 ? (
            <div className="space-y-5">
              {Object.entries(overview?.messagesByStatus ?? {})
                .sort(([a], [b]) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b))
                .map(([status, count]) => (
                  <StatusBar key={status} status={status} count={count} total={total} />
                ))}
            </div>
          ) : (
            <div className="empty-state">
              <MessageSquare className="empty-icon" />
              <p className="empty-title">No message data yet</p>
              <p className="empty-desc">Send a campaign to see delivery analytics</p>
            </div>
          )}

          {/* Pending callout */}
          {!loading && pending > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-50 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{pending.toLocaleString()} messages are still pending — status updates when Meta delivers them.</span>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Opt-in rate */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Opt-in Rate</h2>
            </div>
            {loading ? (
              <div className="space-y-2">
                <div className="animate-pulse bg-gray-200 rounded h-6 w-20" />
                <div className="animate-pulse bg-gray-100 rounded-full h-3 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-bold text-gray-900">{optInRate}%</span>
                  <span className="text-xs text-gray-400">{contacts?.optedIn ?? 0} / {contacts?.total ?? 0}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${optInRate}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Contacts opted in to receive messages</p>
              </>
            )}
          </div>

          {/* Read vs Delivery comparison */}
          {!loading && total > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-brand" />
                <h2 className="font-semibold text-gray-900 text-sm">Engagement</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-600 font-medium">Delivery rate</span>
                    <span className="font-bold text-emerald-600">{deliveryRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${deliveryRate}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-600 font-medium">Read rate</span>
                    <span className="font-bold text-brand">{readRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-brand h-1.5 rounded-full" style={{ width: `${readRate}%` }} />
                  </div>
                </div>
                {Number(failRate) > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-600 font-medium">Failure rate</span>
                      <span className="font-bold text-red-500">{failRate}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${failRate}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact tags */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Contact Tags</h2>
            </div>
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-200 rounded-full h-7 w-20" />
                ))}
              </div>
            ) : contacts?.tagCounts && Object.keys(contacts.tagCounts).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(contacts.tagCounts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 12)
                  .map(([tag, count]) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1"
                    >
                      <span className="text-xs text-gray-700">{tag}</span>
                      <span className="text-[10px] font-bold text-brand bg-brand/10 rounded-full px-1.5 leading-4">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-400 text-xs">No tagged contacts yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
