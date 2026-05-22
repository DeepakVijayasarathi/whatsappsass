"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, Megaphone, MessageSquare, CheckCircle2, Send, Inbox, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { SkeletonStatCard } from "@/components/Skeleton";

interface OverviewData {
  totalContacts: number;
  totalCampaigns: number;
  totalMessages: number;
  messagesByStatus: Record<string, number>;
}

const statusColors: Record<string, string> = {
  delivered: "bg-green-500",
  read: "bg-brand",
  sent: "bg-blue-400",
  failed: "bg-red-500",
  pending: "bg-yellow-400",
};

const quickActions = [
  { href: "/send",      icon: Send,     label: "Send Message",   desc: "Send a one-off template",   color: "text-brand",   bg: "bg-brand/10" },
  { href: "/contacts",  icon: Users,    label: "Add Contact",    desc: "Manage your contacts",       color: "text-blue-500", bg: "bg-blue-50" },
  { href: "/campaigns", icon: Megaphone, label: "New Campaign",  desc: "Create a bulk campaign",    color: "text-purple-500", bg: "bg-purple-50" },
  { href: "/inbox",     icon: Inbox,    label: "View Inbox",     desc: "Check incoming replies",    color: "text-orange-500", bg: "bg-orange-50" },
];

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/meta/status"),
    ])
      .then(([overview, meta]) => {
        setData(overview.data);
        setWhatsappEnabled(meta.data.metaWhatsappEnabled);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: "Total Contacts",  value: data?.totalContacts ?? 0,  icon: Users,        color: "text-blue-500",   bg: "bg-blue-50" },
    { label: "Campaigns",       value: data?.totalCampaigns ?? 0, icon: Megaphone,    color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Messages Sent",   value: data?.totalMessages ?? 0,  icon: MessageSquare, color: "text-green-500", bg: "bg-green-50" },
    { label: "Delivered",       value: data?.messagesByStatus?.delivered ?? 0, icon: CheckCircle2, color: "text-brand", bg: "bg-brand/10" },
  ];

  const totalMessages = data?.totalMessages ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your WhatsApp activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">WhatsApp API:</span>
          <span className={whatsappEnabled ? "badge-green" : "badge-red"}>
            {whatsappEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : stats.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`${bg} rounded-xl p-3 shrink-0`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Message status breakdown */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Message Status Breakdown</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-32" />
                  <div className="animate-pulse bg-gray-100 rounded-full h-2 w-full" />
                </div>
              ))}
            </div>
          ) : data?.messagesByStatus && Object.keys(data.messagesByStatus).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(data.messagesByStatus).map(([status, count]) => {
                const pct = totalMessages > 0 ? Math.round((count / totalMessages) * 100) : 0;
                const barColor = statusColors[status] ?? "bg-gray-400";
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700 font-medium">{status}</span>
                      <span className="text-gray-500">{count.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`${barColor} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No messages sent yet</p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ href, icon: Icon, label, desc, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
              >
                <div className={`${bg} rounded-lg p-2 shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-brand transition-colors">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand transition-colors shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>

          {!whatsappEnabled && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-start gap-2">
              <span className="text-yellow-500 text-base leading-none mt-0.5">!</span>
              <div>
                <p className="text-xs font-semibold text-yellow-800">WhatsApp API is disabled</p>
                <p className="text-xs text-yellow-600 mt-0.5">
                  Go to{" "}
                  <Link href="/settings" className="underline font-medium">Settings → Provider</Link>
                  {" "}to enable it.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New campaign CTA if no campaigns */}
      {!loading && (data?.totalCampaigns ?? 0) === 0 && (
        <div className="card border-dashed border-2 border-gray-200 bg-white text-center py-10">
          <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Megaphone className="w-6 h-6 text-brand" />
          </div>
          <p className="font-semibold text-gray-900 mb-1">No campaigns yet</p>
          <p className="text-sm text-gray-400 mb-4">Create your first campaign to start reaching contacts</p>
          <Link href="/campaigns" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Campaign
          </Link>
        </div>
      )}
    </div>
  );
}
