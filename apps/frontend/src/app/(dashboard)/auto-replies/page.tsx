"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Bot, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";

interface AutoReply {
  id: string;
  keyword: string;
  matchType: "exact" | "contains" | "starts_with";
  templateName: string;
  languageCode: string;
  isActive: boolean;
  createdAt: string;
}

const MATCH_LABELS: Record<string, string> = {
  exact: "Exact match",
  contains: "Contains",
  starts_with: "Starts with",
};

type MatchType = "exact" | "contains" | "starts_with";
type FormData = { keyword: string; matchType: MatchType; templateName: string; languageCode: string; isActive: boolean };

const defaultForm: FormData = { keyword: "", matchType: "exact", templateName: "", languageCode: "en_US", isActive: true };

function RuleModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<AutoReply>;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>({ ...defaultForm, ...initial });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.keyword.trim() || !form.templateName.trim()) {
      toast.error("Keyword and template are required");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{initial?.id ? "Edit" : "New"} Auto-Reply Rule</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
            <input
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
              className="input"
              placeholder="e.g. YES, INFO, HELLO"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Match type</label>
            <select
              value={form.matchType}
              onChange={(e) => setForm({ ...form, matchType: e.target.value as MatchType })}
              className="input"
            >
              <option value="exact">Exact match</option>
              <option value="contains">Contains</option>
              <option value="starts_with">Starts with</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template name</label>
            <input
              value={form.templateName}
              onChange={(e) => setForm({ ...form, templateName: e.target.value })}
              className="input font-mono"
              placeholder="hello_world"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language code</label>
            <input
              value={form.languageCode}
              onChange={(e) => setForm({ ...form, languageCode: e.target.value })}
              className="input"
              placeholder="en_US"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded accent-brand w-4 h-4"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save rule"}
            </button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AutoRepliesPage() {
  const [rules, setRules] = useState<AutoReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | AutoReply | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/auto-replies")
      .then((r) => setRules(r.data.rules))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: FormData) => {
    try {
      if (modal && modal !== "create") {
        await api.patch(`/auto-replies/${modal.id}`, data);
        toast.success("Rule updated");
      } else {
        await api.post("/auto-replies", data);
        toast.success("Rule created");
      }
      setModal(null);
      load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed");
    }
  };

  const toggleActive = async (rule: AutoReply) => {
    try {
      await api.patch(`/auto-replies/${rule.id}`, { isActive: !rule.isActive });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this auto-reply rule?")) return;
    try {
      await api.delete(`/auto-replies/${id}`);
      toast.success("Deleted");
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div>
      {modal && (
        <RuleModal
          initial={modal !== "create" ? modal : undefined}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Auto-Reply Rules</h1>
          <p className="text-gray-500 text-sm mt-1">
            Automatically send a template when a contact's message matches a keyword
          </p>
        </div>
        <button
          onClick={() => setModal("create")}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New rule</span>
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="space-y-4 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="bg-gray-200 rounded h-5 flex-1" />
                <div className="bg-gray-100 rounded h-5 w-24" />
              </div>
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-16">
            <Bot className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No auto-reply rules yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Create a rule to automatically respond when contacts message you
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider pr-4">Keyword</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider pr-4">Match</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider pr-4">Template</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider pr-4 hidden sm:table-cell">Language</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider pr-4">Status</th>
                  <th className="pb-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-900">{rule.keyword}</td>
                    <td className="py-3 pr-4 text-gray-500">{MATCH_LABELS[rule.matchType]}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-brand">{rule.templateName}</td>
                    <td className="py-3 pr-4 text-gray-400 hidden sm:table-cell">{rule.languageCode}</td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => toggleActive(rule)}
                        className={rule.isActive ? "text-green-500" : "text-gray-300"}
                        title={rule.isActive ? "Active — click to disable" : "Inactive — click to enable"}
                      >
                        {rule.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setModal(rule)}
                          className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => remove(rule.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <p className="font-semibold mb-1">How auto-replies work</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700 text-xs">
          <li>When a contact sends a message matching your keyword, the template is sent automatically</li>
          <li>Rules are checked in order — the first match wins</li>
          <li>Opt-out keywords (STOP, UNSUBSCRIBE, etc.) always take priority over auto-replies</li>
        </ul>
      </div>
    </div>
  );
}
