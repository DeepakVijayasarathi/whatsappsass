"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const load = () => {
    api
      .get("/contacts?limit=50")
      .then((res) => {
        setContacts(res.data.contacts);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/contacts", {
        name: data.name,
        phone: data.phone,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()) : [],
        optIn: data.optIn ?? false,
      });
      toast.success("Contact added");
      reset();
      setShowForm(false);
      load();
    } catch {
      toast.error("Failed to add contact");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await api.delete(`/contacts/${id}`);
      toast.success("Contact deleted");
      load();
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total contacts</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-4">New Contact</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
              <input {...register("tags")} className="input" placeholder="vip, customer" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input {...register("optIn")} type="checkbox" className="rounded" />
                <span className="text-sm text-gray-700">Opted in to messages</span>
              </label>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12">
            <Phone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No contacts yet. Add your first one.</p>
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
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="py-3 text-gray-600">{c.phone}</td>
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
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
