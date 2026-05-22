"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Phone,
  Mail,
  Tag,
  MessageSquare,
  Send,
  FileText,
  Trash2,
  ChevronDown,
} from "lucide-react";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  optIn: boolean;
  leadStatus: string;
};

type ContactNote = {
  id: string;
  body: string;
  userEmail?: string;
  createdAt: string;
};

type TimelineEntry =
  | { type: "sent"; id: string; status: string; campaign: { id: string; name: string } | null; createdAt: string }
  | { type: "received"; id: string; body: string | null; msgType: string; replyToMessageId: string | null; createdAt: string };

const LEAD_STAGES = ["new", "prospect", "qualified", "customer", "churned"] as const;
type LeadStage = (typeof LEAD_STAGES)[number];

const STAGE_COLORS: Record<LeadStage, string> = {
  new:       "bg-gray-100 text-gray-700",
  prospect:  "bg-blue-100 text-blue-700",
  qualified: "bg-yellow-100 text-yellow-700",
  customer:  "bg-green-100 text-green-700",
  churned:   "bg-red-100 text-red-700",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ContactProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stageOpen) return;
    const handler = (e: MouseEvent) => {
      if (stageRef.current && !stageRef.current.contains(e.target as Node)) {
        setStageOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [stageOpen]);

  const load = useCallback(async () => {
    try {
      const [timelineRes, notesRes] = await Promise.all([
        api.get(`/contacts/${id}/timeline`),
        api.get(`/contacts/${id}/notes`),
      ]);
      setContact(timelineRes.data.contact);
      setTimeline(timelineRes.data.timeline);
      setNotes(notesRes.data.notes);
    } catch {
      toast.error("Failed to load contact");
      router.push("/contacts");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const updateStage = async (status: LeadStage) => {
    setStageOpen(false);
    try {
      const res = await api.patch(`/contacts/${id}/lead-status`, { status });
      setContact((c) => c ? { ...c, leadStatus: res.data.leadStatus } : c);
      toast.success(`Stage updated to ${status}`);
    } catch {
      toast.error("Failed to update stage");
    }
  };

  const addNote = async () => {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      const res = await api.post(`/contacts/${id}/notes`, { body: noteBody });
      setNotes((n) => [res.data, ...n]);
      setNoteBody("");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      await api.delete(`/contacts/${id}/notes/${noteId}`);
      setNotes((n) => n.filter((x) => x.id !== noteId));
    } catch {
      toast.error("Failed to delete note");
    }
  };

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!contact) return null;

  const stage = contact.leadStatus as LeadStage;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/contacts" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
          <p className="text-sm text-gray-500">Contact profile</p>
        </div>
        <div className="relative" ref={stageRef}>
          <button
            onClick={() => setStageOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-700"}`}
          >
            {stage}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {stageOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 z-10 overflow-hidden">
              {LEAD_STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStage(s)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${s === stage ? "font-semibold" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Contact details + notes */}
        <div className="lg:col-span-1 space-y-4">
          {/* Details card */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4 shrink-0 text-gray-400" />
                <span>{contact.phone}</span>
              </div>
              {contact.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 shrink-0 text-gray-400" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              {contact.tags.length > 0 && (
                <div className="flex items-start gap-2 text-gray-600">
                  <Tag className="w-4 h-4 shrink-0 text-gray-400 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((t) => (
                      <span key={t} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <MessageSquare className="w-4 h-4 shrink-0 text-gray-400" />
                <span>Opt-in: <span className={contact.optIn ? "text-green-600 font-medium" : "text-red-500"}>{contact.optIn ? "Yes" : "No"}</span></span>
              </div>
            </div>
          </div>

          {/* Pipeline stage progress */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Pipeline</h2>
            <div className="flex gap-1">
              {LEAD_STAGES.map((s, i) => {
                const currentIdx = LEAD_STAGES.indexOf(stage);
                const isPast = i <= currentIdx;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1">
                    <button
                      onClick={() => updateStage(s)}
                      className={`w-full h-1.5 rounded-full transition-colors ${isPast ? "bg-brand" : "bg-gray-200"}`}
                    />
                    <span className={`text-[9px] font-medium capitalize ${isPast ? "text-brand" : "text-gray-400"}`}>{s}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4" /> Notes
            </h2>
            <div className="flex gap-2 mb-3">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note…"
                className="input resize-none text-sm flex-1"
                rows={2}
              />
              <button
                onClick={addNote}
                disabled={savingNote || !noteBody.trim()}
                className="btn-primary px-3 self-end"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No notes yet</p>}
              {notes.map((note) => (
                <div key={note.id} className="bg-gray-50 rounded-lg p-2.5 text-sm group">
                  <p className="text-gray-800 whitespace-pre-wrap">{note.body}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-400">{note.userEmail ?? "—"} · {formatTime(note.createdAt)}</span>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Conversation timeline */}
        <div className="lg:col-span-2">
          <div className="card h-full">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">Conversation History</h2>
            {timeline.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No messages yet</p>
            )}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {timeline.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex ${entry.type === "sent" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      entry.type === "sent"
                        ? "bg-brand text-white rounded-tr-none"
                        : "bg-gray-100 text-gray-800 rounded-tl-none"
                    }`}
                  >
                    {entry.type === "sent" ? (
                      <div>
                        {entry.campaign && (
                          <p className="text-[10px] font-semibold opacity-75 mb-1 uppercase tracking-wide">
                            Campaign: {entry.campaign.name}
                          </p>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          entry.status === "sent" ? "bg-white/20" :
                          entry.status === "failed" ? "bg-red-200 text-red-800" :
                          "bg-white/20"
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                    ) : (
                      <p>{entry.body ?? `[${entry.msgType}]`}</p>
                    )}
                    <p className={`text-[10px] mt-1 ${entry.type === "sent" ? "opacity-60 text-right" : "text-gray-400"}`}>
                      {formatTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
