"use client";

import { useEffect, useState } from "react";
import { api, getErrMsg } from "@/lib/api";
import {
  FileText, RefreshCw, CheckCircle2, AlertCircle, Clock, Search,
  X, Eye, Plus, Trash2, ChevronDown, ChevronUp, Info, Link2, Image, Phone,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ConfirmModal from "@/components/ConfirmModal";
import type { Template } from "@/components/TemplatePicker";

const statusStyle: Record<string, { badge: string; icon: React.ElementType; label: string }> = {
  APPROVED: { badge: "bg-green-100 text-green-700",  icon: CheckCircle2, label: "Approved" },
  PENDING:  { badge: "bg-yellow-100 text-yellow-700", icon: Clock,        label: "Pending" },
  REJECTED: { badge: "bg-red-100 text-red-600",       icon: AlertCircle,  label: "Rejected" },
  PAUSED:   { badge: "bg-gray-100 text-gray-600",     icon: AlertCircle,  label: "Paused" },
  DISABLED: { badge: "bg-gray-100 text-gray-500",     icon: AlertCircle,  label: "Disabled" },
};

const COMMON_LANGUAGES = [
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "hi",    label: "Hindi" },
  { code: "es",    label: "Spanish" },
  { code: "fr",    label: "French" },
  { code: "ar",    label: "Arabic" },
  { code: "pt_BR", label: "Portuguese (BR)" },
  { code: "de",    label: "German" },
  { code: "id",    label: "Indonesian" },
  { code: "it",    label: "Italian" },
  { code: "ja",    label: "Japanese" },
  { code: "ko",    label: "Korean" },
  { code: "nl",    label: "Dutch" },
  { code: "ru",    label: "Russian" },
  { code: "tr",    label: "Turkish" },
  { code: "zh_CN", label: "Chinese (Simplified)" },
];

const createSchema = z.object({
  name: z
    .string()
    .min(1, "Name required")
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, digits and underscores only (e.g. hello_world)"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"], { required_error: "Category required" }),
  language: z.string().min(1, "Language required"),
  body: z.string().min(1, "Body text required").max(1024, "Max 1024 characters"),
  footer: z.string().max(60, "Max 60 characters").optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function TemplatePreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const style = statusStyle[template.status] ?? { badge: "bg-gray-100 text-gray-600", icon: AlertCircle, label: template.status };
  const Icon = style.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Template preview</p>
            <code className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{template.name}</code>
          </div>
          <button onClick={onClose} className="icon-btn mt-0.5"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span><span className="font-medium text-gray-700">Category:</span> {template.category}</span>
            <span><span className="font-medium text-gray-700">Language:</span> {template.language}</span>
            <span className={clsx("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", style.badge)}>
              <Icon className="w-3 h-3" />{style.label}
            </span>
          </div>
          <div className="bg-[#e5ddd5] rounded-xl p-4">
            <div className="bg-white rounded-xl rounded-tl-none px-4 py-3 shadow-sm max-w-[90%]">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {template.body ?? <span className="italic text-gray-400">No body text</span>}
              </p>
              <p className="text-[10px] text-gray-400 text-right mt-1.5">WhatsApp template</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type BtnType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
type BtnDraft = { type: BtnType; text: string; url?: string; phone_number?: string };

function CreateTemplatePanel({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  // Header state (not in RHF — complex nested type)
  const [headerFormat, setHeaderFormat] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT">("NONE");
  const [headerText, setHeaderText] = useState("");
  // Buttons state
  const [buttons, setButtons] = useState<BtnDraft[]>([]);

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { language: "en_US", category: "UTILITY" },
  });

  const bodyVal = watch("body") ?? "";

  const addButton = (type: BtnType) => {
    if (buttons.length >= 3) { toast.error("Max 3 buttons per template"); return; }
    setButtons((prev) => [...prev, { type, text: "", url: type === "URL" ? "https://" : undefined, phone_number: type === "PHONE_NUMBER" ? "+" : undefined }]);
  };
  const removeButton = (i: number) => setButtons((prev) => prev.filter((_, idx) => idx !== i));
  const updateButton = (i: number, patch: Partial<BtnDraft>) => setButtons((prev) => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b));

  const onSubmit = async (data: CreateForm) => {
    // Validate buttons
    for (const btn of buttons) {
      if (!btn.text.trim()) { toast.error("Fill in all button labels"); return; }
      if (btn.type === "URL" && !btn.url?.startsWith("http")) { toast.error("URL buttons need a valid URL starting with http"); return; }
      if (btn.type === "PHONE_NUMBER" && (btn.phone_number?.length ?? 0) < 7) { toast.error("Phone number too short"); return; }
    }
    const payload = {
      ...data,
      ...(headerFormat !== "NONE" ? { header: { format: headerFormat, text: headerFormat === "TEXT" ? headerText : undefined } } : {}),
      ...(buttons.length > 0 ? { buttons } : {}),
    };
    try {
      const res = await api.post("/templates", payload);
      toast.success(res.data.message ?? "Template submitted for review");
      reset();
      setHeaderFormat("NONE"); setHeaderText(""); setButtons([]);
      setOpen(false);
      onCreated();
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Failed to create template"));
    }
  };

  const previewText = bodyVal.replace(/\{\{(\d+)\}\}/g, (_, n) => `[Variable ${n}]`);

  return (
    <div className="card mb-6">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4 text-brand" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">Create New Template</p>
            <p className="text-xs text-gray-400">Submit a new template to Meta for review (Meta provider only)</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 pt-5 border-t border-gray-100">
          {/* Info banner */}
          <div className="flex items-start gap-2 mb-5 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Templates are submitted to Meta for review — typically approved in minutes to 24h. Use <code className="bg-blue-100 px-1 rounded">{"{{1}}"}</code> <code className="bg-blue-100 px-1 rounded">{"{{2}}"}</code> for dynamic variables.</p>
          </div>

          {/* Name / Category / Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template name</label>
              <input {...register("name")} className="input font-mono text-sm" placeholder="hello_world" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              <p className="text-gray-400 text-xs mt-1">Lowercase, digits, underscores only</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select {...register("category")} className="input text-sm">
                <option value="UTILITY">Utility</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select {...register("language")} className="input text-sm">
                {COMMON_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              {errors.language && <p className="text-red-500 text-xs mt-1">{errors.language.message}</p>}
            </div>
          </div>

          {/* ── Header builder ────────────────────────────────────────────── */}
          <div className="mb-4 p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">Header <span className="font-normal text-gray-400 ml-1">(optional)</span></p>
              <div className="flex gap-1">
                {(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setHeaderFormat(f)}
                    className={clsx("px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors", headerFormat === f ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                    {f === "NONE" ? "None" : f.charAt(0) + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            {headerFormat === "TEXT" && (
              <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} className="input text-sm" placeholder="Header text (max 60 chars)" maxLength={60} />
            )}
            {(headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT") && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                {headerFormat === "IMAGE" && <Image className="w-4 h-4" />}
                {headerFormat === "VIDEO" && <FileText className="w-4 h-4" />}
                {headerFormat === "DOCUMENT" && <FileText className="w-4 h-4" />}
                <span>The user sending the message will need to provide the media file. Meta will accept this template with a media header placeholder.</span>
              </div>
            )}
          </div>

          {/* Body + Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Body text <span className="text-gray-400 font-normal">({bodyVal.length}/1024)</span>
              </label>
              <textarea {...register("body")} rows={5} className="input text-sm resize-none"
                placeholder={"Hello {{1}},\n\nYour order {{2}} has been confirmed."} />
              {errors.body && <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>}
            </div>
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">Preview</p>
              <div className="bg-[#e5ddd5] rounded-xl p-3 h-[132px] overflow-y-auto">
                {headerFormat === "TEXT" && headerText && (
                  <p className="text-xs font-bold text-gray-700 mb-1 px-1">{headerText}</p>
                )}
                {(headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT") && (
                  <div className="bg-gray-200 rounded-lg mb-1 h-10 flex items-center justify-center text-[10px] text-gray-500">
                    [{headerFormat.toLowerCase()}]
                  </div>
                )}
                <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 shadow-sm">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {previewText || <span className="italic text-gray-400">Enter body text to preview</span>}
                  </p>
                  {buttons.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                      {buttons.map((b, i) => (
                        <div key={i} className="text-[11px] text-center text-brand font-semibold py-0.5 border border-brand/30 rounded-lg">{b.text || `Button ${i+1}`}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mb-4 max-w-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer <span className="text-gray-400 font-normal">(optional, max 60 chars)</span></label>
            <input {...register("footer")} className="input text-sm" placeholder="Reply STOP to unsubscribe" />
            {errors.footer && <p className="text-red-500 text-xs mt-1">{errors.footer.message}</p>}
          </div>

          {/* ── Button builder ────────────────────────────────────────────── */}
          <div className="mb-5 p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">Buttons <span className="font-normal text-gray-400 ml-1">(optional, max 3)</span></p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => addButton("QUICK_REPLY")} disabled={buttons.length >= 3}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-40 transition-colors">
                  <Plus className="w-3 h-3" /> Quick Reply
                </button>
                <button type="button" onClick={() => addButton("URL")} disabled={buttons.length >= 3}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-colors">
                  <Link2 className="w-3 h-3" /> URL
                </button>
                <button type="button" onClick={() => addButton("PHONE_NUMBER")} disabled={buttons.length >= 3}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-40 transition-colors">
                  <Phone className="w-3 h-3" /> Phone
                </button>
              </div>
            </div>
            {buttons.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No buttons added. Use the buttons above to add quick reply, URL, or phone number buttons.</p>
            ) : (
              <div className="space-y-2">
                {buttons.map((btn, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 mt-1",
                      btn.type === "QUICK_REPLY" ? "bg-purple-100 text-purple-700" :
                      btn.type === "URL" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    )}>
                      {btn.type === "QUICK_REPLY" ? "Reply" : btn.type === "URL" ? "URL" : "Phone"}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <input value={btn.text} onChange={(e) => updateButton(i, { text: e.target.value })}
                        className="input text-xs h-7 py-1" placeholder="Button label (max 25 chars)" maxLength={25} />
                      {btn.type === "URL" && (
                        <input value={btn.url ?? ""} onChange={(e) => updateButton(i, { url: e.target.value })}
                          className="input text-xs h-7 py-1 font-mono" placeholder="https://example.com" />
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <input value={btn.phone_number ?? ""} onChange={(e) => updateButton(i, { phone_number: e.target.value })}
                          className="input text-xs h-7 py-1 font-mono" placeholder="+1234567890" />
                      )}
                    </div>
                    <button type="button" onClick={() => removeButton(i)} className="p-1 text-gray-300 hover:text-red-500 rounded-lg transition-colors shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </button>
            <button type="button" onClick={() => { setOpen(false); reset(); setHeaderFormat("NONE"); setHeaderText(""); setButtons([]); }} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get("/templates")
      .then((r) => {
        setTemplates(r.data.templates);
        setProvider(r.data.provider ?? "");
      })
      .catch((e) => setError(e.response?.data?.error ?? "Failed to load templates"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deleteTemplate = async (t: Template) => {
    setDeleting(true);
    try {
      await api.delete(`/templates/${encodeURIComponent(t.name)}`);
      toast.success(`Template "${t.name}" deleted`);
      setConfirmDelete(null);
      load();
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Failed to delete template"));
    } finally {
      setDeleting(false);
    }
  };

  const statuses = ["ALL", ...Array.from(new Set(templates.map((t) => t.status)))];

  const filtered = templates.filter((t) => {
    const matchStatus = filterStatus === "ALL" || t.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      (t.body ?? "").toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts = templates.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const isMetaProvider = provider === "meta";

  return (
    <div>
      {previewTemplate && (
        <TemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete template "${confirmDelete.name}"?`}
          message="This will permanently delete the template from your Meta account. Campaigns using this template will fail. This cannot be undone."
          confirmLabel="Delete template"
          onConfirm={() => deleteTemplate(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      )}

      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-500 text-sm mt-1">
            {provider ? `Fetched from ${provider.toUpperCase()}` : "WhatsApp message templates"}
            {!loading && !error && ` · ${templates.length} templates`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Template creation panel (Meta only) */}
      {!loading && !error && isMetaProvider && (
        <CreateTemplatePanel onCreated={load} />
      )}

      {/* Status summary pills */}
      {!loading && !error && templates.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {statuses.map((status) => {
            if (status === "ALL") {
              return (
                <button
                  key="ALL"
                  onClick={() => setFilterStatus("ALL")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    filterStatus === "ALL"
                      ? "border-brand bg-brand/10 text-brand"
                      : "bg-gray-100 text-gray-600 border-transparent hover:opacity-80"
                  )}
                >
                  All ({templates.length})
                </button>
              );
            }
            const style = statusStyle[status] ?? { badge: "bg-gray-100 text-gray-600", icon: AlertCircle, label: status };
            const Icon = style.icon;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "ALL" : status)}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                  filterStatus === status
                    ? "border-brand bg-brand/10 text-brand"
                    : `${style.badge} border-transparent hover:opacity-80`
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {style.label} ({counts[status] ?? 0})
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      {!loading && !error && templates.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Search by name, body or category..."
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading templates...
        </div>
      ) : error ? (
        <div className="card p-6">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Could not fetch templates</p>
              <p className="mt-1 text-red-600">{error}</p>
              <p className="mt-2 text-xs text-red-500">
                Make sure your WABA ID and Access Token are configured in Settings → WhatsApp Provider.
              </p>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-20">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search || filterStatus !== "ALL" ? "No templates match your filters" : "No templates found"}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {search || filterStatus !== "ALL"
              ? "Try clearing the search or changing the status filter"
              : "Create a template above (Meta) or via your MSG91 dashboard"}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="px-5 py-3 text-left font-medium text-gray-500">Template name</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Category</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Language</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Body preview</th>
                {isMetaProvider && <th className="px-5 py-3 text-right font-medium text-gray-500" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((t) => {
                const style = statusStyle[t.status] ?? { badge: "bg-gray-100 text-gray-600", icon: AlertCircle, label: t.status };
                const Icon = style.icon;
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5">
                      <code className="text-xs font-semibold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">
                        {t.name}
                      </code>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 capitalize text-xs hidden sm:table-cell">
                      {t.category.toLowerCase()}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs hidden md:table-cell">{t.language}</td>
                    <td className="px-5 py-3.5">
                      <span className={clsx("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", style.badge)}>
                        <Icon className="w-3 h-3" />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <button
                        onClick={() => setPreviewTemplate(t)}
                        className="flex items-center gap-1.5 text-left group w-full"
                        title="Preview template"
                      >
                        <p className="text-xs text-gray-500 truncate flex-1 group-hover:text-gray-700 transition-colors">
                          {t.body ?? <span className="italic text-gray-300">No body text</span>}
                        </p>
                        {t.body && <Eye className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand transition-colors shrink-0" />}
                      </button>
                    </td>
                    {isMetaProvider && (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setConfirmDelete(t)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} of {templates.length} templates shown
          </div>
        </div>
      )}
    </div>
  );
}
