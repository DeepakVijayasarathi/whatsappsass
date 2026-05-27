"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Megaphone, Play, Pause, CheckCircle2, Trash2, BarChart2, BookOpen, MessageCircle, Clock, Copy, Search } from "lucide-react";
import { SkeletonTableRow } from "@/components/Skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";
import TemplatePicker, { type Template } from "@/components/TemplatePicker";
import ConfirmModal from "@/components/ConfirmModal";

interface Campaign {
  id: string;
  name: string;
  template: string;
  status: "draft" | "running" | "paused" | "completed";
  scheduledAt: string | null;
  createdAt: string;
}

type CampaignStats = Record<string, number>;

interface RunOptions {
  campaignId: string;
  name: string;
  template: string;
  templateBody?: string | null;
}

const schema = z.object({
  name: z.string().min(1, "Name required"),
  template: z.string().min(1, "Template name required"),
  scheduledAt: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const statusConfig: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  draft:     { label: "Draft",     badge: "badge-gray",   icon: Clock },
  running:   { label: "Running",   badge: "badge-green",  icon: Play },
  paused:    { label: "Paused",    badge: "badge-yellow", icon: Pause },
  completed: { label: "Completed", badge: "badge-blue",   icon: CheckCircle2 },
};

function extractVariables(body: string | null): number[] {
  if (!body) return [];
  const nums = [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  return nums;
}

function buildComponents(varValues: Record<number, string>): object[] {
  const params = Object.entries(varValues).sort(([a], [b]) => Number(a) - Number(b)).map(([, text]) => ({ type: "text", text }));
  return params.length ? [{ type: "body", parameters: params }] : [];
}

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
  const [varValues, setVarValues] = useState<Record<number, string>>({});
  const [templateBody, setTemplateBody] = useState<string | null>(campaign.templateBody ?? null);

  // Reset and re-fetch whenever the campaign template changes
  useEffect(() => {
    setTemplateBody(campaign.templateBody ?? null);
    setVarValues({});
    if (campaign.templateBody) return;
    api.get("/templates").then((r) => {
      const t = (r.data.templates as Array<{ name: string; body: string | null }>)
        .find((tmpl) => tmpl.name === campaign.template);
      if (t?.body) setTemplateBody(t.body);
    }).catch(() => {});
  }, [campaign.template, campaign.templateBody]);

  const variables = extractVariables(templateBody);

  useEffect(() => {
    api.get("/contacts?limit=1000").then((r) => {
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
    for (const n of variables) {
      if (!varValues[n]?.trim()) { toast.error(`Fill in variable {{${n}}} before sending`); return; }
    }
    setRunning(true);
    try {
      await api.patch(`/campaigns/${campaign.campaignId}`, { status: "running" });
      const res = await api.post("/whatsapp/send-bulk", {
        campaignId: campaign.campaignId,
        contactIds: Array.from(selectedIds),
        templateName: campaign.template,
        languageCode: "en_US",
        components: buildComponents(varValues),
      });
      await api.patch(`/campaigns/${campaign.campaignId}`, { status: "completed" });
      setResult(res.data);
      onDone();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      toast.error(typeof errData === "string" ? errData : "Failed to run campaign");
      // Revert campaign status so the user can retry
      await api.patch(`/campaigns/${campaign.campaignId}`, { status: "paused" }).catch(() => {});
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col">
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

            {variables.length > 0 && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 space-y-2">
                <p className="text-xs font-semibold text-amber-800">Fill in template variables</p>
                {variables.map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <label className="text-xs font-medium text-amber-700 w-20 shrink-0">{`{{${n}}}`}</label>
                    <input
                      className="input text-sm flex-1"
                      placeholder={`Value for {{${n}}}`}
                      value={varValues[n] ?? ""}
                      onChange={(e) => setVarValues((v) => ({ ...v, [n]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}

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
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    setStatsLoading(true);
    setStatsError(false);
    api.get(`/campaigns/${id}/stats`)
      .then((r) => setStats(r.data.stats ?? {}))
      .catch(() => setStatsError(true))
      .finally(() => setStatsLoading(false));
  }, [id]);

  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-5 sm:p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{name}</h2>
        <p className="text-sm text-gray-500 mb-5">Campaign statistics</p>
        {statsLoading ? (
          <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
        ) : statsError ? (
          <p className="text-red-500 text-sm text-center py-4">Failed to load stats — please try again.</p>
        ) : stats ? (
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
        ) : null}
        <button onClick={onClose} className="btn-secondary w-full mt-5">Close</button>
      </div>
    </div>
  );
}

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "running", label: "Running" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
] as const;

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

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
    const statusParam = statusFilter ? `&status=${statusFilter}` : "";
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
    Promise.all([
      api.get(`/campaigns?page=${p}&limit=${PAGE_SIZE}${statusParam}${searchParam}`),
      api.get("/whatsapp/campaign-replies").catch(() => ({ data: { replies: {} } })),
    ])
      .then(([r, rr]) => {
        setCampaigns(r.data.campaigns);
        setTotal(r.data.total);
        setReplyCounts(rr.data.replies ?? {});
      })
      .catch(() => { /* toast shown by interceptor */ })
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [statusFilter, search]);
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

  const duplicateCampaign = async (id: string, name: string) => {
    try {
      await api.post(`/campaigns/${id}/duplicate`);
      toast.success(`Duplicated "${name}"`);
      load(page);
    } catch {
      toast.error("Failed to duplicate");
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success("Deleted");
      setConfirmDelete(null);
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
      {confirmDelete && (
        <ConfirmModal
          title="Delete campaign?"
          message={`"${confirmDelete.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => deleteCampaign(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h1 className="page-title">WA Campaigns</h1>
          <p className="page-subtitle">{total} total campaigns</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Campaign</span><span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Search + Filter tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm"
            placeholder="Search campaigns…"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 self-start sm:self-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                statusFilter === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="card mb-6 max-w-xl">
          <h2 className="text-base font-semibold mb-4">Create Campaign</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-400 pl-4 sm:pl-0 text-xs uppercase tracking-wider">Name</th>
                <th className="pb-3 text-left font-medium text-gray-400 hidden sm:table-cell text-xs uppercase tracking-wider">Template</th>
                <th className="pb-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Status</th>
                <th className="pb-3 text-right font-medium text-gray-400 pr-4 sm:pr-0 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} cols={4} />)}
            </tbody>
          </table>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state py-16">
            <Megaphone className="empty-icon" />
            <p className="empty-title">No campaigns yet</p>
            <p className="empty-desc">Create your first campaign to start sending bulk messages</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="tbl-head">
              <tr>
                <th className="tbl-th pl-4 sm:pl-0">Name</th>
                <th className="tbl-th hidden sm:table-cell">Template</th>
                <th className="tbl-th">Status</th>
                <th className="tbl-th hidden md:table-cell">Replies</th>
                <th className="tbl-th hidden lg:table-cell">Scheduled</th>
                <th className="tbl-th text-right pr-4 sm:pr-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const cfg = statusConfig[c.status] ?? statusConfig.draft;
                const CfgIcon = cfg.icon;
                return (
                  <tr key={c.id} className="tbl-row">
                    <td className="tbl-td font-medium text-gray-900 pl-4 sm:pl-0">
                      <div>{c.name}</div>
                      <div className="sm:hidden mt-0.5">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.template}</code>
                      </div>
                    </td>
                    <td className="tbl-td hidden sm:table-cell">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{c.template}</code>
                    </td>
                    <td className="tbl-td">
                      <span className={clsx("badge flex items-center gap-1 w-fit", cfg.badge)}>
                        <CfgIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="tbl-td hidden md:table-cell">
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
                    <td className="tbl-td text-gray-500 text-xs hidden lg:table-cell">
                      {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="tbl-td text-right pr-4 sm:pr-0">
                      <div className="flex items-center justify-end gap-2">
                        {/* Stats */}
                        <button
                          onClick={() => setStatsTarget({ id: c.id, name: c.name })}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View stats"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={() => duplicateCampaign(c.id, c.name)}
                          className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
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
                            onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
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
          </div>
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
