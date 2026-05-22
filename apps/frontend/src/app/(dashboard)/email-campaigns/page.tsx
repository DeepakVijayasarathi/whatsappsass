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

      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="page-title">Email Campaigns</h1>
          <p className="page-subtitle">{total} total campaigns</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Campaign</span><span className="sm:hidden">New</span>
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 max-w-2xl">
          <h2 className="text-base font-semibold mb-4">Create Email Campaign</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="tbl-head">
                {["Name", "Subject", "Status", "Created", ""].map((h) => (
                  <th key={h} className="tbl-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} cols={5} />)}
            </tbody>
          </table>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <Mail className="empty-icon" />
            <p className="empty-title">No email campaigns yet</p>
            <p className="empty-desc">Create your first email campaign to start sending</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="tbl-head">
                <th className="tbl-th pl-4 sm:pl-0">Name</th>
                <th className="tbl-th hidden sm:table-cell">Subject</th>
                <th className="tbl-th">Status</th>
                <th className="tbl-th hidden md:table-cell">Created</th>
                <th className="tbl-th text-right pr-4 sm:pr-0">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c) => {
                const cfg = statusConfig[c.status] ?? statusConfig.draft;
                return (
                  <tr key={c.id} className="tbl-row">
                    <td className="tbl-td font-medium text-gray-900 pl-4 sm:pl-0">
                      <div>{c.name}</div>
                      <div className="sm:hidden text-xs text-gray-500 truncate max-w-[180px] mt-0.5">{c.subject}</div>
                    </td>
                    <td className="tbl-td text-gray-600 max-w-xs truncate hidden sm:table-cell">{c.subject}</td>
                    <td className="tbl-td">
                      <span className={clsx("badge flex items-center gap-1 w-fit", cfg.badge)}>
                        <cfg.icon className="w-3 h-3" />
                        <span className="capitalize">{c.status}</span>
                      </span>
                    </td>
                    <td className="tbl-td text-gray-400 text-xs hidden md:table-cell">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="tbl-td pr-4 sm:pr-0">
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
          </div>
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
