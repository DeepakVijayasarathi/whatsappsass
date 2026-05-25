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
  } catch {
    // Audit log failures should never break the main flow
  }
}
