"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import {
  GitBranch,
  Plus,
  Trash2,
  Play,
  Pause,
  Users,
  X,
  ChevronDown,
  ChevronUp,
  ArrowDown,
} from "lucide-react";
import clsx from "clsx";

interface SequenceStep {
  id: string;
  stepNumber: number;
  templateName: string;
  languageCode: string;
  delayDays: number;
}

interface Sequence {
  id: string;
  name: string;
  status: "draft" | "active" | "paused";
  createdAt: string;
  steps: SequenceStep[];
  _count: { enrollments: number };
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  optIn: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
};

// ── Step form row ──────────────────────────────────────────────────────────────
function StepRow({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: { templateName: string; languageCode: string; delayDays: number };
  index: number;
  total: number;
  onChange: (field: string, value: string | number) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="relative">
      <div className="border border-gray-200 rounded-xl p-4 bg-white hover:border-brand/40 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-gray-700">Step {index + 1}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-0"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-0"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={onRemove}
              disabled={total === 1}
              className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Template name</label>
            <input
              value={step.templateName}
              onChange={(e) => onChange("templateName", e.target.value)}
              className="input font-mono text-sm"
              placeholder="hello_world"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
            <input
              value={step.languageCode}
              onChange={(e) => onChange("languageCode", e.target.value)}
              className="input text-sm"
              placeholder="en_US"
            />
          </div>
          {index > 0 && (
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Send after (days since previous step)
              </label>
              <input
                type="number"
                min={0}
                value={step.delayDays}
                onChange={(e) => onChange("delayDays", Number(e.target.value))}
                className="input text-sm w-32"
              />
            </div>
          )}
        </div>
      </div>
      {index < total - 1 && (
        <div className="flex justify-center my-1">
          <ArrowDown className="w-4 h-4 text-gray-300" />
        </div>
      )}
    </div>
  );
}

// ── Sequence builder modal ─────────────────────────────────────────────────────
function BuilderModal({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState([
    { templateName: "", languageCode: "en_US", delayDays: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const addStep = () =>
    setSteps((prev) => [...prev, { templateName: "", languageCode: "en_US", delayDays: 1 }]);

  const removeStep = (i: number) =>
    setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const updateStep = (i: number, field: string, value: string | number) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Sequence name is required"); return; }
    if (steps.some((s) => !s.templateName.trim())) {
      toast.error("All steps need a template name");
      return;
    }
    setSaving(true);
    try {
      await api.post("/sequences", {
        name: name.trim(),
        steps: steps.map((s, i) => ({ ...s, stepNumber: i + 1 })),
      });
      toast.success("Sequence created");
      onSave();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">New Drip Sequence</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sequence name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g. Onboarding Flow"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Steps</p>
              <button onClick={addStep} className="btn-secondary text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add step
              </button>
            </div>
            <div className="space-y-1">
              {steps.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  index={i}
                  total={steps.length}
                  onChange={(f, v) => updateStep(i, f, v)}
                  onRemove={() => removeStep(i)}
                  onMoveUp={() => moveStep(i, -1)}
                  onMoveDown={() => moveStep(i, 1)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Creating…" : "Create sequence"}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Enroll modal ───────────────────────────────────────────────────────────────
function EnrollModal({
  sequence,
  onClose,
  onDone,
}: {
  sequence: Sequence;
  onClose: () => void;
  onDone: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    api.get("/contacts?limit=500")
      .then((r) => setContacts(r.data.contacts))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleEnroll = async () => {
    if (selected.size === 0) { toast.error("Select at least one contact"); return; }
    setEnrolling(true);
    try {
      const res = await api.post(`/sequences/${sequence.id}/enroll`, {
        contactIds: Array.from(selected),
      });
      toast.success(`Enrolled ${res.data.enrolled} contacts`);
      if (res.data.skipped > 0) toast(`${res.data.skipped} already enrolled`, { icon: "ℹ️" });
      onDone();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"
      );
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Enroll Contacts</h2>
            <p className="text-xs text-gray-400 mt-0.5">{sequence.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input text-sm"
            placeholder="Search contacts…"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  className="rounded accent-brand"
                />
                <span className="text-xs text-gray-500">
                  {selected.size} selected of {filtered.length}
                </span>
              </div>
              {filtered.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="rounded accent-brand shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{c.phone}</p>
                  </div>
                  {!c.optIn && (
                    <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded shrink-0">
                      No opt-in
                    </span>
                  )}
                </label>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={handleEnroll} disabled={enrolling || selected.size === 0} className="btn-primary">
            {enrolling ? "Enrolling…" : `Enroll ${selected.size} contact${selected.size !== 1 ? "s" : ""}`}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [enrolling, setEnrolling] = useState<Sequence | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    api.get("/sequences")
      .then((r) => setSequences(r.data.sequences))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const setStatus = async (seq: Sequence, status: "active" | "paused" | "draft") => {
    try {
      await api.patch(`/sequences/${seq.id}`, { status });
      setSequences((prev) => prev.map((s) => s.id === seq.id ? { ...s, status } : s));
      toast.success(`Sequence ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this sequence and all enrollments?")) return;
    try {
      await api.delete(`/sequences/${id}`);
      toast.success("Deleted");
      setSequences((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div>
      {showBuilder && (
        <BuilderModal
          onSave={() => { setShowBuilder(false); load(); }}
          onClose={() => setShowBuilder(false)}
        />
      )}
      {enrolling && (
        <EnrollModal
          sequence={enrolling}
          onClose={() => setEnrolling(null)}
          onDone={() => { setEnrolling(null); load(); }}
        />
      )}

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Drip Sequences</h1>
          <p className="text-gray-500 text-sm mt-1">
            Automate multi-step WhatsApp template campaigns over time
          </p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New sequence</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <div className="card text-center py-16">
          <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No sequences yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Build a drip sequence to automatically send follow-up messages over days
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sequences.map((seq) => {
            const isExpanded = expanded.has(seq.id);
            return (
              <div key={seq.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{seq.name}</h3>
                      <span className={clsx("badge text-xs", STATUS_BADGE[seq.status])}>
                        {seq.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      <span>{seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {seq._count.enrollments} enrolled
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {seq.status !== "active" && (
                      <button
                        onClick={() => setStatus(seq, "active")}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Activate"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {seq.status === "active" && (
                      <button
                        onClick={() => setStatus(seq, "paused")}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Pause"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setEnrolling(seq)}
                      disabled={seq.status !== "active"}
                      className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={seq.status !== "active" ? "Activate sequence to enroll" : "Enroll contacts"}
                    >
                      <Users className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleExpand(seq.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={isExpanded ? "Collapse" : "Show steps"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => remove(seq.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && seq.steps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Steps</p>
                    <div className="space-y-2">
                      {seq.steps.map((step, i) => (
                        <div key={step.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">
                              {step.stepNumber}
                            </div>
                            {i < seq.steps.length - 1 && (
                              <div className="w-px h-6 bg-gray-200 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="text-sm font-medium text-gray-900 font-mono">{step.templateName}</p>
                            <p className="text-xs text-gray-400">
                              {step.languageCode}
                              {step.delayDays > 0 && ` · +${step.delayDays} day${step.delayDays !== 1 ? "s" : ""}`}
                              {step.delayDays === 0 && i > 0 && " · immediate"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <p className="font-semibold mb-1">How drip sequences work</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
          <li>Activate a sequence, then enroll contacts into it</li>
          <li>The scheduler sends each step after the configured delay</li>
          <li>Contacts only receive opted-in sends — opt-outs are respected automatically</li>
          <li>Each contact can only be enrolled once per sequence</li>
        </ul>
      </div>
    </div>
  );
}
