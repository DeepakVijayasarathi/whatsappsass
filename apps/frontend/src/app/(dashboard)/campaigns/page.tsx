"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Megaphone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";

interface Campaign {
  id: string;
  name: string;
  template: string;
  status: string;
  scheduledAt: string | null;
}

const schema = z.object({
  name: z.string().min(1, "Name required"),
  template: z.string().min(1, "Template name required"),
  scheduledAt: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const statusBadge: Record<string, string> = {
  draft: "badge-gray",
  running: "badge-green",
  paused: "badge-yellow",
  completed: "badge-green",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const load = () => {
    api
      .get("/campaigns?limit=50")
      .then((res) => {
        setCampaigns(res.data.campaigns);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/campaigns", {
        ...data,
        scheduledAt: data.scheduledAt
          ? new Date(data.scheduledAt).toISOString()
          : undefined,
      });
      toast.success("Campaign created");
      reset();
      setShowForm(false);
      load();
    } catch {
      toast.error("Failed to create campaign");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/campaigns/${id}`, { status });
      toast.success(`Campaign ${status}`);
      load();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total campaigns</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-4">Create Campaign</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign name</label>
              <input {...register("name")} className="input" placeholder="Summer Sale 2025" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp template name
              </label>
              <input {...register("template")} className="input" placeholder="hello_world" />
              {errors.template && (
                <p className="text-red-500 text-xs mt-1">{errors.template.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule (optional)
              </label>
              <input {...register("scheduledAt")} type="datetime-local" className="input" />
            </div>
            <div className="flex items-end gap-3">
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No campaigns yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-500">Name</th>
                <th className="pb-3 text-left font-medium text-gray-500">Template</th>
                <th className="pb-3 text-left font-medium text-gray-500">Status</th>
                <th className="pb-3 text-left font-medium text-gray-500">Scheduled</th>
                <th className="pb-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="py-3 text-gray-600 font-mono text-xs">{c.template}</td>
                  <td className="py-3">
                    <span className={clsx(statusBadge[c.status] ?? "badge-gray")}>{c.status}</span>
                  </td>
                  <td className="py-3 text-gray-500">
                    {c.scheduledAt
                      ? new Date(c.scheduledAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      {c.status === "draft" && (
                        <button
                          onClick={() => updateStatus(c.id, "running")}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Start
                        </button>
                      )}
                      {c.status === "running" && (
                        <button
                          onClick={() => updateStatus(c.id, "paused")}
                          className="text-xs text-yellow-600 hover:underline"
                        >
                          Pause
                        </button>
                      )}
                      {c.status === "paused" && (
                        <button
                          onClick={() => updateStatus(c.id, "completed")}
                          className="text-xs text-gray-600 hover:underline"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
