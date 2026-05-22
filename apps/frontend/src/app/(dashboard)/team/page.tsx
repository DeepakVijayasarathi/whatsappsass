"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Trash2, Shield, Users, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import { SkeletonTableRow } from "@/components/Skeleton";

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-600",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-600",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-600",
  "bg-pink-100 text-pink-600",
];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "marketer";
  createdAt: string;
}

type PermKey = "can_send_whatsapp" | "can_send_email" | "can_manage_contacts" | "can_run_campaigns" | "can_view_analytics" | "can_export" | "can_manage_templates";

interface MemberPermissions {
  id: string;
  name: string;
  role: string;
  permissions: Partial<Record<PermKey, boolean>> | null;
}

const PERM_LABELS: { key: PermKey; label: string; desc: string }[] = [
  { key: "can_send_whatsapp",    label: "Send WhatsApp",    desc: "Send single and bulk WhatsApp messages" },
  { key: "can_send_email",       label: "Send Email",       desc: "Send single emails and run email campaigns" },
  { key: "can_manage_contacts",  label: "Manage Contacts",  desc: "Create, edit, import, and delete contacts" },
  { key: "can_run_campaigns",    label: "Run Campaigns",    desc: "Launch and pause WhatsApp campaigns" },
  { key: "can_view_analytics",   label: "View Analytics",   desc: "Access analytics and metrics pages" },
  { key: "can_export",           label: "Export Data",      desc: "Export contacts and message logs as CSV" },
  { key: "can_manage_templates", label: "Manage Templates", desc: "Sync and view WhatsApp message templates" },
];

const ROLE_DEFAULTS: Record<string, Record<PermKey, boolean>> = {
  admin:    { can_send_whatsapp: true, can_send_email: true, can_manage_contacts: true, can_run_campaigns: true, can_view_analytics: true, can_export: true, can_manage_templates: true },
  marketer: { can_send_whatsapp: true, can_send_email: true, can_manage_contacts: false, can_run_campaigns: true, can_view_analytics: true, can_export: false, can_manage_templates: false },
};

const roleBadge: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  marketer: "bg-gray-100 text-gray-600",
};

const inviteSchema = z.object({
  name:     z.string().min(1, "Name required"),
  email:    z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  role:     z.enum(["admin", "marketer"]),
});
type InviteForm = z.infer<typeof inviteSchema>;

// ── Permissions Modal ─────────────────────────────────────────────────────────
function PermissionsModal({ member, onClose, onSaved }: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [perms, setPerms] = useState<Record<PermKey, boolean> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/admin/members/${member.id}/permissions`).then((r) => {
      const p = (r.data.permissions as Partial<Record<PermKey, boolean>>) ?? {};
      const defaults = ROLE_DEFAULTS[member.role] ?? ROLE_DEFAULTS.marketer;
      const merged: Record<PermKey, boolean> = {} as Record<PermKey, boolean>;
      PERM_LABELS.forEach(({ key }) => {
        merged[key] = key in p ? !!p[key] : defaults[key];
      });
      setPerms(merged);
    });
  }, [member.id, member.role]);

  const toggle = (key: PermKey) => {
    setPerms((prev) => prev ? { ...prev, [key]: !prev[key] } : prev);
  };

  const save = async () => {
    if (!perms) return;
    setSaving(true);
    try {
      await api.patch(`/admin/members/${member.id}/permissions`, perms);
      toast.success("Permissions saved");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    const defaults = ROLE_DEFAULTS[member.role] ?? ROLE_DEFAULTS.marketer;
    setPerms({ ...defaults });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Permissions — {member.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              Role: <span className="font-medium text-gray-600">{member.role}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {!perms ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-14 w-full" />
            ))
          ) : (
            PERM_LABELS.map(({ key, label, desc }) => (
              <div
                key={key}
                className={clsx(
                  "flex items-center justify-between p-3 rounded-xl border-2 transition-colors cursor-pointer",
                  perms[key] ? "border-brand/30 bg-brand/5" : "border-gray-100 hover:border-gray-200"
                )}
                onClick={() => toggle(key)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(key); }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ml-3 ${perms[key] ? "bg-brand" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${perms[key] ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-between">
          <button onClick={resetToDefaults} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Reset to role defaults
          </button>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !perms} className="btn-primary">
              {saving ? "Saving..." : "Save Permissions"}
            </button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permTarget, setPermTarget] = useState<Member | null>(null);
  const me = getUser();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "marketer" },
  });

  const load = () => {
    api.get("/workspace/members").then((r) => setMembers(r.data)).finally(() => setLoading(false));
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
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || "Invite failed");
    }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await api.patch(`/workspace/members/${id}/role`, { role });
      toast.success("Role updated");
      load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to update role");
    }
  };

  const removeMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from workspace?`)) return;
    try {
      await api.delete(`/workspace/members/${id}`);
      toast.success(`${name} removed`);
      load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to remove member");
    }
  };

  const canManage = me?.role === "owner" || me?.role === "admin";

  return (
    <div>
      {permTarget && (
        <PermissionsModal member={permTarget} onClose={() => setPermTarget(null)} onSaved={load} />
      )}

      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{members.length} member{members.length !== 1 ? "s" : ""} in this workspace</p>
        </div>
        {canManage && (
          <button onClick={() => setShowInvite(!showInvite)} className="btn-primary flex items-center gap-2 shrink-0">
            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Invite Member</span><span className="sm:hidden">Invite</span>
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Invite New Member</h2>
          <form onSubmit={handleSubmit(onInvite)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password</label>
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
              <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Members table */}
      <div className="card">
        {loading ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="tbl-head">
                {["Member", "Email", "Role", "Joined", ""].map((h) => (
                  <th key={h} className="tbl-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonTableRow key={i} cols={5} />)}
            </tbody>
          </table>
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <Users className="empty-icon" />
            <p className="empty-title">No members yet</p>
            <p className="empty-desc">Invite team members to collaborate in this workspace</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="tbl-head">
                <th className="tbl-th pl-4 sm:pl-0">Member</th>
                <th className="tbl-th hidden sm:table-cell">Email</th>
                <th className="tbl-th">Role</th>
                <th className="tbl-th hidden md:table-cell">Joined</th>
                {canManage && <th className="tbl-th text-right pr-4 sm:pr-0">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.id} className={clsx("hover:bg-gray-50/50", m.id === me?.id && "bg-brand/5")}>
                  <td className="py-3 pl-4 sm:pl-0">
                    <div className="flex items-center gap-3">
                      <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center shrink-0", avatarColor(m.name))}>
                        <span className="text-xs font-bold">{m.name[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {m.name}
                          {m.id === me?.id && (
                            <span className="ml-2 text-[10px] text-brand font-semibold uppercase tracking-wide">You</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-gray-600 hidden sm:table-cell">{m.email}</td>
                  <td className="py-3">
                    {canManage && m.role !== "owner" && m.id !== me?.id ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        className={clsx("text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer", roleBadge[m.role])}
                      >
                        <option value="admin">Admin</option>
                        <option value="marketer">Marketer</option>
                      </select>
                    ) : (
                      <span className={clsx("badge", roleBadge[m.role])}>
                        {m.role === "owner" && <Shield className="w-3 h-3 mr-1" />}
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-gray-400 text-xs hidden md:table-cell">{new Date(m.createdAt).toLocaleDateString()}</td>
                  {canManage && (
                    <td className="py-3 text-right pr-4 sm:pr-0">
                      <div className="flex items-center justify-end gap-1">
                        {m.role !== "owner" && (
                          <button
                            onClick={() => setPermTarget(m)}
                            className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Manage permissions"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                        )}
                        {m.role !== "owner" && m.id !== me?.id && (
                          <button
                            onClick={() => removeMember(m.id, m.name)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Role legend */}
      <div className="mt-6 card">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Role Defaults</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {[
            { role: "owner", perms: ["Full access (all permissions)", "Manage billing", "Delete workspace"] },
            { role: "admin", perms: ["All permissions by default", "Can be restricted per-user", "Manage members & settings"] },
            { role: "marketer", perms: ["Send messages by default", "Cannot manage contacts by default", "Can be expanded per-user"] },
          ].map(({ role, perms }) => (
            <div key={role}>
              <span className={clsx("badge mb-2", roleBadge[role])}>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
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
