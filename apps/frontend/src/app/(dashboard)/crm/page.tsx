"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Phone, Mail, ChevronRight } from "lucide-react";

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

const STAGE_CONFIG: Record<Stage, { label: string; color: string; headerColor: string }> = {
  new:       { label: "New",       color: "bg-gray-50",    headerColor: "bg-gray-200 text-gray-700" },
  prospect:  { label: "Prospect",  color: "bg-blue-50",    headerColor: "bg-blue-200 text-blue-800" },
  qualified: { label: "Qualified", color: "bg-yellow-50",  headerColor: "bg-yellow-200 text-yellow-800" },
  customer:  { label: "Customer",  color: "bg-green-50",   headerColor: "bg-green-200 text-green-800" },
  churned:   { label: "Churned",   color: "bg-red-50",     headerColor: "bg-red-200 text-red-800" },
};

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      let page = 1;
      let all: Contact[] = [];
      while (true) {
        const res = await api.get(`/contacts?page=${page}&limit=100`);
        all = [...all, ...res.data.contacts];
        if (all.length >= res.data.total) break;
        page++;
      }
      setContacts(all);
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">CRM Pipeline</h1>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s} className="min-w-[240px] bg-gray-100 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">CRM Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts across {STAGES.length} stages</p>
        </div>
        <Link href="/contacts" className="btn-secondary text-sm shrink-0">
          Manage Contacts
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[70vh]">
        {STAGES.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const cols = byStage[stage];
          return (
            <div key={stage} className="min-w-[260px] flex flex-col">
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${cfg.headerColor}`}>
                <span className="text-sm font-semibold capitalize">{cfg.label}</span>
                <span className="text-xs font-bold bg-white/50 rounded-full px-2 py-0.5">{cols.length}</span>
              </div>

              {/* Cards */}
              <div className={`flex-1 rounded-b-xl ${cfg.color} p-2 space-y-2 min-h-[200px]`}>
                {cols.map((contact) => (
                  <div
                    key={contact.id}
                    className={`bg-white rounded-xl p-3 shadow-sm border border-gray-100 transition-opacity ${movingId === contact.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-medium text-sm text-gray-900 hover:text-brand truncate"
                      >
                        {contact.name}
                      </Link>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    </div>

                    <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{contact.phone}</span>
                      </div>
                      {contact.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                    </div>

                    {contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {contact.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{t}</span>
                        ))}
                        {contact.tags.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{contact.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Stage move buttons */}
                    <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
                      {STAGES.filter((s) => s !== stage).map((s) => (
                        <button
                          key={s}
                          onClick={() => moveContact(contact.id, s)}
                          disabled={movingId === contact.id}
                          title={`Move to ${s}`}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 capitalize transition-colors"
                        >
                          {STAGE_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {cols.length === 0 && (
                  <p className="text-xs text-center text-gray-400 py-6">No contacts</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
