"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ClipboardList, User, Clock } from "lucide-react";
import { SkeletonTableRow } from "@/components/Skeleton";

interface AuditLog {
  id: string;
  action: string;
  userEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  "contact.created": "text-green-600 bg-green-50",
  "email_campaign.created": "text-blue-600 bg-blue-50",
  "email_campaign.sent": "text-brand bg-brand/10",
  "member.permissions_updated": "text-purple-600 bg-purple-50",
  "workspace.suspended": "text-red-600 bg-red-50",
  "workspace.active": "text-green-600 bg-green-50",
  "super.impersonated_user": "text-orange-600 bg-orange-50",
};

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback((p: number) => {
    setLoading(true);
    api.get(`/admin/audit-log?page=${p}&limit=${PAGE_SIZE}`)
      .then((r) => { setLogs(r.data.logs); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-500 text-sm mt-1">All actions taken within this workspace</p>
      </div>

      <div className="card">
        {loading ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Action", "User", "Entity", "Details", "Time"].map((h) => (
                  <th key={h} className="pb-3 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonTableRow key={i} cols={5} />)}
            </tbody>
          </table>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No activity yet</p>
            <p className="text-gray-400 text-sm mt-1">Actions will appear here as your team uses the workspace</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-500">Action</th>
                <th className="pb-3 text-left font-medium text-gray-500">User</th>
                <th className="pb-3 text-left font-medium text-gray-500">Entity</th>
                <th className="pb-3 text-left font-medium text-gray-500">Details</th>
                <th className="pb-3 text-left font-medium text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const colorClass = actionColors[log.action] ?? "text-gray-600 bg-gray-50";
                return (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-3 h-3 text-gray-500" />
                        </div>
                        <span className="text-gray-600 text-xs">{log.userEmail ?? "system"}</span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">
                      {log.entityType ? (
                        <span>
                          <span className="capitalize">{log.entityType}</span>
                          {log.entityId && <span className="text-gray-300 ml-1 font-mono">{log.entityId.slice(0, 8)}…</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 max-w-xs">
                      {log.meta && Object.keys(log.meta).length > 0 ? (
                        <code className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded truncate block">
                          {JSON.stringify(log.meta)}
                        </code>
                      ) : "—"}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} · {total} entries</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm disabled:opacity-40">Previous</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
