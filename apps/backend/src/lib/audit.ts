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
        meta: opts.meta ?? null,
      },
    });
  } catch {
    // Audit log failures should never break the main flow
  }
}
