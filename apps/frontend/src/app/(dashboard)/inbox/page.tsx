"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MessageSquare, Reply, CheckCheck, Send, X, BookOpen, Megaphone, ExternalLink } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import TemplatePicker, { type Template } from "@/components/TemplatePicker";

interface InboundMessage {
  id: string;
  fromPhone: string;
  type: string;
  body: string | null;
  replyToMessageId: string | null;
  campaignId: string | null;
  read: boolean;
  receivedAt: string;
  contact: { id: string; name: string; phone: string } | null;
}

// ── Reply Modal ───────────────────────────────────────────────────────────────
function ReplyModal({ phone, name, onClose }: { phone: string; name: string; onClose: () => void }) {
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en_US");
  const [sending, setSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const onSelect = (t: Template) => {
    setTemplateName(t.name);
    setLanguageCode(t.language);
    setShowPicker(false);
  };

  const send = async () => {
    if (!templateName) { toast.error("Select a template first"); return; }
    setSending(true);
    try {
      await api.post("/whatsapp/send", { to: phone, templateName, languageCode });
      toast.success("Reply sent!");
      onClose();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Failed to send reply"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {showPicker && <TemplatePicker onSelect={onSelect} onClose={() => setShowPicker(false)} />}
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Reply</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                To: <span className="font-medium text-gray-700">{name}</span>
                <span className="ml-2 font-mono">{phone}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Template</label>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="text-xs text-brand font-medium flex items-center gap-1 hover:underline"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Browse
                </button>
              </div>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="input font-mono"
                placeholder="hello_world"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <input
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="input"
                placeholder="en_US"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={send}
                disabled={sending || !templateName}
                className="btn-primary flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sending ? "Sending..." : "Send Reply"}
              </button>
              <button onClick={onClose} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<{ phone: string; name: string } | null>(null);

  const load = (unread = false) => {
    setLoading(true);
    api
      .get(`/whatsapp/inbox?limit=50${unread ? "&unread=true" : ""}`)
      .then((res) => {
        setMessages(res.data.messages);
        setTotal(res.data.total);
        setTotalUnread(res.data.totalUnread);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(unreadOnly);
  }, [unreadOnly]);

  const markAllRead = async () => {
    await api.patch("/whatsapp/inbox/read", {});
    load(unreadOnly);
  };

  const markRead = async (id: string) => {
    await api.patch("/whatsapp/inbox/read", { ids: [id] });
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: true } : m))
    );
    setTotalUnread((n) => Math.max(0, n - 1));
  };

  return (
    <div>
      {replyTarget && (
        <ReplyModal
          phone={replyTarget.phone}
          name={replyTarget.name}
          onClose={() => setReplyTarget(null)}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} total
            {totalUnread > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 badge bg-red-100 text-red-600">
                {totalUnread} unread
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded accent-brand"
            />
            Unread only
          </label>
          {totalUnread > 0 && (
            <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 text-sm">
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="space-y-4 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="animate-pulse bg-gray-200 rounded-full w-9 h-9 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-40" />
                  <div className="animate-pulse bg-gray-100 rounded h-4 w-3/4" />
                  <div className="animate-pulse bg-gray-100 rounded h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Replies from contacts will appear here via the Meta webhook
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {messages.map((msg) => {
              const displayName = msg.contact?.name ?? msg.fromPhone;
              return (
                <div
                  key={msg.id}
                  className={clsx(
                    "flex items-start gap-4 py-4 px-2 rounded-lg transition-colors",
                    !msg.read && "bg-brand/5"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-gray-600">
                      {displayName[0].toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{displayName}</span>
                      <span className="text-xs text-gray-400 font-mono">{msg.fromPhone}</span>
                      {!msg.read && (
                        <span className="badge bg-brand/20 text-brand-dark text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                    </div>

                    {msg.replyToMessageId && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                        <Reply className="w-3 h-3" />
                        <span>Reply to message</span>
                        <code className="bg-gray-100 px-1 rounded text-[10px] truncate max-w-[160px]">
                          {msg.replyToMessageId}
                        </code>
                      </div>
                    )}

                    <p className="text-sm text-gray-700 break-words">
                      {msg.body ?? (
                        <span className="italic text-gray-400">[{msg.type}]</span>
                      )}
                    </p>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-xs text-gray-400">
                        {new Date(msg.receivedAt).toLocaleString()} ·{" "}
                        <span className="capitalize">{msg.type}</span>
                      </p>
                      {msg.campaignId && (
                        <a
                          href="/campaigns"
                          className="inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-medium hover:bg-purple-200 transition-colors"
                        >
                          <Megaphone className="w-2.5 h-2.5" />
                          Campaign reply
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setReplyTarget({ phone: msg.fromPhone, name: displayName })}
                      className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>

                    {!msg.read && (
                      <button
                        onClick={() => markRead(msg.id)}
                        className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
