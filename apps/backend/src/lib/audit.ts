import { prisma } from "./prisma";

interface AuditOptions {
  workspaceId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export async function logAudit(opts: AuditOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: opts.workspaceId,
        userId: opts.userId ?? null,
        userEmail: opts.userEmail ?? null,
        action: opts.action,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        // JSON field — cast to any to satisfy Prisma's Json type across versions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        meta: opts.meta !== undefined ? (opts.meta as any) : undefined,
      },
    });
  } catch (err) {
    // Audit log failures must never break the main flow, but we log to stderr
    // so DB outages are observable in container logs (grep for "[audit]").
    console.error("[audit] Failed to write audit log:", (err as Error).message, { action: opts.action, workspaceId: opts.workspaceId });
  }
}
