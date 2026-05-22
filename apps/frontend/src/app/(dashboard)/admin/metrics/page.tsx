"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, Megaphone, Mail, MessageSquare, UserCheck, BarChart2 } from "lucide-react";
import { SkeletonStatCard } from "@/components/Skeleton";

interface Metrics {
  contacts: number;
  campaigns: number;
  emailCampaigns: number;
  members: number;
  whatsappMessages: Record<string, number>;
  emailMessages: Record<string, number>;
  totalWhatsapp: number;
  totalEmail: number;
}

const statusBarColor: Record<string, string> = {
  delivered: "bg-green-500",
  read: "bg-brand",
  sent: "bg-blue-400",
  failed: "bg-red-500",
};

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/metrics").then((r) => setMetrics(r.data)).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Contacts",          value: metrics?.contacts ?? 0,       icon: Users,        color: "text-blue-500",   bg: "bg-blue-50" },
    { label: "WA Campaigns",      value: metrics?.campaigns ?? 0,      icon: Megaphone,    color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Email Campaigns",   value: metrics?.emailCampaigns ?? 0, icon: Mail,         color: "text-orange-500", bg: "bg-orange-50" },
    { label: "Team Members",      value: metrics?.members ?? 0,        icon: UserCheck,    color: "text-green-500",  bg: "bg-green-50" },
    { label: "WA Messages Sent",  value: metrics?.totalWhatsapp ?? 0,  icon: MessageSquare, color: "text-brand",     bg: "bg-brand/10" },
    { label: "Emails Sent",       value: metrics?.totalEmail ?? 0,     icon: BarChart2,    color: "text-indigo-500", bg: "bg-indigo-50" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Usage Metrics</h1>
        <p className="text-gray-500 text-sm mt-1">Workspace-level statistics and message performance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)
          : statCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card flex items-center gap-4">
                <div className={`${bg} p-3 rounded-xl shrink-0`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* WhatsApp message breakdown */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare className="w-5 h-5 text-brand" />
            <h2 className="text-base font-semibold text-gray-900">WhatsApp Messages</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-28" />
                  <div className="animate-pulse bg-gray-100 rounded-full h-2 w-full" />
                </div>
              ))}
            </div>
          ) : metrics?.totalWhatsapp === 0 ? (
            <p className="text-gray-400 text-sm">No messages sent yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(metrics?.whatsappMessages ?? {}).map(([status, count]) => {
                const pct = metrics!.totalWhatsapp > 0 ? Math.round((count / metrics!.totalWhatsapp) * 100) : 0;
                const bar = statusBarColor[status] ?? "bg-gray-400";
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700">{status}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${bar} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Email message breakdown */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Mail className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Email Messages</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-28" />
                  <div className="animate-pulse bg-gray-100 rounded-full h-2 w-full" />
                </div>
              ))}
            </div>
          ) : metrics?.totalEmail === 0 ? (
            <p className="text-gray-400 text-sm">No emails sent yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(metrics?.emailMessages ?? {}).map(([status, count]) => {
                const pct = metrics!.totalEmail > 0 ? Math.round((count / metrics!.totalEmail) * 100) : 0;
                const bar = status === "failed" ? "bg-red-500" : "bg-orange-400";
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700">{status}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${bar} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
