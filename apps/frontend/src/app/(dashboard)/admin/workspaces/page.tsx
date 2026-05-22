"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Building2, Users, X, Shield, UserCheck, LogIn, ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { SkeletonTableRow } from "@/components/Skeleton";

interface WorkspaceRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  createdAt: string;
  _count: { users: number; contacts: number; campaigns: number };
}

interface WorkspaceDetail {
  id: string;
  name: string;
  plan: string;
  status: string;
  createdAt: string;
  metaWhatsappEnabled: boolean;
  whatsappProvider: string;
  users: { id: string; name: string; email: string; role: string; createdAt: string }[];
  _count: { contacts: number; campaigns: number; messageLogs: number; emailLogs: number };
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function WorkspaceDrawer({ id, onClose, onUpdate }: { id: string; onClose: () => void; onUpdate: () => void }) {
  const [ws, setWs] = useState<WorkspaceDetail | null>(null);
  const [toggling, setToggling] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/admin/super/workspaces/${id}`).then((r) => setWs(r.data));
  }, [id]);

  const toggleStatus = async () => {
    if (!ws) return;
    setToggling(true);
    const newStatus = ws.status === "active" ? "suspended" : "active";
    try {
      await api.patch(`/admin/super/workspaces/${id}/status`, { status: newStatus });
      toast.success(`Workspace ${newStatus}`);
      setWs((w) => w ? { ...w, status: newStatus } : w);
      onUpdate();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setToggling(false);
    }
  };

  const impersonate = async (userId: string, userName: string) => {
    setImpersonating(userId);
    try {
      const res = await api.post(`/admin/super/impersonate/${userId}`, {});
      // Store impersonation token temporarily for the session
      const originalToken = localStorage.getItem("token");
      localStorage.setItem("token_original", originalToken ?? "");
      localStorage.setItem("token", res.data.token);
      // Store user/workspace from impersonated user
      localStorage.setItem("user", JSON.stringify(res.data.user));
      toast.success(`Impersonating ${userName} — reload to apply`);
    } catch {
      toast.error("Impersonation failed");
    } finally {
      setImpersonating(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-end sm:justify-end">
      <div className="bg-white w-full sm:w-[480px] h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{ws?.name ?? "Loading..."}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Workspace ID: <span className="font-mono">{id.slice(0, 12)}…</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!ws ? (
          <div className="p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="p-5 flex-1 space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Contacts",    value: ws._count.contacts },
                { label: "Campaigns",   value: ws._count.campaigns },
                { label: "WA Messages", value: ws._count.messageLogs },
                { label: "Emails",      value: ws._count.emailLogs },
              ].map(({ label, value }) => (
                <div key={label} className="card p-4 text-center">
                  <p className="text-xl font-bold text-gray-900">{value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Status control */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Workspace Status</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Currently: <span className={ws.status === "active" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{ws.status}</span>
                  </p>
                </div>
                <button
                  onClick={toggleStatus}
                  disabled={toggling}
                  className={ws.status === "active" ? "btn-danger text-sm" : "btn-primary text-sm"}
                >
                  {toggling ? "..." : ws.status === "active" ? "Suspend" : "Activate"}
                </button>
              </div>
            </div>

            {/* Members + impersonation */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-900 mb-3">Members ({ws.users.length})</p>
              <div className="divide-y divide-gray-50">
                {ws.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-600">{u.name[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email} · <span className="capitalize">{u.role}</span></p>
                      </div>
                    </div>
                    <button
                      onClick={() => impersonate(u.id, u.name)}
                      disabled={!!impersonating}
                      className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Impersonate"
                    >
                      {impersonating === u.id ? (
                        <span className="text-xs text-orange-500">…</span>
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuperAdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/admin/super/workspaces").then((r) => setWorkspaces(r.data.workspaces)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      {detailId && <WorkspaceDrawer id={detailId} onClose={() => setDetailId(null)} onUpdate={load} />}

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-orange-500" />
          <h1 className="page-title">Super Admin — Workspaces</h1>
        </div>
        <p className="page-subtitle">Manage all tenants, suspend workspaces, and impersonate users</p>
      </div>

      <div className="card">
        {loading ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="tbl-head">
                {["Workspace", "Plan", "Status", "Members", "Contacts", "Created", ""].map((h) => (
                  <th key={h} className="tbl-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} cols={7} />)}
            </tbody>
          </table>
        ) : workspaces.length === 0 ? (
          <div className="empty-state">
            <Building2 className="empty-icon" />
            <p className="empty-title">No workspaces found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="tbl-head">
                <th className="tbl-th">Workspace</th>
                <th className="tbl-th">Plan</th>
                <th className="tbl-th">Status</th>
                <th className="tbl-th">
                  <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Members</div>
                </th>
                <th className="tbl-th">
                  <div className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" />Contacts</div>
                </th>
                <th className="tbl-th">Created</th>
                <th className="tbl-th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workspaces.map((ws) => (
                <tr
                  key={ws.id}
                  className="tbl-row cursor-pointer"
                  onClick={() => setDetailId(ws.id)}
                >
                  <td className="tbl-td font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-brand/10 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-brand">{ws.name[0].toUpperCase()}</span>
                      </div>
                      {ws.name}
                    </div>
                  </td>
                  <td className="tbl-td">
                    <span className="badge badge-gray uppercase">{ws.plan}</span>
                  </td>
                  <td className="tbl-td">
                    <span className={clsx("badge", ws.status === "active" ? "badge-green" : "badge-red")}>
                      {ws.status}
                    </span>
                  </td>
                  <td className="tbl-td text-gray-600">{ws._count.users}</td>
                  <td className="tbl-td text-gray-600">{ws._count.contacts.toLocaleString()}</td>
                  <td className="tbl-td text-gray-400 text-xs">{new Date(ws.createdAt).toLocaleDateString()}</td>
                  <td className="tbl-td text-right">
                    <ChevronRight className="w-4 h-4 text-gray-300" />
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
