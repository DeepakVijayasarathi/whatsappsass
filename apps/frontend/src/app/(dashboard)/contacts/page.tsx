"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";
import { Plus, Trash2, Phone, Upload, Download, X, Pencil, CheckSquare } from "lucide-react";
import { SkeletonTableRow } from "@/components/Skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  optIn: boolean;
}

const schema = z.object({
  name: z.string().min(1, "Name required"),
  phone: z.string().min(7, "Valid phone required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  tags: z.string().optional(),
  optIn: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

type Tab = "list" | "add" | "import";

const PAGE_SIZE = 20;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): Omit<Contact, "id">[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return {
      name: row.name || row.fullname || row.contactname || "",
      phone: row.phone || row.mobile || row.phonenumber || "",
      tags: row.tags ? row.tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
      optIn: row.optin === "true" || row.optin === "1" || row.optin === "yes",
    };
  }).filter((r) => r.name && r.phone);
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ contact, onClose, onSaved }: {
  contact: Contact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: contact.name,
      phone: contact.phone,
      email: contact.email ?? "",
      tags: contact.tags.join(", "),
      optIn: contact.optIn,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await api.patch(`/contacts/${contact.id}`, {
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        optIn: data.optIn ?? false,
      });
      toast.success("Contact updated");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to update contact");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Edit Contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input {...register("name")} className="input" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input {...register("phone")} className="input" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
            <input {...register("email")} type="email" className="input" placeholder="contact@example.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
            <input {...register("tags")} className="input" placeholder="vip, customer" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input {...register("optIn")} type="checkbox" className="rounded accent-brand" />
            Opted in to receive messages
          </label>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<Tab>("list");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // CSV import state
  const [csvRows, setCsvRows] = useState<Omit<Contact, "id">[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mountedRef = useRef(false);

  const load = useCallback((p: number, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(p),
      limit: String(PAGE_SIZE),
      ...(q ? { search: q } : {}),
    });
    api.get(`/contacts?${params}`).then((res) => {
      setContacts(res.data.contacts);
      setTotal(res.data.total);
    }).finally(() => setLoading(false));
  }, []);

  // Load when page changes (search changes are handled by the debounce effect below)
  useEffect(() => { load(page, search); }, [page, load]);

  // Debounced search — skip initial mount to avoid double-fetch, reset to page 1
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search); }, 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/contacts", {
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        optIn: data.optIn ?? false,
      });
      toast.success("Contact added");
      reset();
      setTab("list");
      load(1, search);
    } catch {
      toast.error("Failed to add contact");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await api.delete(`/contacts/${id}`);
      toast.success("Deleted");
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      load(page, search);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""}?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.delete(`/contacts/${id}`)));
      toast.success(`Deleted ${selectedIds.size} contacts`);
      setSelectedIds(new Set());
      load(1, search);
      setPage(1);
    } catch {
      toast.error("Some deletions failed");
      load(page, search);
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  // CSV
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("No valid rows found. Check CSV format.");
        return;
      }
      setCsvRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importCsv = async () => {
    if (csvRows.length === 0) return;
    setCsvImporting(true);
    try {
      const res = await api.post("/contacts/bulk", { contacts: csvRows.slice(0, 500) });
      toast.success(`Imported ${res.data.created} contacts`);
      setCsvRows([]);
      setTab("list");
      load(1, search);
    } catch {
      toast.error("Import failed");
    } finally {
      setCsvImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "name,phone,tags,optIn\nJohn Doe,+1234567890,vip|customer,true\nJane Smith,+0987654321,,false";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "contacts_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportContacts = async () => {
    try {
      let all: Contact[] = [];
      let pg = 1;
      const exportLimit = 500;
      while (true) {
        const res = await api.get(`/contacts?page=${pg}&limit=${exportLimit}`);
        all = [...all, ...res.data.contacts];
        if (all.length >= res.data.total) break;
        pg++;
      }
      const header = "name,phone,tags,optIn";
      const rows = all.map((c) =>
        `"${c.name}","${c.phone}","${c.tags.join("|")}",${c.optIn}`
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "contacts.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} contacts`);
    } catch {
      toast.error("Export failed");
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "list", label: `All Contacts (${total})` },
    { id: "add", label: "Add Contact" },
    { id: "import", label: "Import CSV" },
  ];

  return (
    <div>
      {editContact && (
        <EditModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          onSaved={() => load(page, search)}
        />
      )}

      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total contacts</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <button onClick={exportContacts} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button onClick={() => setTab("import")} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Import</span>
          </button>
          <button onClick={() => setTab("add")} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Contact</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-700"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Add form ── */}
      {tab === "add" && (
        <div className="card max-w-xl">
          <h2 className="text-base font-semibold mb-4">New Contact</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input {...register("name")} className="input" placeholder="John Doe" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input {...register("phone")} className="input" placeholder="+1234567890" />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
              <input {...register("email")} type="email" className="input" placeholder="john@example.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
              <input {...register("tags")} className="input" placeholder="vip, customer" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input {...register("optIn")} type="checkbox" className="rounded accent-brand" />
              Opted in to receive messages
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? "Saving..." : "Save Contact"}
              </button>
              <button type="button" onClick={() => setTab("list")} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── CSV import ── */}
      {tab === "import" && (
        <div className="card max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Import from CSV</h2>
            <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Download Template
            </button>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg text-xs text-gray-600 mb-4 font-mono">
            name,phone,tags,optIn<br />
            John Doe,+1234567890,vip|customer,true<br />
            Jane Smith,+0987654321,,false
          </div>

          {csvRows.length === 0 ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Click to upload CSV</p>
              <p className="text-xs text-gray-400 mt-1">Max 500 contacts per import</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFileChange} className="hidden" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">
                  {csvRows.length} contacts ready to import
                </p>
                <button onClick={() => setCsvRows([])} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {["Name", "Phone", "Tags", "Opt-in"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {csvRows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 font-mono">{r.phone}</td>
                        <td className="px-3 py-2">{r.tags.join(", ") || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={r.optIn ? "text-green-600" : "text-gray-400"}>
                            {r.optIn ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 20 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    +{csvRows.length - 20} more rows...
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={importCsv} disabled={csvImporting} className="btn-primary">
                  {csvImporting ? "Importing..." : `Import ${csvRows.length} Contacts`}
                </button>
                <button onClick={() => setCsvRows([])} className="btn-secondary">Clear</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Contact list ── */}
      {tab === "list" && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input max-w-sm"
              placeholder="Search by name or phone..."
            />
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <CheckSquare className="w-4 h-4 text-brand" />
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="btn-danger flex items-center gap-2 text-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.size}`}
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="btn-secondary text-sm"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 w-8 pl-4 sm:pl-0" />
                  <th className="pb-3 text-left font-medium text-gray-500">Name</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Phone</th>
                  <th className="pb-3 text-left font-medium text-gray-500 hidden md:table-cell">Email</th>
                  <th className="pb-3 text-left font-medium text-gray-500 hidden lg:table-cell">Tags</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Opt-in</th>
                  <th className="pb-3 pr-4 sm:pr-0" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonTableRow key={i} cols={7} />
                ))}
              </tbody>
            </table>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-16">
              <Phone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {search ? "No contacts match your search" : "No contacts found"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {search ? "Try a different search term" : "Add contacts or import a CSV file"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 w-8 pl-4 sm:pl-0">
                      <input
                        type="checkbox"
                        checked={contacts.length > 0 && selectedIds.size === contacts.length}
                        ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < contacts.length; }}
                        onChange={toggleSelectAll}
                        className="rounded accent-brand cursor-pointer"
                      />
                    </th>
                    <th className="pb-3 text-left font-medium text-gray-500">Name</th>
                    <th className="pb-3 text-left font-medium text-gray-500">Phone</th>
                    <th className="pb-3 text-left font-medium text-gray-500 hidden md:table-cell">Email</th>
                    <th className="pb-3 text-left font-medium text-gray-500 hidden lg:table-cell">Tags</th>
                    <th className="pb-3 text-left font-medium text-gray-500">Opt-in</th>
                    <th className="pb-3 pr-4 sm:pr-0" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map((c) => (
                    <tr
                      key={c.id}
                      className={clsx(
                        "hover:bg-gray-50/50 transition-colors",
                        selectedIds.has(c.id) && "bg-brand/5"
                      )}
                    >
                      <td className="py-3 pl-4 sm:pl-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded accent-brand cursor-pointer"
                        />
                      </td>
                      <td className="py-3 font-medium text-gray-900">
                        <Link href={`/contacts/${c.id}`} className="hover:text-brand hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-3 text-gray-600 font-mono text-xs">{c.phone}</td>
                      <td className="py-3 text-gray-500 text-xs hidden md:table-cell">{c.email ?? <span className="text-gray-300">—</span>}</td>
                      <td className="py-3 hidden lg:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {c.tags.map((tag) => (
                            <span key={tag} className="badge-gray">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={c.optIn ? "badge-green" : "badge-red"}>
                          {c.optIn ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-4 sm:pr-0">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditContact(c)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages} · {total} contacts
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn-secondary text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="btn-secondary text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
