"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrMsg } from "@/lib/api";
import { Bot, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Search, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmModal from "@/components/ConfirmModal";
import TemplatePicker, { type Template } from "@/components/TemplatePicker";

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

const MATCH_BADGE: Record<string, string> = {
  exact:       "bg-blue-50 text-blue-700",
  contains:    "bg-purple-50 text-purple-700",
  starts_with: "bg-cyan-50 text-cyan-700",
};

type MatchType = "exact" | "contains" | "starts_with";
type RuleFormData = { keyword: string; matchType: MatchType; templateName: string; languageCode: string; isActive: boolean };

const defaultForm: RuleFormData = { keyword: "", matchType: "exact", templateName: "", languageCode: "en_US", isActive: true };

function RuleModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<AutoReply>;
  onSave: (data: RuleFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RuleFormData>({ ...defaultForm, ...initial });
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const onPickTemplate = (t: Template) => {
    setForm((f) => ({ ...f, templateName: t.name, languageCode: t.language }));
    setShowPicker(false);
  };

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
    <>
    {showPicker && <TemplatePicker onSelect={onPickTemplate} onClose={() => setShowPicker(false)} />}
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{initial?.id ? "Edit" : "New"} Auto-Reply Rule</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keywords <span className="font-normal text-gray-400">(comma-separated for OR matching)</span>
            </label>
            <input
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
              className="input"
              placeholder="e.g. YES, OK, CONFIRM"
              autoFocus
            />
            {/* Show keyword chips */}
            {form.keyword && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.keyword.split(",").map((kw) => kw.trim()).filter(Boolean).map((kw, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-brand/10 text-brand text-xs font-semibold px-2 py-0.5 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Any keyword in the list triggers this rule. Separate multiple keywords with commas.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Match type</label>
            <select
              value={form.matchType}
              onChange={(e) => setForm({ ...form, matchType: e.target.value as MatchType })}
              className="input"
            >
              <option value="exact">Exact match — full message must equal keyword</option>
              <option value="contains">Contains — message contains keyword anywhere</option>
              <option value="starts_with">Starts with — message begins with keyword</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template name</label>
            <div className="flex gap-2">
              <input
                value={form.templateName}
                onChange={(e) => setForm({ ...form, templateName: e.target.value })}
                className="input font-mono flex-1"
                placeholder="hello_world"
              />
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-brand border border-brand/30 rounded-xl hover:bg-brand/5 transition-colors shrink-0"
                title="Browse templates"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Enter the exact template name. MSG91 users: add templates in the <a href="/templates" className="text-brand underline">Templates page</a> first.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language code</label>
              <select
                value={form.languageCode}
                onChange={(e) => setForm({ ...form, languageCode: e.target.value })}
                className="input"
              >
                <option value="en_US">en_US</option>
                <option value="en">en</option>
                <option value="hi">hi</option>
                <option value="es">es</option>
                <option value="pt_BR">pt_BR</option>
                <option value="ar">ar</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded accent-brand w-4 h-4"
                />
                <span className="text-sm text-gray-700 font-medium">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save rule"}
            </button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default function AutoRepliesPage() {
  const [rules, setRules] = useState<AutoReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | AutoReply | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AutoReply | null>(null);
  const [provider, setProvider] = useState<string>("");

  const load = () => {
    setLoading(true);
    api.get("/workspace/provider").then((r) => setProvider(r.data.whatsappProvider ?? "")).catch(() => {});
    api.get("/auto-replies")
      .then((r) => setRules(r.data.rules))
      .catch(() => { /* toast shown by interceptor */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: RuleFormData) => {
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
      toast.error(getErrMsg(err, "Failed"));
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

  const remove = async (rule: AutoReply) => {
    try {
      await api.delete(`/auto-replies/${rule.id}`);
      toast.success("Deleted");
      setConfirmDelete(null);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch {
      toast.error("Failed to delete");
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rules;
    const q = search.toLowerCase();
    return rules.filter(
      (r) =>
        r.keyword.toLowerCase().includes(q) ||
        r.templateName.toLowerCase().includes(q)
    );
  }, [rules, search]);

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div>
      {modal && (
        <RuleModal
          initial={modal !== "create" ? modal : undefined}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete auto-reply rule?"
          message={`The rule for keyword "${confirmDelete.keyword}" will be permanently removed.`}
          confirmLabel="Delete rule"
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {provider === "msg91" && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-3">
          <span className="text-lg shrink-0">⚠</span>
          <div>
            <p className="font-semibold">Auto-replies require inbound messages</p>
            <p className="text-xs mt-1 text-amber-700">MSG91 basic plan does not support receiving inbound messages — auto-reply rules will not trigger. Upgrade to the MSG91 Hello plan to enable inbound messages.</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="page-title">Auto-Reply Rules</h1>
          <p className="page-subtitle">
            {rules.length > 0
              ? `${rules.length} rule${rules.length !== 1 ? "s" : ""} · ${activeCount} active`
              : "Automatically send a template when a contact's message matches a keyword"}
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

      {/* Search bar */}
      {rules.length > 0 && (
        <div className="relative mb-4 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm"
            placeholder="Search keywords or templates…"
          />
        </div>
      )}

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
          <div className="empty-state">
            <Bot className="empty-icon" />
            <p className="empty-title">No auto-reply rules yet</p>
            <p className="empty-desc">Create a rule to automatically respond when contacts message you</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No rules match &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tbl-head">
                  <th className="tbl-th w-6 text-center">#</th>
                  <th className="tbl-th">Keyword</th>
                  <th className="tbl-th hidden sm:table-cell">Match</th>
                  <th className="tbl-th">Template</th>
                  <th className="tbl-th hidden sm:table-cell">Language</th>
                  <th className="tbl-th">Status</th>
                  <th className="tbl-th w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((rule, idx) => (
                  <tr key={rule.id} className="tbl-row group">
                    <td className="tbl-td text-center text-xs text-gray-300 font-mono">{idx + 1}</td>
                    <td className="tbl-td">
                      <div className="flex flex-wrap gap-1">
                        {rule.keyword.split(",").map((kw) => kw.trim()).filter(Boolean).map((kw, i) => (
                          <span key={i} className="inline-block bg-brand/10 text-brand text-[11px] font-semibold px-1.5 py-0.5 rounded-full max-w-[120px] truncate">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="tbl-td hidden sm:table-cell">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${MATCH_BADGE[rule.matchType] ?? "bg-gray-100 text-gray-600"}`}>
                        {MATCH_LABELS[rule.matchType]}
                      </span>
                    </td>
                    <td className="tbl-td font-mono text-xs text-brand">{rule.templateName}</td>
                    <td className="tbl-td text-gray-400 hidden sm:table-cell">{rule.languageCode}</td>
                    <td className="tbl-td">
                      <button
                        onClick={() => toggleActive(rule)}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${rule.isActive ? "text-green-600" : "text-gray-400 hover:text-gray-600"}`}
                        title={rule.isActive ? "Active — click to disable" : "Inactive — click to enable"}
                      >
                        {rule.isActive
                          ? <ToggleRight className="w-5 h-5" />
                          : <ToggleLeft className="w-5 h-5" />}
                        <span className="hidden sm:inline">{rule.isActive ? "Active" : "Off"}</span>
                      </button>
                    </td>
                    <td className="tbl-td">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setModal(rule)}
                          className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Edit rule"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(rule)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete rule"
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
          <li>Rules are checked in order — the first match wins (use the # column to understand priority)</li>
          <li>Opt-out keywords (STOP, UNSUBSCRIBE, etc.) always take priority over auto-replies</li>
        </ul>
      </div>
    </div>
  );
}
