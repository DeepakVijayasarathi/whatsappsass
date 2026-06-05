"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Megaphone, Play, Pause, CheckCircle2, Trash2, BarChart2, BookOpen, MessageCircle, Clock, Copy, Search, Download } from "lucide-react";
import MediaHeaderInput from "@/components/MediaHeaderInput";
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
  languageCode: string;
  status: "draft" | "running" | "paused" | "completed";
  scheduledAt: string | null;
  createdAt: string;
}

type CampaignStats = Record<string, number>;

interface RunOptions {
  campaignId: string;
  name: string;
  template: string;
  languageCode: string;
  templateBody?: string | null;
}

const schema = z.object({
  name: z.string().min(1, "Name required"),
  template: z.string().min(1, "Template name required"),
  languageCode: z.string().default("en_US"),
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

function buildComponents(
  varValues: Record<number, string>,
  headerFormat?: string | null,
  headerMediaUrl?: string,
): object[] {
  const result: object[] = [];
  if (headerFormat && headerMediaUrl?.trim() && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)) {
    const t = headerFormat.toLowerCase();
    result.push({ type: "header", parameters: [{ type: t, [t]: { link: headerMediaUrl.trim() } }] });
  }
  const params = Object.entries(varValues).sort(([a], [b]) => Number(a) - Number(b)).map(([, text]) => ({ type: "text", text }));
  if (params.length) result.push({ type: "body", parameters: params });
  return result;
}

const LEAD_STATUSES = ["new", "prospect", "qualified", "customer", "churned"];

function RunModal({ campaign, onClose, onDone }: {
  campaign: RunOptions;
  onClose: () => void;
  onDone: () => void;
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string; tags: string[]; leadStatus: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<
    | { background: true; queued: number; skipped: number }
    | { summary: Record<string, number>; total: number; skipped: number }
    | null
  >(null);
  const [varValues, setVarValues] = useState<Record<number, string>>({});
  const [templateBody, setTemplateBody] = useState<string | null>(campaign.templateBody ?? null);
  const [templateHeaderFormat, setTemplateHeaderFormat] = useState<string | null>(null);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [segments, setSegments] = useState<{ id: string; name: string; count: number }[]>([]);
  const [activeSegment, setActiveSegment] = useState("");
  const [resolvingSegment, setResolvingSegment] = useState(false);

  useEffect(() => {
    setTemplateBody(campaign.templateBody ?? null);
    setVarValues({});
    setTemplateHeaderFormat(null);
    setHeaderMediaUrl("");
    api.get("/templates").then((r) => {
      const t = (r.data.templates as Array<{ name: string; body: string | null; headerFormat: string | null }>)
        .find((tmpl) => tmpl.name === campaign.template);
      if (t?.body) setTemplateBody(t.body);
      if (t?.headerFormat) setTemplateHeaderFormat(t.headerFormat);
    }).catch(() => {});
  }, [campaign.template, campaign.templateBody]);

  const variables = extractVariables(templateBody);

  useEffect(() => {
    // API already filters to optIn=true — no client-side re-filter needed.
    // Limit raised to 5000 so larger workspaces don't silently miss contacts.
    api.get("/contacts?limit=5000&optIn=true").then((r) => {
      const contacts = r.data.contacts as Array<{ optIn: boolean; tags: string[]; leadStatus: string; id: string; name: string; phone: string }>;
      setContacts(contacts);
      setSelectedIds(new Set(contacts.map((c) => c.id)));
      const tags = Array.from(new Set(contacts.flatMap((c) => c.tags))).sort();
      setAllTags(tags);
    }).finally(() => setLoading(false));
  }, []);

  // Load saved segments so the user can pick one as the audience.
  useEffect(() => {
    api.get("/contacts/segments")
      .then((r) => setSegments((r.data.segments as Array<{ id: string; name: string; count: number }>) ?? []))
      .catch(() => { /* segments are optional — ignore load failures */ });
  }, []);

  // Resolve a saved segment to its (opted-in) contact IDs and select exactly those.
  const applySegment = async (segmentId: string) => {
    setActiveSegment(segmentId);
    if (!segmentId) {
      // "No segment" → select all loaded contacts (the default).
      setSelectedIds(new Set(contacts.map((c) => c.id)));
      return;
    }
    setResolvingSegment(true);
    try {
      const r = await api.get(`/contacts/segments/${segmentId}/resolve`);
      const ids = new Set<string>((r.data.contactIds as string[]) ?? []);
      // Intersect with the contacts loaded in this modal so the checklist stays in sync.
      const loadedIds = new Set(contacts.map((c) => c.id));
      const selectable = [...ids].filter((id) => loadedIds.has(id));
      setSelectedIds(new Set(selectable));
      if (selectable.length === 0) {
        toast("This segment matches no opted-in contacts.", { icon: "⚠️" });
      } else if (selectable.length < ids.size) {
        toast(`${selectable.length} of ${ids.size} segment contacts are loaded here.`, { icon: "ℹ️" });
      }
      // Clear the tag/status filters so the segment selection is shown unfiltered.
      setTagFilter("");
      setLeadStatusFilter("");
    } catch {
      toast.error("Failed to load segment");
    } finally {
      setResolvingSegment(false);
    }
  };

  const filtered = contacts.filter((c) => {
    if (tagFilter && !c.tags.includes(tagFilter)) return false;
    if (leadStatusFilter && c.leadStatus !== leadStatusFilter) return false;
    return true;
  });

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
    if (templateHeaderFormat && ["IMAGE", "VIDEO", "DOCUMENT"].includes(templateHeaderFormat) && !headerMediaUrl.trim()) {
      toast.error(`Provide a ${templateHeaderFormat.toLowerCase()} URL for the template header`);
      return;
    }
    for (const n of variables) {
      if (!varValues[n]?.trim()) { toast.error(`Fill in variable {{${n}}} before sending`); return; }
    }
    setRunning(true);
    try {
      // The backend now owns campaign status: small audiences return 200 with a
      // summary (status → completed); large audiences return 202 and finish in the
      // background (status → running, then completed). We no longer patch status
      // from here, which previously force-completed background sends prematurely.
      const res = await api.post("/whatsapp/send-bulk", {
        campaignId: campaign.campaignId,
        contactIds: Array.from(selectedIds),
        templateName: campaign.template,
        languageCode: campaign.languageCode || "en_US",
        components: buildComponents(varValues, templateHeaderFormat, headerMediaUrl),
      });
      if (res.status === 202) {
        // Background send queued — there's no per-status summary yet.
        setResult({ background: true, queued: res.data.queued ?? selectedIds.size, skipped: res.data.skipped ?? 0 });
      } else {
        setResult({ summary: res.data.summary ?? {}, total: res.data.total ?? 0, skipped: res.data.skipped ?? 0 });
      }
      onDone();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      toast.error(typeof errData === "string" ? errData : "Failed to run campaign");
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
            {"background" in result ? (
              <>
                <p className="text-lg font-bold text-gray-900">Sending in the background</p>
                <p className="text-sm text-gray-500 mt-1">
                  {result.queued} message{result.queued === 1 ? "" : "s"} queued. Check the campaign
                  stats shortly to see delivery results.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-gray-900">Campaign sent!</p>
                <div className="flex justify-center gap-6 mt-4">
                  {Object.entries(result.summary).map(([status, count]) => (
                    <div key={status} className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                      <p className="text-xs text-gray-500 capitalize">{status}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            {result.skipped > 0 && (
              <p className="text-xs text-gray-400 mt-3">
                {result.skipped} contact{result.skipped === 1 ? "" : "s"} skipped (already sent in this campaign)
              </p>
            )}
            <button onClick={onClose} className="btn-primary mt-6">Done</button>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-2">
              {segments.length > 0 && (
                <select
                  value={activeSegment}
                  onChange={(e) => applySegment(e.target.value)}
                  disabled={resolvingSegment}
                  className="input text-sm flex-1 min-w-[140px]"
                  aria-label="Select a saved segment as the audience"
                >
                  <option value="">Audience: all opted-in</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>Segment: {s.name} ({s.count})</option>
                  ))}
                </select>
              )}
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="input text-sm flex-1 min-w-[120px]"
              >
                <option value="">All tags</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={leadStatusFilter}
                onChange={(e) => setLeadStatusFilter(e.target.value)}
                className="input text-sm flex-1 min-w-[120px]"
              >
                <option value="">All statuses</option>
                {LEAD_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
              <button onClick={toggleAll} className="btn-secondary text-xs shrink-0">
                {selectedIds.size === filtered.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            {templateHeaderFormat && ["IMAGE", "VIDEO", "DOCUMENT"].includes(templateHeaderFormat) && (
              <div className="px-4 py-3 border-b border-purple-100 bg-purple-50 space-y-2">
                <p className="text-xs font-semibold text-purple-800">
                  {templateHeaderFormat.charAt(0) + templateHeaderFormat.slice(1).toLowerCase()} Header
                </p>
                <MediaHeaderInput
                  format={templateHeaderFormat as "IMAGE" | "VIDEO" | "DOCUMENT"}
                  value={headerMediaUrl}
                  onChange={setHeaderMediaUrl}
                />
              </div>
            )}

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
                <button onClick={run} disabled={loading || running || selectedIds.size === 0} className="btn-primary text-sm flex items-center gap-2">
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

interface CampaignFunnel {
  attempted: number; sent: number; delivered: number; read: number; failed: number; replies: number;
  rates: { deliveryRate: number; readRate: number; failureRate: number; replyRate: number };
}

function StatsModal({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [funnel, setFunnel] = useState<CampaignFunnel | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setStatsLoading(true);
    setStatsError(false);
    api.get(`/campaigns/${id}/stats`)
      .then((r) => { setStats(r.data.stats ?? {}); setFunnel(r.data.funnel ?? null); })
      .catch(() => setStatsError(true))
      .finally(() => setStatsLoading(false));
  }, [id]);

  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/campaigns/${id}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export campaign results");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
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

            {funnel && (
              <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                {([
                  ["Delivery rate", funnel.rates.deliveryRate],
                  ["Read rate", funnel.rates.readRate],
                  ["Failure rate", funnel.rates.failureRate],
                  ["Reply rate", funnel.rates.replyRate],
                ] as const).map(([label, rate]) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-gray-900">{rate}%</p>
                    <p className="text-[11px] text-gray-500">{label}</p>
                  </div>
                ))}
                <div className="col-span-2 text-center text-xs text-gray-500">
                  {funnel.replies} repl{funnel.replies === 1 ? "y" : "ies"} received
                </div>
              </div>
            )}
          </div>
        ) : null}
        <div className="flex gap-2 mt-5">
          <button onClick={exportCsv} disabled={exporting || total === 0} className="btn-secondary flex-1 text-sm flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <button onClick={onClose} className="btn-primary flex-1 text-sm">Close</button>
        </div>
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
  const [provider, setProvider] = useState<string>("");

  const PAGE_SIZE = 20;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const watchedTemplate = watch("template");

  const handleTemplateSelect = (t: Template) => {
    setValue("template", t.name, { shouldValidate: true });
    // Carry the template's language code so campaigns send in the correct locale
    setValue("languageCode", t.language, { shouldValidate: true });
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

  // Load provider once on mount
  useEffect(() => { api.get("/workspace/provider").then((r) => setProvider(r.data.whatsappProvider ?? "")).catch(() => {}); }, []);
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language code
                <span className="ml-1 text-gray-400 font-normal text-xs">(auto-set when you Browse &amp; select a template)</span>
              </label>
              <input {...register("languageCode")} className="input font-mono" placeholder="en_US" />
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
                {provider !== "msg91" && <th className="tbl-th hidden md:table-cell">Replies</th>}
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
                    {provider !== "msg91" && (
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
                    )}
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
                            onClick={() => setRunTarget({ campaignId: c.id, name: c.name, template: c.template, languageCode: c.languageCode || "en_US" })}
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
