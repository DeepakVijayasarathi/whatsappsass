"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Phone, Upload, Download, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";

interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  optIn: boolean;
}

const schema = z.object({
  name: z.string().min(1, "Name required"),
  phone: z.string().min(7, "Valid phone required"),
  tags: z.string().optional(),
  optIn: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

type Tab = "list" | "add" | "import";

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<Tab>("list");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const load = () => {
    setLoading(true);
    api.get("/contacts?limit=100").then((res) => {
      setContacts(res.data.contacts);
      setTotal(res.data.total);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/contacts", {
        name: data.name,
        phone: data.phone,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        optIn: data.optIn ?? false,
      });
      toast.success("Contact added");
      reset();
      setTab("list");
      load();
    } catch {
      toast.error("Failed to add contact");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await api.delete(`/contacts/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Failed to delete");
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
      load();
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "list", label: `All Contacts (${total})` },
    { id: "add", label: "Add Contact" },
    { id: "import", label: "Import CSV" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total contacts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("import")} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setTab("add")} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Contact
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
          <div className="mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input max-w-sm"
              placeholder="Search by name or phone..."
            />
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Phone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No contacts found</p>
              <p className="text-gray-400 text-sm mt-1">Add contacts or import a CSV file</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 text-left font-medium text-gray-500">Name</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Phone</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Tags</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Opt-in</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="py-3 text-gray-600 font-mono text-xs">{c.phone}</td>
                    <td className="py-3">
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
                    <td className="py-3 text-right">
                      <button onClick={() => handleDelete(c.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
