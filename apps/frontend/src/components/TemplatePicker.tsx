"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { X, Search, CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import clsx from "clsx";

export interface Template {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  body: string | null;
  provider: "meta" | "msg91";
}

interface Props {
  onSelect: (template: Template) => void;
  onClose: () => void;
}

const STATUS_META: Record<string, { badge: string; icon: React.ElementType; label: string }> = {
  APPROVED:  { badge: "bg-green-100 text-green-700",  icon: CheckCircle2, label: "Approved" },
  PENDING:   { badge: "bg-yellow-100 text-yellow-700", icon: Clock,        label: "Pending" },
  REJECTED:  { badge: "bg-red-100 text-red-600",       icon: AlertCircle,  label: "Rejected" },
  PAUSED:    { badge: "bg-gray-100 text-gray-600",     icon: AlertCircle,  label: "Paused" },
  DISABLED:  { badge: "bg-gray-100 text-gray-500",     icon: AlertCircle,  label: "Disabled" },
};

// Module-level cache so the picker doesn't re-fetch on every open during the same session
let _cachedTemplates: Template[] | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default function TemplatePicker({ onSelect, onClose }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "APPROVED">("APPROVED");
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = (force = false) => {
    const now = Date.now();
    if (!force && _cachedTemplates && now - _cacheTs < CACHE_TTL_MS) {
      setTemplates(_cachedTemplates);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.get("/templates")
      .then((r) => {
        const tmpl: Template[] = r.data.templates ?? [];
        _cachedTemplates = tmpl;
        _cacheTs = Date.now();
        setTemplates(tmpl);
        setProvider(r.data.provider ?? "");
      })
      .catch((e) => setError(e.response?.data?.error ?? "Failed to load templates"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTemplates();
    // Focus search input after mount
    setTimeout(() => searchRef.current?.focus(), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = templates.filter((t) => {
    // MSG91 templates use "PENDING" status but are valid — skip status filter for MSG91
    const matchStatus = provider === "msg91" || filterStatus === "ALL" || t.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || (t.body ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Select Template</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choose from your approved WhatsApp templates</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTemplates(true)}
              disabled={loading}
              className="icon-btn"
              title="Refresh templates"
            >
              <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm"
              placeholder="Search by name or body text..."
            />
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
            {(["APPROVED", "ALL"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  filterStatus === s
                    ? "bg-brand text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {s === "ALL" ? "All statuses" : "Approved only"}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading templates...
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="p-4 bg-red-50 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Could not load templates</p>
                  <p className="mt-0.5 text-red-600">{error}</p>
                  <Link
                    href="/settings"
                    onClick={onClose}
                    className="inline-block mt-2 text-xs font-semibold text-red-700 underline hover:text-red-900"
                  >
                    → Open Settings to fix provider credentials
                  </Link>
                </div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-1 px-6 text-center">
              <p>No templates found</p>
              {search && <p className="text-xs">Try a different search term</p>}
              {filterStatus === "APPROVED" && !search && provider === "msg91" && (
                <p className="text-xs mt-2 text-gray-500">
                  Using MSG91? Add your templates in the{" "}
                  <Link href="/templates" onClick={onClose} className="text-brand underline font-medium">Templates page</Link>
                  {" "}first, then come back to send.
                </p>
              )}
              {filterStatus === "APPROVED" && !search && provider !== "msg91" && (
                <p className="text-xs mt-1">
                  <button onClick={() => setFilterStatus("ALL")} className="text-brand underline">Show all statuses</button>
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((t) => {
                const style = STATUS_META[t.status] ?? { badge: "bg-gray-100 text-gray-600", icon: AlertCircle, label: t.status };
                const StatusIcon = style.icon;
                // MSG91 uses "PENDING" for approved templates — treat all MSG91 templates as selectable
                const isApproved = t.status === "APPROVED" || provider === "msg91";
                return (
                  <button
                    key={t.id}
                    onClick={() => isApproved && onSelect(t)}
                    disabled={!isApproved}
                    className={clsx(
                      "w-full text-left px-5 py-4 transition-colors",
                      isApproved ? "hover:bg-brand/5 cursor-pointer" : "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-gray-900 font-mono">{t.name}</span>
                          <span className={clsx("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", style.badge)}>
                            <StatusIcon className="w-3 h-3" />
                            {style.label}
                          </span>
                          <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{t.language}</span>
                          <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full capitalize">{t.category.toLowerCase()}</span>
                        </div>
                        {t.body && (
                          <p className="text-xs text-gray-500 line-clamp-2">{t.body}</p>
                        )}
                      </div>
                      {isApproved && (
                        <span className="text-xs text-brand font-medium shrink-0 self-center">Select →</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
          <span>{!loading && !error && `${filtered.length} of ${templates.length} templates`}</span>
          {!loading && !error && (
            <Link href="/templates" onClick={onClose} className="text-brand hover:underline font-medium">
              {provider === "msg91" ? "Add / manage templates →" : "Manage templates →"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
