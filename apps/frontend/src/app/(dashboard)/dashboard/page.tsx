"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, Megaphone, MessageSquare, CheckCircle2 } from "lucide-react";

interface OverviewData {
  totalContacts: number;
  totalCampaigns: number;
  totalMessages: number;
  messagesByStatus: Record<string, number>;
}

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Contacts",
      value: data?.totalContacts ?? 0,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Campaigns",
      value: data?.totalCampaigns ?? 0,
      icon: Megaphone,
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      label: "Messages Sent",
      value: data?.totalMessages ?? 0,
      icon: MessageSquare,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      label: "Delivered",
      value: data?.messagesByStatus?.delivered ?? 0,
      icon: CheckCircle2,
      color: "text-brand",
      bg: "bg-brand/10",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your WhatsApp activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">WhatsApp API:</span>
          <span
            className={whatsappEnabled ? "badge-green" : "badge-red"}
          >
            {whatsappEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`${bg} rounded-xl p-3`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Message Status Breakdown</h2>
        {data?.messagesByStatus && Object.keys(data.messagesByStatus).length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {Object.entries(data.messagesByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <span
                  className={
                    status === "delivered" || status === "read"
                      ? "badge-green"
                      : status === "failed"
                      ? "badge-red"
                      : "badge-gray"
                  }
                >
                  {status}
                </span>
                <span className="text-sm font-semibold text-gray-700">{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No messages sent yet.</p>
        )}
      </div>
    </div>
  );
}
