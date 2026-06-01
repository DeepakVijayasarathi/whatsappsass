"use client";

import { useEffect, useState } from "react";
import { api, getErrMsg } from "@/lib/api";
import { Layers, Plus, Pencil, Trash2, X, Users } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmModal from "@/components/ConfirmModal";

interface SegmentFilter {
  tag?: string;
  leadStatus?: string;
  optIn?: boolean;
  search?: string;
}

interface Segment {
  id: string;
  name: string;
  filter: SegmentFilter;
  count: number;
  createdAt: string;
}

const LEAD_STATUSES = ["new", "prospect", "qualified", "customer", "churned"];

type FormState = { name: string; tag: string; leadStatus: string; optIn: "" | "true" | "false"; search: string };

const emptyForm: FormState = { name: "", tag: "", leadStatus: "", optIn: "", search: "" };

function toFilter(f: FormState): SegmentFilter {
  return {
    ...(f.tag.trim() ? { tag: f.tag.trim() } : {}),
    ...(f.leadStatus ? { leadStatus: f.leadStatus } : {}),
    ...(f.optIn === "true" ? { optIn: true } : f.optIn === "false" ? { optIn: false } : {}),
    ...(f.search.trim() ? { search: f.search.trim() } : {}),
  };
}

function SegmentModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Segment;
  onSave: (name: string, filter: SegmentFilter) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          name: initial.name,
          tag: initial.filter.tag ?? "",
          leadStatus: initial.filter.leadStatus ?? "",
          optIn: initial.filter.optIn === true ? "true" : initial.filter.optIn === false ? "false" : "",
          search: initial.filter.search ?? "",
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Segment name is required"); return; }
    setSaving(true);
    try {
      await onSave(form.name.trim(), toFilter(form));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{initial ? "Edit segment" : "New segment"}</h2>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder="e.g. VIP customers"
            />
          </div>

          <p className="text-xs text-gray-500 pt-1">Filters (all are combined — a contact must match every one set):</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
            <input
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              className="input w-full"
              placeholder="Any tag (leave blank for all)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead status</label>
              <select value={form.leadStatus} onChange={(e) => setForm({ ...form, leadStatus: e.target.value })} className="input w-full">
                <option value="">Any</option>
                {LEAD_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opt-in</label>
              <select value={form.optIn} onChange={(e) => setForm({ ...form, optIn: e.target.value as FormState["optIn"] })} className="input w-full">
                <option value="">Any</option>
                <option value="true">Opted in</option>
                <option value="false">Opted out</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search (name / phone / email)</label>
            <input
              value={form.search}
              onChange={(e) => setForm({ ...form, search: e.target.value })}
              className="input w-full"
              placeholder="Optional text match"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? "Saving..." : "Save segment"}</button>
        </div>
      </div>
    </div>
  );
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<"create" | Segment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Segment | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    api.get("/contacts/segments")
      .then((r) => setSegments(r.data.segments ?? []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async (name: string, filter: SegmentFilter) => {
    try {
      if (modal && modal !== "create") {
        await api.patch(`/contacts/segments/${modal.id}`, { name, filter });
        toast.success("Segment updated");
      } else {
        await api.post("/contacts/segments", { name, filter });
        toast.success("Segment created");
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(getErrMsg(err, "Failed to save segment"));
    }
  };

  const remove = async (seg: Segment) => {
    setConfirmDelete(null);
    try {
      await api.delete(`/contacts/segments/${seg.id}`);
      toast.success("Segment deleted");
      load();
    } catch (err) {
      toast.error(getErrMsg(err, "Failed to delete segment"));
    }
  };

  const describe = (f: SegmentFilter): string => {
    const parts: string[] = [];
    if (f.tag) parts.push(`tag: ${f.tag}`);
    if (f.leadStatus) parts.push(`status: ${f.leadStatus}`);
    if (f.optIn === true) parts.push("opted in");
    if (f.optIn === false) parts.push("opted out");
    if (f.search) parts.push(`"${f.search}"`);
    return parts.length ? parts.join(" · ") : "All contacts";
  };

  return (
    <div>
      {modal && (
        <SegmentModal
          initial={modal !== "create" ? modal : undefined}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete segment?"
          message={`"${confirmDelete.name}" will be removed. Contacts are not affected.`}
          confirmLabel="Delete segment"
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="page-title">Segments</h1>
          <p className="page-subtitle">
            {segments.length > 0
              ? `${segments.length} saved audience${segments.length !== 1 ? "s" : ""}`
              : "Save reusable contact filters to target campaigns quickly"}
          </p>
        </div>
        <button onClick={() => setModal("create")} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New segment</span>
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm mb-3">Failed to load segments.</p>
          <button onClick={load} className="btn-secondary text-sm">Retry</button>
        </div>
      ) : segments.length === 0 ? (
        <div className="text-center py-16">
          <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No segments yet. Create one to reuse it across campaigns.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => (
            <div key={seg.id} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900">{seg.name}</h3>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setModal(seg)} aria-label="Edit" className="text-gray-400 hover:text-brand p-1">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(seg)} aria-label="Delete" className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex-1">{describe(seg.filter)}</p>
              <div className="flex items-center gap-1.5 text-sm text-gray-700 mt-3 pt-3 border-t border-gray-50">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{seg.count}</span>
                <span className="text-gray-500">contact{seg.count === 1 ? "" : "s"} match now</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
