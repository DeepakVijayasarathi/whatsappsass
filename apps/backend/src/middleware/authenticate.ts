import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";

export interface JwtPayload {
  userId: string;
  workspaceId: string;
  role: string;
  superAdmin?: boolean;
  impersonatedBy?: string;
}

// Default permissions by role — used when user.permissions is null/missing a key
const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  owner:    { can_send_whatsapp: true, can_send_email: true, can_manage_contacts: true, can_run_campaigns: true, can_view_analytics: true, can_export: true, can_manage_templates: true },
  admin:    { can_send_whatsapp: true, can_send_email: true, can_manage_contacts: true, can_run_campaigns: true, can_view_analytics: true, can_export: true, can_manage_templates: true },
  marketer: { can_send_whatsapp: true, can_send_email: true, can_manage_contacts: false, can_run_campaigns: true, can_view_analytics: true, can_export: false, can_manage_templates: false },
};

// ── Workspace status cache ───────────────────────────────────────────────────
// A valid JWT lives 7 days and carries no live state, so without this check a
// suspended workspace (or deleted user) keeps full access until the token
// expires. We re-check on every request, but cache the result briefly to avoid
// a DB round-trip per request. TTL is short so suspension takes effect quickly.
const WORKSPACE_STATUS_TTL_MS = 30_000;
const workspaceStatusCache = new Map<string, { status: string; expiresAt: number }>();

/** Invalidate a cached workspace status — call when a workspace is suspended/reactivated
 *  so the change takes effect immediately rather than after the TTL. */
export function invalidateWorkspaceStatus(workspaceId: string) {
  workspaceStatusCache.delete(workspaceId);
}

async function getWorkspaceStatus(workspaceId: string): Promise<string | null> {
  const now = Date.now();
  const cached = workspaceStatusCache.get(workspaceId);
  if (cached && cached.expiresAt > now) return cached.status;

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { status: true },
  });
  if (!ws) return null;
  workspaceStatusCache.set(workspaceId, { status: ws.status, expiresAt: now + WORKSPACE_STATUS_TTL_MS });
  return ws.status;
}

/** Verify the JWT signature AND that the bearer's workspace is still active.
 *  This is the choke point that makes workspace suspension effective mid-session. */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const user = request.user as JwtPayload;
  const status = await getWorkspaceStatus(user.workspaceId);
  if (status === null) {
    // Workspace no longer exists → token is orphaned.
    return reply.status(401).send({ error: "Unauthorized" });
  }
  if (status !== "active") {
    return reply.status(403).send({ error: "Workspace is suspended" });
  }
}

export async function requireOwnerOrAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  const user = request.user as JwtPayload;
  const status = await getWorkspaceStatus(user.workspaceId);
  if (status === null) return reply.status(401).send({ error: "Unauthorized" });
  if (status !== "active") return reply.status(403).send({ error: "Workspace is suspended" });
  if (!["owner", "admin"].includes(user.role)) {
    return reply.status(403).send({ error: "Forbidden: insufficient role" });
  }
}

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  const jwtUser = request.user as JwtPayload;

  // Check DB for superAdmin flag (JWT may be stale)
  const dbUser = await prisma.user.findUnique({ where: { id: jwtUser.userId }, select: { superAdmin: true } });
  if (!dbUser?.superAdmin) {
    return reply.status(403).send({ error: "Forbidden: super-admin only" });
  }
}

// Returns a preHandler factory that checks a granular permission key.
// Owner is always allowed. Others check user.permissions JSON, falling back to role defaults.
export function checkPermission(key: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const jwtUser = request.user as JwtPayload;

    const status = await getWorkspaceStatus(jwtUser.workspaceId);
    if (status === null) return reply.status(401).send({ error: "Unauthorized" });
    if (status !== "active") return reply.status(403).send({ error: "Workspace is suspended" });

    if (jwtUser.role === "owner") return; // owners bypass all

    const dbUser = await prisma.user.findUnique({
      where: { id: jwtUser.userId },
      select: { role: true, permissions: true },
    });
    if (!dbUser) return reply.status(401).send({ error: "Unauthorized" });

    const perms = (dbUser.permissions as Record<string, boolean> | null) ?? {};
    const allowed = key in perms ? perms[key] : (ROLE_DEFAULTS[dbUser.role]?.[key] ?? false);

    if (!allowed) {
      return reply.status(403).send({ error: `Forbidden: missing permission '${key}'` });
    }
  };
}
