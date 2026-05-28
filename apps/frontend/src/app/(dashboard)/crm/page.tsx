"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Phone, Mail, ChevronRight, ArrowRight } from "lucide-react";
import clsx from "clsx";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  leadStatus: string;
};

const STAGES = ["new", "prospect", "qualified", "customer", "churned"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_CONFIG: Record<Stage, {
  label: string;
  headerBg: string;
  headerText: string;
  colBg: string;
  dot: string;
}> = {
  new:       { label: "New",       headerBg: "bg-gray-100",    headerText: "text-gray-700",   colBg: "bg-gray-50/60",   dot: "bg-gray-400" },
  prospect:  { label: "Prospect",  headerBg: "bg-blue-100",    headerText: "text-blue-800",   colBg: "bg-blue-50/40",   dot: "bg-blue-500" },
  qualified: { label: "Qualified", headerBg: "bg-amber-100",   headerText: "text-amber-800",  colBg: "bg-amber-50/40",  dot: "bg-amber-500" },
  customer:  { label: "Customer",  headerBg: "bg-emerald-100", headerText: "text-emerald-800",colBg: "bg-emerald-50/40",dot: "bg-emerald-500" },
  churned:   { label: "Churned",   headerBg: "bg-red-100",     headerText: "text-red-800",    colBg: "bg-red-50/40",    dot: "bg-red-400" },
};

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Fetch each stage in parallel — avoids serial while-loop pagination
      // which was O(n) round-trips and could loop infinitely on large datasets.
      const results = await Promise.all(
        STAGES.map((stage) =>
          api.get(`/contacts?leadStatus=${stage}&limit=500`).then((r) => r.data.contacts as Contact[])
        )
      );
      setContacts(results.flat());
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const moveContact = async (contactId: string, newStage: Stage) => {
    setMovingId(contactId);
    try {
      await api.patch(`/contacts/${contactId}/lead-status`, { status: newStage });
      setContacts((cs) =>
        cs.map((c) => (c.id === contactId ? { ...c, leadStatus: newStage } : c))
      );
      toast.success(`Moved to ${STAGE_CONFIG[newStage].label}`);
    } catch {
      toast.error("Failed to update stage");
    } finally {
      setMovingId(null);
    }
  };

  const byStage = STAGES.reduce<Record<Stage, Contact[]>>((acc, s) => {
    acc[s] = contacts.filter((c) => c.leadStatus === s);
    return acc;
  }, {} as Record<Stage, Contact[]>);

  if (loading) {
    return (
      <div>
        <h1 className="page-title mb-6">CRM Pipeline</h1>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s} className="min-w-[240px] bg-gray-100 rounded-2xl h-72 animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div>
          <h1 className="page-title">CRM Pipeline</h1>
          <p className="page-subtitle">{contacts.length} contacts across {STAGES.length} stages</p>
        </div>
        <Link href="/contacts" className="btn-secondary text-sm shrink-0">
          Manage Contacts
        </Link>
      </div>

      {/* Stage totals bar */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {STAGES.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const count = byStage[stage].length;
          return (
            <div key={stage} className={clsx("flex items-center gap-2 px-3 py-2 rounded-xl shrink-0", cfg.headerBg)}>
              <span className={clsx("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
              <span className={clsx("text-xs font-semibold", cfg.headerText)}>{cfg.label}</span>
              <span className={clsx("text-xs font-bold bg-white/60 rounded-full px-1.5 py-0.5 tabular-nums", cfg.headerText)}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-6" style={{ minHeight: "calc(100vh - 280px)" }}>
        {STAGES.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const cols = byStage[stage];
          const nextStage = STAGES[STAGES.indexOf(stage) + 1];
          return (
            <div key={stage} className="min-w-[256px] max-w-[256px] flex flex-col shrink-0">
              {/* Column header */}
              <div className={clsx("flex items-center justify-between px-3 py-2.5 rounded-t-xl", cfg.headerBg)}>
                <div className="flex items-center gap-1.5">
                  <span className={clsx("w-2 h-2 rounded-full", cfg.dot)} />
                  <span className={clsx("text-sm font-semibold", cfg.headerText)}>{cfg.label}</span>
                </div>
                <span className={clsx("text-xs font-bold bg-white/50 rounded-full px-2 py-0.5 tabular-nums", cfg.headerText)}>{cols.length}</span>
              </div>

              {/* Cards */}
              <div className={clsx("flex-1 rounded-b-xl p-2 space-y-2 min-h-[120px]", cfg.colBg, "border border-t-0", stage === "new" ? "border-gray-200" : stage === "prospect" ? "border-blue-200" : stage === "qualified" ? "border-amber-200" : stage === "customer" ? "border-emerald-200" : "border-red-200")}>
                {cols.map((contact) => (
                  <div
                    key={contact.id}
                    className={clsx(
                      "bg-white rounded-xl p-3 shadow-sm border border-gray-100 transition-all duration-150",
                      movingId === contact.id ? "opacity-40 scale-95" : "hover:shadow-md hover:border-gray-200"
                    )}
                  >
                    {/* Name + avatar */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5", avatarColor(contact.name))}>
                        {contact.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="font-semibold text-sm text-gray-900 hover:text-brand truncate block"
                        >
                          {contact.name}
                        </Link>
                        <div className="text-[10px] text-gray-400 font-mono truncate">{contact.phone}</div>
                      </div>
                      <Link href={`/contacts/${contact.id}`} className="shrink-0 mt-0.5">
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 hover:text-brand" />
                      </Link>
                    </div>

                    {/* Email */}
                    {contact.email && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-1.5">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}

                    {/* Tags */}
                    {contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {contact.tags.slice(0, 2).map((t) => (
                          <span key={t} className="badge-gray text-[9px] px-1.5 py-0.5">{t}</span>
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="text-[9px] text-gray-400">+{contact.tags.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Move forward shortcut */}
                    {nextStage && (
                      <button
                        onClick={() => moveContact(contact.id, nextStage)}
                        disabled={movingId === contact.id}
                        className={clsx(
                          "w-full flex items-center justify-center gap-1 text-[10px] font-semibold py-1 rounded-lg transition-colors mt-1",
                          STAGE_CONFIG[nextStage].headerBg,
                          STAGE_CONFIG[nextStage].headerText,
                          "hover:opacity-80 disabled:opacity-40"
                        )}
                      >
                        <ArrowRight className="w-3 h-3" />
                        Move to {STAGE_CONFIG[nextStage].label}
                      </button>
                    )}

                    {/* All stage buttons (collapsed into small pills) */}
                    <div className="flex gap-1 flex-wrap mt-1">
                      {STAGES.filter((s) => s !== stage && s !== nextStage).map((s) => (
                        <button
                          key={s}
                          onClick={() => moveContact(contact.id, s)}
                          disabled={movingId === contact.id}
                          title={`Move to ${s}`}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 capitalize transition-colors disabled:opacity-30"
                        >
                          {STAGE_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {cols.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-xs text-gray-300">No contacts</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
