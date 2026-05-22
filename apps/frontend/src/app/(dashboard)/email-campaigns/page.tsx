"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Plus, Mail, Play, Pause, CheckCircle2, Trash2, BarChart2, X, Send,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";
import { SkeletonTableRow } from "@/components/Skeleton";

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: "draft" | "running" | "paused" | "completed";
  scheduledAt: string | null;
  createdAt: string;
}

const schema = z.object({
  name:    z.string().min(1, "Name required"),
  subject: z.string().min(1, "Subject required"),
  body:    z.string().min(1, "Body required"),
  scheduledAt: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const statusConfig: Record<string, { badge: string; icon: React.ElementType }> = {
  draft:     { badge: "badge-gray",   icon: Mail },
  running:   { badge: "badge-blue",   icon: Play },
  paused:    { badge: "badge-yellow", icon: Pause },
  completed: { badge: "badge-green",  icon: CheckCircle2 },
};

// ── Stats Modal ───────────────────────────────────────────────────────────────
function StatsModal({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const [stats, setStats] = useState<{ stats: Record<string, number>; total: number } | null>(null);

  useEffect(() => {
    api.get(`/email/campaigns/${id}/stats`).then((r) => setStats(r.data));
  }, [id]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">Email campaign stats</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {!stats ? (
          <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
        ) : stats.total === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No emails sent yet.</p>
        ) : (
          <div className="space-y-3">
            {(["sent", "failed"] as const).map((s) => {
              const val = stats.stats[s] ?? 0;
              const pct = stats.total > 0 ? Math.round((val / stats.total) * 100) : 0;
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-gray-700">{s}</span>
                    <span className="font-medium">{val} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${s === "failed" ? "bg-red-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-gray-400 text-center pt-1">{stats.total} total recipients</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Send Modal ────────────────────────────────────────────────────────────────
function SendModal({ campaign, onClose, onDone }: {
  campaign: EmailCampaign;
  onClose: () => void;
  onDone: () => void;
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ summary: { sent: number; failed: number; total: number } } | null>(null);

  useEffect(() => {
    api.get("/contacts?limit=500").then((r) => {
      const opted = r.data.contacts.filter((c: { optIn: boolean; email: string | null }) => c.optIn && c.email);
      setContacts(opted);
      setSelectedIds(new Set(opted.map((c: { id: string }) => c.id)));
    }).finally(() => setLoading(false));
  }, []);

  const toggleAll = () => {
    if (selectedIds.size === contacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(contacts.map((c) => c.id)));
  };

  const send = async () => {
    if (selectedIds.size === 0) { toast.error("Select at least one contact"); return; }
    setSending(true);
    try {
      const res = await api.post(`/email/campaigns/${campaign.id}/send`, { contactIds: Array.from(selectedIds) });
      setResult(res.data);
      onDone();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Send Email Campaign</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{campaign.name} — {campaign.subject}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-6 text-center flex-1">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-gray-900">Campaign sent!</p>
            <div className="flex justify-center gap-8 mt-4">
              {Object.entries(result.summary).map(([k, v]) => (
                <div key={k} className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{v}</p>
                  <p className="text-xs text-gray-500 capitalize">{k}</p>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="btn-primary mt-6">Done</button>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Opted-in contacts with email address:
                <span className="font-semibold text-gray-900 ml-1">{contacts.length}</span>
              </p>
              <button onClick={toggleAll} className="btn-secondary text-xs">
                {selectedIds.size === contacts.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-center text-gray-400 py-8">Loading contacts...</p>
              ) : contacts.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No opted-in contacts with email addresses</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {contacts.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => {
                        setSelectedIds(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
                      }} className="rounded accent-brand" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600"><span className="font-semibold text-gray-900">{selectedIds.size}</span> selected</p>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
                <button onClick={send} disabled={sending || selectedIds.size === 0} className="btn-primary text-sm flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  {sending ? "Sending..." : "Send Now"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sendTarget, setSendTarget] = useState<EmailCampaign | null>(null);
  const [statsTarget, setStatsTarget] = useState<{ id: string; name: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const load = useCallback((p: number) => {
    setLoading(true);
    api.get(`/email/campaigns?page=${p}`).then((r) => {
      setCampaigns(r.data.campaigns);
      setTotal(r.data.total);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/email/campaigns", { ...data, scheduledAt: data.scheduledAt || undefined });
      toast.success("Campaign created");
      reset();
      setShowForm(false);
      setPage(1);
      load(1);
    } catch {
      toast.error("Failed to create campaign");
    }
  };

  const deleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/email/campaigns/${id}`);
      toast.success("Deleted");
      load(page);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {sendTarget && <SendModal campaign={sendTarget} onClose={() => setSendTarget(null)} onDone={() => load(page)} />}
      {statsTarget && <StatsModal id={statsTarget.id} name={statsTarget.name} onClose={() => setStatsTarget(null)} />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total campaigns</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 max-w-2xl">
          <h2 className="text-base font-semibold mb-4">Create Email Campaign</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign name</label>
                <input {...register("name")} className="input" placeholder="Summer Newsletter" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email subject</label>
                <input {...register("subject")} className="input" placeholder="Big news for you!" />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email body (HTML supported)</label>
              <textarea {...register("body")} rows={6} className="input resize-y font-mono text-xs" placeholder="<h1>Hello!</h1><p>Your message here...</p>" />
              {errors.body && <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Name", "Subject", "Status", "Created", ""].map((h) => (
                  <th key={h} className="pb-3 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} cols={5} />)}
            </tbody>
          </table>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No email campaigns yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first email campaign to start sending</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-500">Name</th>
                <th className="pb-3 text-left font-medium text-gray-500">Subject</th>
                <th className="pb-3 text-left font-medium text-gray-500">Status</th>
                <th className="pb-3 text-left font-medium text-gray-500">Created</th>
                <th className="pb-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c) => {
                const cfg = statusConfig[c.status] ?? statusConfig.draft;
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="py-3 text-gray-600 max-w-xs truncate">{c.subject}</td>
                    <td className="py-3">
                      <span className={clsx("badge", cfg.badge, "capitalize")}>{c.status}</span>
                    </td>
                    <td className="py-3 text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setStatsTarget({ id: c.id, name: c.name })}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Stats">
                          <BarChart2 className="w-4 h-4" />
                        </button>
                        {(c.status === "draft" || c.status === "paused") && (
                          <button onClick={() => setSendTarget(c)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Send">
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {c.status !== "running" && (
                          <button onClick={() => deleteCampaign(c.id, c.name)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} · {total} campaigns</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm disabled:opacity-40">Previous</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
