"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  Bot,
  CheckCheck,
  ChevronLeft,
  ExternalLink,
  MessageSquare,
  Search,
  Send,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import Link from "next/link";
import TemplatePicker, { type Template } from "@/components/TemplatePicker";

interface Conversation {
  fromPhone: string;
  contactId: string | null;
  contact: { id: string; name: string; phone: string } | null;
  latestMessage: { id: string; body: string | null; type: string; receivedAt: string; read: boolean };
  unreadCount: number;
}

type TimelineEntry =
  | { type: "sent"; id: string; status: string; campaign: { id: string; name: string } | null; createdAt: string }
  | { type: "received"; id: string; body: string | null; msgType: string; replyToMessageId: string | null; createdAt: string };

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-amber-100 text-amber-700",
];

function nameToColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

/** Safe first character for avatar — falls back to "?" if name is empty */
function avatarChar(name: string): string {
  return name?.trim()?.[0]?.toUpperCase() ?? "?";
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [replyTemplate, setReplyTemplate] = useState("");
  const [replyLang, setReplyLang] = useState("en_US");
  const [replying, setReplying] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    setLoadingConvos(true);
    api.get("/whatsapp/conversations")
      .then((r) => setConversations(r.data.conversations))
      .catch(() => { /* toast shown by interceptor */ })
      .finally(() => setLoadingConvos(false));
  };

  useEffect(() => { loadConversations(); }, []);

  const openConversation = async (convo: Conversation) => {
    setSelected(convo);
    setTimeline([]);
    setLoadingThread(true);
    try {
      if (convo.contactId) {
        const r = await api.get(`/contacts/${convo.contactId}/timeline`);
        // API returns newest-first; reverse for chronological chat display
        setTimeline([...(r.data.timeline as TimelineEntry[])].reverse());
      } else {
        const r = await api.get(`/whatsapp/inbox?limit=100`);
        const msgs = (r.data.messages as Array<{ fromPhone: string; id: string; body: string | null; type: string; receivedAt: string; replyToMessageId: string | null }>)
          .filter((m) => m.fromPhone === convo.fromPhone)
          .reverse();
        setTimeline(msgs.map((m) => ({
          type: "received" as const,
          id: m.id,
          body: m.body,
          msgType: m.type,
          replyToMessageId: m.replyToMessageId,
          createdAt: m.receivedAt,
        })));
      }
    } catch { /* ignore */ }
    setLoadingThread(false);

    // Mark only this conversation's messages as read
    if (convo.unreadCount > 0) {
      api.patch("/whatsapp/inbox/read", { fromPhone: convo.fromPhone }).then(loadConversations).catch(() => {});
    }
    setTimeout(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    }, 150);
  };

  const sendReply = async () => {
    if (!selected || !replyTemplate.trim()) return;
    setReplying(true);
    try {
      await api.post("/whatsapp/send", { to: selected.fromPhone, templateName: replyTemplate.trim(), languageCode: replyLang });
      toast.success("Reply sent!");
      setReplyTemplate("");
      setReplyLang("en_US");
      if (selected) openConversation(selected);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed to send");
    } finally {
      setReplying(false);
    }
  };

  const onPickTemplate = (t: Template) => {
    setReplyTemplate(t.name);
    setReplyLang(t.language);
    setShowPicker(false);
  };

  const filtered = conversations.filter((c) => {
    if (unreadOnly && c.unreadCount === 0) return false;
    if (search && !c.fromPhone.includes(search) && !c.contact?.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {showPicker && <TemplatePicker onSelect={onPickTemplate} onClose={() => setShowPicker(false)} />}

      <div className="flex -mx-4 sm:-mx-6 lg:-mx-8" style={{ height: "calc(100vh - 112px)" }}>
        {/* ── Left: Conversation list ─────────────────────────────────────── */}
        <div
          className={clsx(
            "w-full lg:w-80 xl:w-96 border-r border-gray-200 flex flex-col bg-white",
            selected && "hidden lg:flex"
          )}
        >
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-gray-900">Inbox</h1>
              <button
                onClick={() => setUnreadOnly((v) => !v)}
                className={clsx(
                  "text-xs font-medium px-2.5 py-1 rounded-full border transition-colors",
                  unreadOnly
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-gray-500 border-gray-200 hover:border-brand hover:text-brand"
                )}
              >
                Unread
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-sm"
                placeholder="Search contacts..."
              />
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
                const avatarCls = nameToColor(name);
                return (
                  <button
                    key={convo.fromPhone}
                    onClick={() => openConversation(convo)}
                    className={clsx(
                      "w-full px-4 py-3 border-b border-gray-50 flex items-start gap-3 text-left transition-colors",
                      isSelected
                        ? "bg-brand/5 border-l-2 border-l-brand"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold", avatarCls)}>
                      {avatarChar(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={clsx("text-sm truncate", convo.unreadCount > 0 ? "font-bold text-gray-900" : "font-medium text-gray-800")}>{name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-2 tabular-nums">
                          {formatRelativeTime(convo.latestMessage.receivedAt)}
                        </span>
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
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold", nameToColor(selected.contact?.name ?? selected.fromPhone))}>
                {avatarChar(selected.contact?.name ?? selected.fromPhone)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">
                  {selected.contact?.name ?? selected.fromPhone}
                </p>
                <p className="text-xs text-gray-400 font-mono">{selected.fromPhone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selected.contactId && (
                  <Link
                    href={`/contacts/${selected.contactId}`}
                    className="text-xs text-brand flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Profile</span>
                  </Link>
                )}
                <button
                  onClick={() => { if (selected) openConversation(selected); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Refresh"
                >
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
                      <div
                        className={clsx(
                          "max-w-[75%] sm:max-w-[60%] rounded-2xl px-4 py-2.5",
                          isSent
                            ? "bg-brand text-white rounded-br-sm"
                            : "bg-white text-gray-900 rounded-bl-sm shadow-sm border border-gray-100"
                        )}
                      >
                        {isSent ? (
                          <>
                            <p className="text-sm opacity-90">
                              {entry.campaign ? `Campaign: ${entry.campaign.name}` : "Template sent"}
                            </p>
                            <p className="text-[10px] mt-1 text-white/60">
                              {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" · "}{entry.status}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm break-words">
                              {entry.body ?? <span className="italic text-gray-400">[{entry.msgType}]</span>}
                            </p>
                            <p className="text-[10px] mt-1 text-gray-400">
                              {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
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
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setShowPicker(true)}
                  className="p-2 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-xl transition-colors shrink-0"
                  title="Browse templates"
                >
                  <Bot className="w-5 h-5" />
                </button>
                <input
                  value={replyTemplate}
                  onChange={(e) => setReplyTemplate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                  className="input flex-1 text-sm font-mono"
                  placeholder="Template name (e.g. hello_world)"
                />
                <select
                  value={replyLang}
                  onChange={(e) => setReplyLang(e.target.value)}
                  className="input w-24 text-xs shrink-0"
                >
                  <option value="en_US">en_US</option>
                  <option value="en">en</option>
                  <option value="hi">hi</option>
                  <option value="es">es</option>
                </select>
                <button
                  onClick={sendReply}
                  disabled={replying || !replyTemplate.trim()}
                  className="btn-primary shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">{replying ? "Sending…" : "Send"}</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
                Only approved WhatsApp templates can be sent as replies
              </p>
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
