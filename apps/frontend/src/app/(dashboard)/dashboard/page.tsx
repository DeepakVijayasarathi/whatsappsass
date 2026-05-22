"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Users, Megaphone, MessageSquare, CheckCircle2,
  Send, Inbox, Plus, ArrowRight, TrendingUp,
  RefreshCw, Zap, Eye, Clock, Activity,
} from "lucide-react";
import Link from "next/link";
import { SkeletonStatCard } from "@/components/Skeleton";
import { getUser } from "@/lib/auth";
import OnboardingChecklist from "@/components/OnboardingChecklist";

interface OverviewData {
  totalContacts: number;
  totalCampaigns: number;
  totalMessages: number;
  messagesByStatus: Record<string, number>;
}

interface RecentCampaign {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
}

interface RecentContact {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-emerald-500",
  read:      "bg-brand",
  sent:      "bg-blue-400",
  failed:    "bg-red-500",
  pending:   "bg-amber-400",
};

const quickActions = [
  { href: "/send",      icon: Send,      label: "Send Message",  desc: "One-off template message", color: "text-brand",     bg: "bg-brand/10" },
  { href: "/contacts",  icon: Users,     label: "Add Contact",   desc: "Grow your audience",       color: "text-blue-500",  bg: "bg-blue-50" },
  { href: "/campaigns", icon: Megaphone, label: "New Campaign",  desc: "Bulk WhatsApp send",       color: "text-purple-500",bg: "bg-purple-50" },
  { href: "/inbox",     icon: Inbox,     label: "View Inbox",    desc: "Check incoming replies",   color: "text-orange-500",bg: "bg-orange-50" },
];

function StatCard({ label, value, icon: Icon, color, bg, trend }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; bg: string; trend?: string;
}) {
  return (
    <div className="card flex items-center gap-4 hover:shadow-md transition-all duration-200 group">
      <div className={`${bg} rounded-2xl p-3.5 shrink-0 group-hover:scale-110 transition-transform duration-200`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-900 tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
      {trend && (
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg shrink-0">
          {trend}
        </span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData]                     = useState<OverviewData | null>(null);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState(false);
  const [lastUpdated, setLastUpdated]       = useState<Date | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const [recentContacts, setRecentContacts]   = useState<RecentContact[]>([]);
  const user = getUser();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/meta/status"),
      api.get("/campaigns?limit=5"),
      api.get("/contacts?limit=5&sort=recent"),
    ])
      .then(([overview, meta, campaigns, contacts]) => {
        setData(overview.data);
        setWhatsappEnabled(meta.data.metaWhatsappEnabled);
        setRecentCampaigns(campaigns.data.campaigns ?? []);
        setRecentContacts(contacts.data.contacts ?? []);
        setLastUpdated(new Date());
      })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const totalMessages   = data?.totalMessages ?? 0;
  const delivered       = data?.messagesByStatus?.delivered ?? 0;
  const read            = data?.messagesByStatus?.read ?? 0;
  const deliveryRate    = totalMessages > 0 ? Math.round(((delivered + read) / totalMessages) * 100) : 0;
  const readRate        = totalMessages > 0 ? Math.round((read / totalMessages) * 100) : 0;

  const stats = [
    { label: "Total Contacts",  value: data?.totalContacts ?? 0,  icon: Users,         color: "text-blue-500",   bg: "bg-blue-50" },
    { label: "Campaigns",       value: data?.totalCampaigns ?? 0, icon: Megaphone,     color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Messages Sent",   value: totalMessages,             icon: MessageSquare, color: "text-emerald-500",bg: "bg-emerald-50" },
    { label: "Delivery Rate",   value: `${deliveryRate}%`,        icon: CheckCircle2,  color: "text-brand",      bg: "bg-brand/10",  trend: deliveryRate >= 90 ? "Excellent" : undefined },
  ];

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">

      {/* ── Onboarding checklist (shown only until all steps complete) ── */}
      <OnboardingChecklist />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">
            {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="page-subtitle">
            Here&apos;s what&apos;s happening with your workspace
            {lastUpdated && (
              <span className="ml-2 text-gray-400">
                · updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={whatsappEnabled ? "badge-green" : "badge-red"}>
            {whatsappEnabled ? "● API Active" : "● API Off"}
          </span>
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

      {/* ── Error ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between">
          <p className="text-sm text-red-600 font-medium">Failed to load dashboard data.</p>
          <button onClick={() => load()} className="text-sm text-red-600 underline font-semibold hover:text-red-800">
            Retry
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : stats.map((s) => <StatCard key={s.label} {...s} />)
        }
      </div>

      {/* ── Middle row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Message breakdown */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Message Delivery Breakdown</h2>
            {!loading && totalMessages > 0 && (
              <span className="text-xs text-gray-400 tabular-nums">{totalMessages.toLocaleString()} total</span>
            )}
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
                .sort(([a], [b]) => {
                  const o = ["read", "delivered", "sent", "pending", "failed"];
                  return o.indexOf(a) - o.indexOf(b);
                })
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
                        <div
                          className={`${STATUS_COLORS[status] ?? "bg-gray-400"} h-2 rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
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

          {/* Read / Delivery rate summary pills */}
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

        {/* Quick actions */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Quick Actions
          </h2>
          <div className="space-y-2">
            {quickActions.map(({ href, icon: Icon, label, desc, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
              >
                <div className={`${bg} rounded-xl p-2.5 shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
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
              <p className="text-amber-600">
                <Link href="/settings" className="underline font-semibold">Settings → Provider</Link> to enable
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent activity ── */}
      {!loading && (recentCampaigns.length > 0 || recentContacts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Recent campaigns */}
          {recentCampaigns.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  Recent Campaigns
                </h2>
                <Link href="/campaigns" className="text-xs text-brand hover:underline font-medium">View all</Link>
              </div>
              <div className="space-y-2">
                {recentCampaigns.map((c) => {
                  const STATUS_BADGE: Record<string, string> = {
                    draft: "badge badge-gray", running: "badge badge-blue", paused: "badge badge-yellow",
                    completed: "badge badge-green",
                  };
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        {c.scheduledAt && (
                          <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(c.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                      <span className={STATUS_BADGE[c.status] ?? "badge badge-gray"}>
                        {c.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recently added contacts */}
          {recentContacts.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  Recent Contacts
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
      {!loading && (data?.totalCampaigns ?? 0) === 0 && (
        <div className="card border-2 border-dashed border-gray-200 bg-gradient-to-br from-white to-brand/5 text-center py-12">
          <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-brand" />
          </div>
          <p className="font-bold text-gray-900 text-lg mb-1">Start your first campaign</p>
          <p className="text-sm text-gray-400 mb-5 max-w-xs mx-auto">
            Create a WhatsApp campaign to reach all your opted-in contacts at once
          </p>
          <Link href="/campaigns" className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Campaign
          </Link>
        </div>
      )}
    </div>
  );
}
