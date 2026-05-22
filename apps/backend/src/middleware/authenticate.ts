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

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

export async function requireOwnerOrAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  const user = request.user as JwtPayload;
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
