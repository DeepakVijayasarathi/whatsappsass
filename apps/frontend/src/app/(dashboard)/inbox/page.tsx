"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api, getErrMsg } from "@/lib/api";
import {
  Bot, CheckCheck, ChevronLeft, ExternalLink, MessageSquare,
  Search, Send, Plus, Trash2, X, Pencil, Zap,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import Link from "next/link";
import TemplatePicker, { type Template } from "@/components/TemplatePicker";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Conversation {
  fromPhone: string;
  contactId: string | null;
  contact: { id: string; name: string; phone: string } | null;
  latestMessage: { id: string; body: string | null; type: string; receivedAt: string; read: boolean };
  unreadCount: number;
}

type TimelineEntry =
  | { type: "sent";     id: string; status: string; campaign: { id: string; name: string } | null; createdAt: string }
  | { type: "received"; id: string; body: string | null; msgType: string; replyToMessageId: string | null; createdAt: string };

interface CannedResponse { id: string; title: string; body: string; shortcut: string | null }

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700", "bg-cyan-100 text-cyan-700", "bg-amber-100 text-amber-700",
];
function nameToColor(name: string) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]; }
function avatarChar(name: string): string { return name?.trim()?.[0]?.toUpperCase() ?? "?"; }
function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Canned Response Manager ───────────────────────────────────────────────────
function CannedManager({ onClose }: { onClose: () => void }) {
  const [list, setList]         = useState<CannedResponse[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState<{ title: string; body: string; shortcut: string } | null>(null);
  const [editing, setEditing]   = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/canned-responses")
      .then((r) => setList(r.data.responses))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    if (!form?.title.trim() || !form.body.trim()) { toast.error("Title and body required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/canned-responses/${editing}`, form);
      } else {
        await api.post("/canned-responses", form);
      }
      toast.success(editing ? "Updated" : "Created");
      setForm(null); setEditing(null); load();
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Failed to save"));
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    try { await api.delete(`/canned-responses/${id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Canned Responses</h2>
          <button onClick={onClose} className="icon-btn"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="text-gray-400 text-sm text-center py-6">Loading…</div>
          ) : list.length === 0 && !form ? (
            <p className="text-sm text-gray-400 text-center py-6">No canned responses yet. Create one to speed up replies.</p>
          ) : (
            list.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                    {r.shortcut && <code className="text-[11px] bg-gray-100 px-1 rounded text-gray-500">{r.shortcut}</code>}
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.body}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditing(r.id); setForm({ title: r.title, body: r.body, shortcut: r.shortcut ?? "" }); }} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))
          )}

          {form && (
            <div className="border-2 border-brand/20 rounded-xl p-4 bg-brand/5 space-y-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm" placeholder="Title (e.g. Thank you)" autoFocus />
              <input value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} className="input text-sm font-mono" placeholder="Shortcut (e.g. /thanks) — optional" />
              <textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="input text-sm resize-none" placeholder="Response text…" />
              <div className="flex gap-2">
                <button onClick={save} disabled={saving} className="btn-primary text-sm flex-1">{saving ? "Saving…" : editing ? "Update" : "Create"}</button>
                <button onClick={() => { setForm(null); setEditing(null); }} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
        {!form && (
          <div className="p-4 border-t border-gray-100">
            <button onClick={() => setForm({ title: "", body: "", shortcut: "" })} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> New Canned Response
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [selected,       setSelected]       = useState<Conversation | null>(null);
  const [timeline,       setTimeline]       = useState<TimelineEntry[]>([]);
  const [loadingConvos,  setLoadingConvos]  = useState(true);
  const [loadingThread,  setLoadingThread]  = useState(false);
  const [search,         setSearch]         = useState("");
  const [unreadOnly,     setUnreadOnly]     = useState(false);
  const [replyTemplate,  setReplyTemplate]  = useState("");
  const [replyLang,      setReplyLang]      = useState("en_US");
  const [replyPreview,   setReplyPreview]   = useState<string | null>(null);
  const [replying,       setReplying]       = useState(false);
  const [showPicker,     setShowPicker]     = useState(false);
  const [showCannedMgr,  setShowCannedMgr]  = useState(false);
  const [cannedList,     setCannedList]     = useState<CannedResponse[]>([]);
  const [cannedSearch,   setCannedSearch]   = useState("");
  const [showCannedPick, setShowCannedPick] = useState(false);
  const [sseConnected,   setSseConnected]   = useState(false);

  const threadRef     = useRef<HTMLDivElement>(null);
  const scrollTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRef        = useRef<EventSource | null>(null);
  const selectedRef   = useRef<Conversation | null>(null);
  selectedRef.current = selected;

  useEffect(() => () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); }, []);

  // ── Load conversations ───────────────────────────────────────────────────
  const loadConversations = useCallback((silent = false) => {
    if (!silent) setLoadingConvos(true);
    api.get("/whatsapp/conversations?limit=100")
      .then((r) => setConversations(r.data.conversations))
      .catch(() => {})
      .finally(() => { if (!silent) setLoadingConvos(false); });
  }, []);

  // ── SSE real-time updates ────────────────────────────────────────────────
  useEffect(() => {
    loadConversations();
    loadCannedResponses();

    // Connect to SSE stream via the Next.js API proxy
    const es = new EventSource("/api/whatsapp/inbox/stream");
    sseRef.current = es;

    es.addEventListener("connected", () => setSseConnected(true));
    es.addEventListener("new_message", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { count: number; totalUnread: number };
      // Reload conversations silently to pick up the new message
      loadConversations(true);
      // If a conversation is open, also reload the thread
      if (selectedRef.current?.contactId) {
        openConversationThread(selectedRef.current, true);
      }
      // Show notification badge (totalUnread via document title)
      if (data.totalUnread > 0) {
        document.title = `(${data.totalUnread}) Inbox — WhatsApp SaaS`;
      }
    });

    es.onerror = () => {
      setSseConnected(false);
      // SSE will auto-reconnect; if it keeps failing, fall back to 30s polling
    };

    // Fallback polling every 30s (in case SSE is blocked by a proxy)
    const pollId = setInterval(() => loadConversations(true), 30_000);

    return () => {
      es.close(); sseRef.current = null;
      clearInterval(pollId);
      document.title = "Inbox — WhatsApp SaaS";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCannedResponses = () => {
    api.get("/canned-responses").then((r) => setCannedList(r.data.responses ?? [])).catch(() => {});
  };

  // ── Open conversation thread ─────────────────────────────────────────────
  const openConversationThread = async (convo: Conversation, silent = false) => {
    if (!silent) { setSelected(convo); setTimeline([]); setLoadingThread(true); }
    try {
      if (convo.contactId) {
        const r = await api.get(`/contacts/${convo.contactId}/timeline`);
        const raw = (r.data.timeline as TimelineEntry[] | null | undefined) ?? [];
        setTimeline([...raw].reverse());
      } else {
        const r = await api.get(`/whatsapp/inbox?limit=100`);
        const msgs = ((r.data.messages as Array<{ fromPhone: string; id: string; body: string | null; type: string; receivedAt: string; replyToMessageId: string | null }>) ?? [])
          .filter((m) => m.fromPhone === convo.fromPhone).reverse();
        setTimeline(msgs.map((m) => ({ type: "received" as const, id: m.id, body: m.body, msgType: m.type, replyToMessageId: m.replyToMessageId, createdAt: m.receivedAt })));
      }
    } catch { if (!silent) toast.error("Failed to load conversation thread"); }
    if (!silent) {
      setLoadingThread(false);
      if (convo.unreadCount > 0) {
        api.patch("/whatsapp/inbox/read", { fromPhone: convo.fromPhone }).then(() => loadConversations(true)).catch(() => {});
      }
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, 150);
    }
  };

  const openConversation = (convo: Conversation) => openConversationThread(convo, false);

  // ── Send template reply ──────────────────────────────────────────────────
  const sendReply = async () => {
    if (!selected || !replyTemplate.trim()) return;
    setReplying(true);
    try {
      await api.post("/whatsapp/send", { to: selected.fromPhone, templateName: replyTemplate.trim(), languageCode: replyLang });
      toast.success("Reply sent!");
      setReplyTemplate(""); setReplyLang("en_US"); setReplyPreview(null);
      if (selected) openConversation(selected);
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Failed to send"));
    } finally { setReplying(false); }
  };

  const onPickTemplate = (t: Template) => { setReplyTemplate(t.name); setReplyLang(t.language); setReplyPreview(t.body ?? null); setShowPicker(false); };

  // ── Canned response quick-pick ───────────────────────────────────────────
  const filteredCanned = cannedList.filter((r) => {
    const q = cannedSearch.toLowerCase();
    return !q || r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q) || (r.shortcut ?? "").toLowerCase().includes(q);
  });

  // Auto-open canned picker when user types "/" in reply input
  const onReplyChange = (val: string) => {
    setReplyTemplate(val);
    setReplyPreview(null);
    if (val.startsWith("/")) setShowCannedPick(true);
    else if (!val) setShowCannedPick(false);
  };

  const pickCanned = (r: CannedResponse) => {
    setReplyTemplate(r.body);
    setReplyPreview(null);
    setShowCannedPick(false);
    setCannedSearch("");
  };

  const filtered = conversations.filter((c) => {
    if (unreadOnly && c.unreadCount === 0) return false;
    if (search && !c.fromPhone.includes(search) && !c.contact?.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {showPicker && <TemplatePicker onSelect={onPickTemplate} onClose={() => setShowPicker(false)} />}
      {showCannedMgr && <CannedManager onClose={() => { setShowCannedMgr(false); loadCannedResponses(); }} />}

      <div className="flex -mx-4 sm:-mx-6 lg:-mx-8" style={{ height: "calc(100vh - 112px)" }}>
        {/* ── Left: Conversation list ─────────────────────────────────────── */}
        <div className={clsx("w-full lg:w-80 xl:w-96 border-r border-gray-200 flex flex-col bg-white", selected && "hidden lg:flex")}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">Inbox</h1>
                {sseConnected && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" title="Real-time connected" />}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setUnreadOnly((v) => !v)}
                  className={clsx("text-xs font-medium px-2.5 py-1 rounded-full border transition-colors", unreadOnly ? "bg-brand text-white border-brand" : "bg-white text-gray-500 border-gray-200 hover:border-brand hover:text-brand")}
                >
                  Unread
                </button>
                <button
                  onClick={() => setShowCannedMgr(true)}
                  className="icon-btn"
                  title="Manage canned responses"
                >
                  <Zap className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm" placeholder="Search contacts..." />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvos ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 border-b border-gray-50 flex items-center gap-3">
                  <div className="animate-pulse bg-gray-200 rounded-full w-10 h-10 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="animate-pulse bg-gray-200 rounded h-4 w-32" />
                    <div className="animate-pulse bg-gray-100 rounded h-3 w-48" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No conversations yet</p>
              </div>
            ) : (
              filtered.map((convo) => {
                const name = convo.contact?.name ?? convo.fromPhone;
                const isSelected = selected?.fromPhone === convo.fromPhone;
                return (
                  <button key={convo.fromPhone} onClick={() => openConversation(convo)}
                    className={clsx("w-full px-4 py-3 border-b border-gray-50 flex items-start gap-3 text-left transition-colors", isSelected ? "bg-brand/5 border-l-2 border-l-brand" : "hover:bg-gray-50")}>
                    <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold", nameToColor(name))}>
                      {avatarChar(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={clsx("text-sm truncate", convo.unreadCount > 0 ? "font-bold text-gray-900" : "font-medium text-gray-800")}>{name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-2 tabular-nums">{formatRelativeTime(convo.latestMessage.receivedAt)}</span>
                      </div>
                      <p className={clsx("text-xs truncate", convo.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-400")}>
                        {convo.latestMessage.body ?? `[${convo.latestMessage.type}]`}
                      </p>
                    </div>
                    {convo.unreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shrink-0 mt-0.5">
                        {convo.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Chat thread ──────────────────────────────────────────── */}
        {selected ? (
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Thread header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 bg-white shrink-0">
              <button onClick={() => setSelected(null)} className="lg:hidden p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold", nameToColor(selected.contact?.name ?? selected.fromPhone))}>
                {avatarChar(selected.contact?.name ?? selected.fromPhone)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{selected.contact?.name ?? selected.fromPhone}</p>
                <p className="text-xs text-gray-400 font-mono">{selected.fromPhone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selected.contactId && (
                  <Link href={`/contacts/${selected.contactId}`} className="text-xs text-brand flex items-center gap-1 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /><span className="hidden sm:inline">Profile</span>
                  </Link>
                )}
                <button onClick={() => { if (selected) openConversation(selected); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Refresh">
                  <CheckCheck className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
              {loadingThread ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No messages yet</div>
              ) : (
                timeline.map((entry) => {
                  const isSent = entry.type === "sent";
                  return (
                    <div key={entry.id} className={clsx("flex", isSent ? "justify-end" : "justify-start")}>
                      <div className={clsx("max-w-[75%] sm:max-w-[60%] rounded-2xl px-4 py-2.5", isSent ? "bg-brand text-white rounded-br-sm" : "bg-white text-gray-900 rounded-bl-sm shadow-sm border border-gray-100")}>
                        {isSent ? (
                          <>
                            <p className="text-sm opacity-90">{entry.campaign ? `Campaign: ${entry.campaign.name}` : "Template sent"}</p>
                            <p className="text-[10px] mt-1 text-white/60">{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {entry.status}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm break-words">{entry.body ?? <span className="italic text-gray-400">[{entry.msgType}]</span>}</p>
                            <p className="text-[10px] mt-1 text-gray-400">{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply input */}
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-white shrink-0">
              {/* Canned response picker */}
              {showCannedPick && (
                <div className="mb-2 border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      value={cannedSearch}
                      onChange={(e) => setCannedSearch(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-brand"
                      placeholder="Search canned responses…"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                    {filteredCanned.length === 0 ? (
                      <p className="text-xs text-gray-400 p-3 text-center">No matches</p>
                    ) : filteredCanned.map((r) => (
                      <button key={r.id} onClick={() => pickCanned(r)} className="w-full text-left px-3 py-2 hover:bg-brand/5 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-800">{r.title}</span>
                          {r.shortcut && <code className="text-[10px] bg-gray-100 px-1 rounded text-gray-500">{r.shortcut}</code>}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{r.body}</p>
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-1.5 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Type to filter · click to use</span>
                    <button onClick={() => setShowCannedPick(false)} className="text-[10px] text-gray-400 hover:text-gray-600">Close</button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 items-center">
                {/* Canned responses button */}
                <button
                  onClick={() => setShowCannedPick((v) => !v)}
                  className={clsx("p-2 rounded-xl transition-colors shrink-0", showCannedPick ? "bg-brand/10 text-brand" : "text-gray-400 hover:text-brand hover:bg-brand/10")}
                  title="Canned responses (type / to trigger)"
                >
                  <Zap className="w-5 h-5" />
                </button>
                {/* Template picker button */}
                <button
                  onClick={() => setShowPicker(true)}
                  className="p-2 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-xl transition-colors shrink-0"
                  title="Browse templates"
                >
                  <Bot className="w-5 h-5" />
                </button>
                <input
                  value={replyTemplate}
                  onChange={(e) => onReplyChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !showCannedPick && sendReply()}
                  className="input flex-1 text-sm font-mono"
                  placeholder="Template name or type / for canned response"
                />
                <input
                  value={replyLang}
                  onChange={(e) => setReplyLang(e.target.value)}
                  className="input w-24 text-xs shrink-0 font-mono"
                  placeholder="en_US"
                  title="Language code"
                />
                <button onClick={sendReply} disabled={replying || !replyTemplate.trim()} className="btn-primary shrink-0">
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">{replying ? "Sending…" : "Send"}</span>
                </button>
              </div>

              {replyPreview && (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 line-clamp-3">
                  <span className="font-medium text-gray-400 mr-1.5">Preview:</span>{replyPreview}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1.5 pl-1">Only approved WhatsApp templates can be sent · type <code className="bg-gray-100 px-1 rounded">/</code> to pick a canned response</p>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Select a conversation</p>
              <p className="text-sm text-gray-400 mt-1">Pick a contact from the left to view the thread</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
