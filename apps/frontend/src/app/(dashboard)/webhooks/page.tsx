"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Webhook, Plus, Trash2, X, CheckCircle, XCircle, Send, ToggleLeft, ToggleRight, Copy } from "lucide-react";
import toast from "react-hot-toast";

interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string | null;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

const ALL_EVENTS = [
  "message.inbound",
  "message.delivered",
  "message.read",
  "message.failed",
  "contact.opted_out",
  "contact.opted_in",
  "campaign.completed",
  "sequence.step_sent",
];

function EndpointModal({
  onSave,
  onClose,
}: {
  onSave: (data: { url: string; secret: string; events: string[]; isActive: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleEvent = (e: string) =>
    setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);

  const handleSave = async () => {
    if (!url.trim()) { toast.error("URL is required"); return; }
    if (events.length === 0) { toast.error("Select at least one event"); return; }
    setSaving(true);
    try {
      await onSave({ url: url.trim(), secret: secret.trim(), events, isActive: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">New Webhook Endpoint</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input font-mono text-sm"
              placeholder="https://your-server.com/webhook"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signing secret <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="input font-mono text-sm"
              placeholder="your-secret-key"
              type="password"
            />
            <p className="text-xs text-gray-400 mt-1">
              We'll sign each request with <code className="bg-gray-100 px-1 rounded">X-Webhook-Signature: sha256=…</code>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Events to subscribe</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded accent-brand"
                  />
                  <span className="text-sm font-mono text-gray-700">{ev}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create endpoint"}
            </button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/webhooks")
      .then((r) => setEndpoints(r.data.endpoints))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: { url: string; secret: string; events: string[]; isActive: boolean }) => {
    try {
      await api.post("/webhooks", data);
      toast.success("Endpoint created");
      setShowModal(false);
      load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed");
    }
  };

  const toggleActive = async (ep: WebhookEndpoint) => {
    try {
      await api.patch(`/webhooks/${ep.id}`, { isActive: !ep.isActive });
      setEndpoints((prev) => prev.map((e) => e.id === ep.id ? { ...e, isActive: !e.isActive } : e));
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    try {
      await api.delete(`/webhooks/${id}`);
      toast.success("Deleted");
      setEndpoints((prev) => prev.filter((e) => e.id !== id));
    } catch {
      toast.error("Failed to delete");
    }
  };

  const testEndpoint = async (id: string) => {
    setTesting(id);
    try {
      await api.post(`/webhooks/${id}/test`);
      toast.success("Test payload sent!");
    } catch {
      toast.error("Test delivery failed");
    } finally {
      setTesting(null);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied");
  };

  return (
    <div>
      {showModal && <EndpointModal onSave={handleCreate} onClose={() => setShowModal(false)} />}

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Outbound Webhooks</h1>
          <p className="text-gray-500 text-sm mt-1">
            Receive real-time event notifications at your own endpoints
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add endpoint</span>
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="space-y-4 py-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="bg-gray-200 rounded h-5 flex-1" />
                <div className="bg-gray-100 rounded h-5 w-24" />
              </div>
            ))}
          </div>
        ) : endpoints.length === 0 ? (
          <div className="text-center py-16">
            <Webhook className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No webhook endpoints yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Add an endpoint to receive real-time event notifications
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {endpoints.map((ep) => (
              <div key={ep.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {ep.isActive
                      ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      : <XCircle className="w-4 h-4 text-gray-300 shrink-0" />
                    }
                    <span className="font-mono text-sm text-gray-900 truncate">{ep.url}</span>
                    <button onClick={() => copyUrl(ep.url)} className="p-1 text-gray-400 hover:text-gray-600 shrink-0">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => testEndpoint(ep.id)}
                      disabled={testing === ep.id}
                      className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                      title="Send test payload"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleActive(ep)}
                      className={ep.isActive ? "text-green-500" : "text-gray-300"}
                      title={ep.isActive ? "Disable" : "Enable"}
                    >
                      {ep.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => remove(ep.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {ep.events.map((ev) => (
                    <span key={ev} className="inline-block bg-gray-100 text-gray-600 text-[11px] font-mono px-2 py-0.5 rounded">
                      {ev}
                    </span>
                  ))}
                </div>

                {ep.secret && (
                  <p className="text-xs text-gray-400 mt-2">
                    Signed with HMAC-SHA256
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <p className="font-semibold mb-1">Verifying webhook signatures</p>
        <p className="text-blue-700 text-xs">
          Each request includes <code className="bg-blue-100 px-1 rounded">X-Webhook-Signature: sha256=&lt;hex&gt;</code>.
          Compute <code className="bg-blue-100 px-1 rounded">HMAC-SHA256(secret, raw_body)</code> and compare to verify authenticity.
        </p>
      </div>
    </div>
  );
}
