"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Megaphone, Play, Pause, CheckCircle2, Trash2, BarChart2, BookOpen, MessageCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";
import TemplatePicker, { type Template } from "@/components/TemplatePicker";

interface Campaign {
  id: string;
  name: string;
  template: string;
  status: "draft" | "running" | "paused" | "completed";
  scheduledAt: string | null;
}

interface CampaignStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

interface RunOptions {
  campaignId: string;
  name: string;
  template: string;
}

const schema = z.object({
  name: z.string().min(1, "Name required"),
  template: z.string().min(1, "Template name required"),
  scheduledAt: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const statusConfig: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  draft:     { label: "Draft",     badge: "badge-gray",   icon: Megaphone },
  running:   { label: "Running",   badge: "badge-green",  icon: Play },
  paused:    { label: "Paused",    badge: "badge-yellow", icon: Pause },
  completed: { label: "Completed", badge: "badge-green",  icon: CheckCircle2 },
};

function RunModal({ campaign, onClose, onDone }: {
  campaign: RunOptions;
  onClose: () => void;
  onDone: () => void;
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ summary: Record<string, number>; total: number } | null>(null);

  useEffect(() => {
    api.get("/contacts?limit=500").then((r) => {
      const opted = r.data.contacts.filter((c: { optIn: boolean }) => c.optIn);
      setContacts(opted);
      setSelectedIds(new Set(opted.map((c: { id: string }) => c.id)));
    }).finally(() => setLoading(false));
  }, []);

  const filtered = tag
    ? contacts.filter((c) => (c as unknown as { tags: string[] }).tags?.includes(tag))
    : contacts;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  const run = async () => {
    if (selectedIds.size === 0) { toast.error("Select at least one contact"); return; }
    setRunning(true);
    try {
      await api.patch(`/campaigns/${campaign.campaignId}`, { status: "running" });
      const res = await api.post("/whatsapp/send-bulk", {
        campaignId: campaign.campaignId,
        contactIds: Array.from(selectedIds),
        templateName: campaign.template,
        languageCode: "en_US",
      });
      await api.patch(`/campaigns/${campaign.campaignId}`, { status: "completed" });
      setResult(res.data);
      onDone();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Failed to run campaign"
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Run Campaign</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-medium">{campaign.name}</span> — template:{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">{campaign.template}</code>
          </p>
        </div>

        {result ? (
          <div className="p-6 text-center flex-1">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-gray-900">Campaign sent!</p>
            <div className="flex justify-center gap-6 mt-4">
              {Object.entries(result.summary).map(([status, count]) => (
                <div key={status} className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 capitalize">{status}</p>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="btn-primary mt-6">Done</button>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="input text-sm flex-1"
                placeholder="Filter by tag (optional)"
              />
              <button onClick={toggleAll} className="btn-secondary text-xs shrink-0">
                {selectedIds.size === filtered.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-center text-gray-400 py-8">Loading opted-in contacts...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No opted-in contacts found</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="rounded accent-brand"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{c.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{selectedIds.size}</span> contacts selected
              </p>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
                <button onClick={run} disabled={running || selectedIds.size === 0} className="btn-primary text-sm flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  {running ? "Sending..." : "Send Now"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatsModal({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const [stats, setStats] = useState<CampaignStats | null>(null);

  useEffect(() => {
    api.get(`/campaigns/${id}/stats`).then((r) => setStats(r.data.stats));
  }, [id]);

  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{name}</h2>
        <p className="text-sm text-gray-500 mb-5">Campaign statistics</p>
        {!stats ? (
          <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
        ) : (
          <div className="space-y-3">
            {(["sent", "delivered", "read", "failed"] as const).map((s) => {
              const val = stats[s] ?? 0;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-gray-700">{s}</span>
                    <span className="font-medium">{val} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-brand h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={onClose} className="btn-secondary w-full mt-5">Close</button>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runTarget, setRunTarget] = useState<RunOptions | null>(null);
  const [statsTarget, setStatsTarget] = useState<{ id: string; name: string } | null>(null);
  const [replyCounts, setReplyCounts] = useState<Record<string, { total: number; unread: number }>>({});

  const PAGE_SIZE = 20;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const watchedTemplate = watch("template");

  const handleTemplateSelect = (t: Template) => {
    setValue("template", t.name, { shouldValidate: true });
    setShowTemplatePicker(false);
  };

  const load = useCallback((p: number) => {
    setLoading(true);
    Promise.all([
      api.get(`/campaigns?page=${p}&limit=${PAGE_SIZE}`),
      api.get("/whatsapp/campaign-replies").catch(() => ({ data: { replies: {} } })),
    ]).then(([r, rr]) => {
      setCampaigns(r.data.campaigns);
      setTotal(r.data.total);
      setReplyCounts(rr.data.replies ?? {});
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/campaigns", {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
      });
      toast.success("Campaign created");
      reset();
      setShowForm(false);
      setPage(1);
      load(1);
    } catch {
      toast.error("Failed to create campaign");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/campaigns/${id}`, { status });
      load(page);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const deleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Delete campaign "${name}"?`)) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success("Deleted");
      if (campaigns.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        load(page);
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {runTarget && (
        <RunModal campaign={runTarget} onClose={() => setRunTarget(null)} onDone={() => load(page)} />
      )}
      {statsTarget && (
        <StatsModal id={statsTarget.id} name={statsTarget.name} onClose={() => setStatsTarget(null)} />
      )}
      {showTemplatePicker && (
        <TemplatePicker onSelect={handleTemplateSelect} onClose={() => setShowTemplatePicker(false)} />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total campaigns</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 max-w-xl">
          <h2 className="text-base font-semibold mb-4">Create Campaign</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign name</label>
                <input {...register("name")} className="input" placeholder="Summer Sale 2025" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">WhatsApp template</label>
                  <button
                    type="button"
                    onClick={() => setShowTemplatePicker(true)}
                    className="text-xs text-brand font-medium flex items-center gap-1 hover:underline"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Browse
                  </button>
                </div>
                <input {...register("template")} className="input font-mono" placeholder="hello_world" />
                {watchedTemplate && (
                  <p className="text-xs text-gray-400 mt-1 font-mono">Selected: {watchedTemplate}</p>
                )}
                {errors.template && <p className="text-red-500 text-xs mt-1">{errors.template.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
              <input {...register("scheduledAt")} type="datetime-local" className="input" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? "Creating..." : "Create Campaign"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No campaigns yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first campaign to start sending</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-500">Name</th>
                <th className="pb-3 text-left font-medium text-gray-500">Template</th>
                <th className="pb-3 text-left font-medium text-gray-500">Status</th>
                <th className="pb-3 text-left font-medium text-gray-500">Replies</th>
                <th className="pb-3 text-left font-medium text-gray-500">Scheduled</th>
                <th className="pb-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c) => {
                const cfg = statusConfig[c.status] ?? statusConfig.draft;
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="py-3">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.template}</code>
                    </td>
                    <td className="py-3">
                      <span className={clsx("badge", cfg.badge)}>{cfg.label}</span>
                    </td>
                    <td className="py-3">
                      {replyCounts[c.id] ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                          <span>{replyCounts[c.id].total}</span>
                          {replyCounts[c.id].unread > 0 && (
                            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                              {replyCounts[c.id].unread} new
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-500 text-xs">
                      {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Stats */}
                        <button
                          onClick={() => setStatsTarget({ id: c.id, name: c.name })}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View stats"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>

                        {/* Run */}
                        {(c.status === "draft" || c.status === "paused") && (
                          <button
                            onClick={() => setRunTarget({ campaignId: c.id, name: c.name, template: c.template })}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Run campaign"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}

                        {/* Pause */}
                        {c.status === "running" && (
                          <button
                            onClick={() => updateStatus(c.id, "paused")}
                            className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete */}
                        {c.status !== "running" && (
                          <button
                            onClick={() => deleteCampaign(c.id, c.name)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} · {total} campaigns
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
