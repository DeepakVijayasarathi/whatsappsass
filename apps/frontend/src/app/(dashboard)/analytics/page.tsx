"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart2, TrendingUp, Users } from "lucide-react";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  const deliveryRate =
    overview && overview.totalMessages > 0
      ? (
          (((overview.messagesByStatus?.delivered ?? 0) +
            (overview.messagesByStatus?.read ?? 0)) /
            overview.totalMessages) *
          100
        ).toFixed(1)
      : "0";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Insights into your messaging performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="card flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-xl">
            <BarChart2 className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{overview?.totalMessages ?? 0}</p>
            <p className="text-sm text-gray-500">Total messages</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-xl">
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{deliveryRate}%</p>
            <p className="text-sm text-gray-500">Delivery rate</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-purple-50 p-3 rounded-xl">
            <Users className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {contacts?.optedIn ?? 0}/{contacts?.total ?? 0}
            </p>
            <p className="text-sm text-gray-500">Opted-in contacts</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Messages by Status</h2>
          {overview?.messagesByStatus &&
          Object.keys(overview.messagesByStatus).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(overview.messagesByStatus).map(([status, count]) => {
                const pct = overview.totalMessages
                  ? Math.round((count / overview.totalMessages) * 100)
                  : 0;
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700">{status}</span>
                      <span className="font-medium">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-brand h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No data yet.</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Contact Tags</h2>
          {contacts?.tagCounts && Object.keys(contacts.tagCounts).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(contacts.tagCounts).map(([tag, count]) => (
                <div
                  key={tag}
                  className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1"
                >
                  <span className="text-sm text-gray-700">{tag}</span>
                  <span className="text-xs font-bold text-brand">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No tagged contacts yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
