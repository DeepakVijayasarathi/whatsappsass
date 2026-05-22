"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart2, TrendingUp, Users, MessageSquare } from "lucide-react";
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

const statusStyle: Record<string, { bar: string; badge: string; label: string }> = {
  delivered: { bar: "bg-green-500",  badge: "bg-green-100 text-green-700",  label: "Delivered" },
  read:      { bar: "bg-brand",      badge: "bg-brand/20 text-brand-dark",  label: "Read"      },
  sent:      { bar: "bg-blue-400",   badge: "bg-blue-100 text-blue-700",    label: "Sent"      },
  failed:    { bar: "bg-red-500",    badge: "bg-red-100 text-red-700",      label: "Failed"    },
  pending:   { bar: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700", label: "Pending"  },
};

function StatusBar({ status, count, total }: { status: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const style = statusStyle[status] ?? { bar: "bg-gray-400", badge: "bg-gray-100 text-gray-600", label: status };
  return (
    <div>
      <div className="flex justify-between items-center text-sm mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${style.bar}`} />
          <span className="capitalize text-gray-700 font-medium">{style.label}</span>
        </div>
        <span className="text-gray-500 tabular-nums">{count.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${style.bar} h-2.5 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [contacts, setContacts] = useState<ContactAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/contacts"),
    ])
      .then(([o, c]) => {
        setOverview(o.data);
        setContacts(c.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const deliveryRate =
    overview && overview.totalMessages > 0
      ? (
          (((overview.messagesByStatus?.delivered ?? 0) +
            (overview.messagesByStatus?.read ?? 0)) /
            overview.totalMessages) *
          100
        ).toFixed(1)
      : "0";

  const optInRate =
    contacts && contacts.total > 0
      ? Math.round((contacts.optedIn / contacts.total) * 100)
      : 0;

  const statCards = [
    { label: "Total Messages",   value: overview?.totalMessages ?? 0,  icon: BarChart2,    color: "text-blue-500",   bg: "bg-blue-50" },
    { label: "Delivery Rate",    value: `${deliveryRate}%`,            icon: TrendingUp,   color: "text-green-500",  bg: "bg-green-50" },
    { label: "Opted-in Contacts", value: `${contacts?.optedIn ?? 0} / ${contacts?.total ?? 0}`, icon: Users, color: "text-purple-500", bg: "bg-purple-50" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Insights into your messaging performance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonStatCard key={i} />)
          : statCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`${bg} p-3 rounded-xl shrink-0`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Message status breakdown */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Messages by Status</h2>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-32" />
                  <div className="animate-pulse bg-gray-100 rounded-full h-2.5 w-full" />
                </div>
              ))}
            </div>
          ) : overview?.messagesByStatus && Object.keys(overview.messagesByStatus).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(overview.messagesByStatus)
                .sort(([a], [b]) => {
                  const order = ["delivered", "read", "sent", "pending", "failed"];
                  return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99);
                })
                .map(([status, count]) => (
                  <StatusBar key={status} status={status} count={count} total={overview.totalMessages} />
                ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No message data yet</p>
            </div>
          )}
        </div>

        {/* Contact tags + opt-in rate */}
        <div className="space-y-5">
          {/* Opt-in rate card */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Opt-in Rate</h2>
            {loading ? (
              <div className="space-y-2">
                <div className="animate-pulse bg-gray-200 rounded h-4 w-24" />
                <div className="animate-pulse bg-gray-100 rounded-full h-3 w-full" />
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">
                    <span className="font-bold text-gray-900">{contacts?.optedIn ?? 0}</span> opted in
                  </span>
                  <span className="font-semibold text-green-600">{optInRate}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-brand h-3 rounded-full transition-all duration-700"
                    style={{ width: `${optInRate}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {contacts?.total ?? 0} total contacts
                </p>
              </>
            )}
          </div>

          {/* Contact tags */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Contact Tags</h2>
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-200 rounded-full h-7 w-20" />
                ))}
              </div>
            ) : contacts?.tagCounts && Object.keys(contacts.tagCounts).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(contacts.tagCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([tag, count]) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 hover:border-brand/40 transition-colors"
                    >
                      <span className="text-sm text-gray-700">{tag}</span>
                      <span className="text-xs font-bold text-brand bg-brand/10 rounded-full px-1.5 py-0.5 leading-none">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No tagged contacts yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
