"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MessageSquare, Reply, CheckCheck } from "lucide-react";
import clsx from "clsx";

interface InboundMessage {
  id: string;
  fromPhone: string;
  type: string;
  body: string | null;
  replyToMessageId: string | null;
  read: boolean;
  receivedAt: string;
  contact: { id: string; name: string; phone: string } | null;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} total · {totalUnread} unread
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded"
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
          <p className="text-gray-400 text-sm">Loading...</p>
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
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={clsx(
                  "flex items-start gap-4 py-4 px-2 rounded-lg transition-colors",
                  !msg.read && "bg-brand/5"
                )}
              >
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-gray-600">
                    {(msg.contact?.name ?? msg.fromPhone)[0].toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-gray-900">
                      {msg.contact?.name ?? msg.fromPhone}
                    </span>
                    <span className="text-xs text-gray-400">{msg.fromPhone}</span>
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

                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(msg.receivedAt).toLocaleString()} ·{" "}
                    <span className="capitalize">{msg.type}</span>
                  </p>
                </div>

                {!msg.read && (
                  <button
                    onClick={() => markRead(msg.id)}
                    className="shrink-0 text-xs text-gray-400 hover:text-brand transition-colors"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
