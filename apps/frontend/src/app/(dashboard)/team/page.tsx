"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Trash2, Shield, Users } from "lucide-react";
import clsx from "clsx";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "marketer";
  createdAt: string;
}

const inviteSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  role: z.enum(["admin", "marketer"]),
});
type InviteForm = z.infer<typeof inviteSchema>;

const roleBadge: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  marketer: "bg-gray-100 text-gray-600",
};

const roleLabel: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  marketer: "Marketer",
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const me = getUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "marketer" },
  });

  const load = () => {
    api
      .get("/workspace/members")
      .then((r) => setMembers(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onInvite = async (data: InviteForm) => {
    try {
      await api.post("/workspace/invite", data);
      toast.success(`${data.name} added to workspace`);
      reset();
      setShowInvite(false);
      load();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Invite failed"
      );
    }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await api.patch(`/workspace/members/${id}/role`, { role });
      toast.success("Role updated");
      load();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Failed to update role"
      );
    }
  };

  const removeMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from workspace?`)) return;
    try {
      await api.delete(`/workspace/members/${id}`);
      toast.success(`${name} removed`);
      load();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Failed to remove member"
      );
    }
  };

  const canManage = me?.role === "owner" || me?.role === "admin";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""} in this workspace
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Invite New Member</h2>
          <form onSubmit={handleSubmit(onInvite)} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input {...register("name")} className="input" placeholder="Jane Doe" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input {...register("email")} type="email" className="input" placeholder="jane@company.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary password
              </label>
              <input {...register("password")} type="password" className="input" placeholder="Min 8 characters" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select {...register("role")} className="input">
                <option value="marketer">Marketer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? "Inviting..." : "Send Invite"}
              </button>
              <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members table */}
      <div className="card">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : members.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No members yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-500">Member</th>
                <th className="pb-3 text-left font-medium text-gray-500">Email</th>
                <th className="pb-3 text-left font-medium text-gray-500">Role</th>
                <th className="pb-3 text-left font-medium text-gray-500">Joined</th>
                {canManage && <th className="pb-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.id} className={clsx("hover:bg-gray-50/50", m.id === me?.id && "bg-brand/5")}>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-600">
                          {m.name[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {m.name}
                          {m.id === me?.id && (
                            <span className="ml-2 text-[10px] text-brand font-semibold uppercase tracking-wide">
                              You
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-gray-600">{m.email}</td>
                  <td className="py-3">
                    {canManage && m.role !== "owner" && m.id !== me?.id ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        className={clsx(
                          "text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer",
                          roleBadge[m.role]
                        )}
                      >
                        <option value="admin">Admin</option>
                        <option value="marketer">Marketer</option>
                      </select>
                    ) : (
                      <span className={clsx("badge", roleBadge[m.role])}>
                        {m.role === "owner" && <Shield className="w-3 h-3 mr-1" />}
                        {roleLabel[m.role]}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-gray-400 text-xs">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="py-3 text-right">
                      {m.role !== "owner" && m.id !== me?.id && (
                        <button
                          onClick={() => removeMember(m.id, m.name)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Role legend */}
      <div className="mt-6 card">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Role Permissions</p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { role: "owner", perms: ["Full access", "Manage billing", "Delete workspace"] },
            { role: "admin", perms: ["Manage members", "Manage campaigns", "Toggle WhatsApp"] },
            { role: "marketer", perms: ["View contacts", "Send messages", "View analytics"] },
          ].map(({ role, perms }) => (
            <div key={role}>
              <span className={clsx("badge mb-2", roleBadge[role])}>{roleLabel[role]}</span>
              <ul className="space-y-1 mt-2">
                {perms.map((p) => (
                  <li key={p} className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="text-green-500">✓</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
