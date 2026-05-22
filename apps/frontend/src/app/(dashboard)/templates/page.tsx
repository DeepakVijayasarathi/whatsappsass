"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FileText, RefreshCw, CheckCircle2, AlertCircle, Clock, Search, X, Eye } from "lucide-react";
import clsx from "clsx";
import type { Template } from "@/components/TemplatePicker";

const statusStyle: Record<string, { badge: string; icon: React.ElementType; label: string }> = {
  APPROVED: { badge: "bg-green-100 text-green-700",  icon: CheckCircle2, label: "Approved" },
  PENDING:  { badge: "bg-yellow-100 text-yellow-700", icon: Clock,         label: "Pending" },
  REJECTED: { badge: "bg-red-100 text-red-600",       icon: AlertCircle,  label: "Rejected" },
  PAUSED:   { badge: "bg-gray-100 text-gray-600",     icon: AlertCircle,  label: "Paused" },
  DISABLED: { badge: "bg-gray-100 text-gray-500",     icon: AlertCircle,  label: "Disabled" },
};

function TemplatePreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const style = statusStyle[template.status] ?? { badge: "bg-gray-100 text-gray-600", icon: AlertCircle, label: template.status };
  const Icon = style.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Template preview</p>
            <code className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{template.name}</code>
          </div>
          <button onClick={onClose} className="icon-btn mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span><span className="font-medium text-gray-700">Category:</span> {template.category}</span>
            <span><span className="font-medium text-gray-700">Language:</span> {template.language}</span>
            <span className={clsx("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", style.badge)}>
              <Icon className="w-3 h-3" />
              {style.label}
            </span>
          </div>
          {/* WhatsApp-style bubble */}
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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get("/templates")
      .then((r) => {
        setTemplates(r.data.templates);
        setProvider(r.data.provider);
      })
      .catch((e) => setError(e.response?.data?.error ?? "Failed to load templates"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const statuses = ["ALL", ...Array.from(new Set(templates.map((t) => t.status)))];

  const filtered = templates.filter((t) => {
    const matchStatus = filterStatus === "ALL" || t.status === filterStatus;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = templates.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {previewTemplate && <TemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />}
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

      {/* Status summary pills */}
      {!loading && !error && templates.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(counts).map(([status, count]) => {
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
                {style.label} ({count})
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
            placeholder="Search by template name..."
          />
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
              : "Create templates in your Meta Business Manager or MSG91 dashboard"}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="px-5 py-3 text-left font-medium text-gray-500">Template name</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Language</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Body preview</th>
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
                    <td className="px-5 py-3.5 text-gray-600 capitalize text-xs">
                      {t.category.toLowerCase()}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{t.language}</td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} of {templates.length} templates
          </div>
        </div>
      )}
    </div>
  );
}
