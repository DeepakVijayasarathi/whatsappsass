import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin, requireSuperAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";
import { logAudit } from "../lib/audit";

export async function adminRoutes(app: FastifyInstance) {
  // ── Audit log ────────────────────────────────────────────────────────────
  app.get("/audit-log", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { page = "1", limit = "50" } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { workspaceId: user.workspaceId },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.auditLog.count({ where: { workspaceId: user.workspaceId } }),
    ]);

    return reply.send({ logs, total });
  });

  // ── Workspace usage metrics ──────────────────────────────────────────────
  app.get("/metrics", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const [contacts, campaigns, emailCampaigns, messages, emailLogs, members] = await Promise.all([
      prisma.contact.count({ where: { workspaceId: user.workspaceId } }),
      prisma.campaign.count({ where: { workspaceId: user.workspaceId } }),
      prisma.emailCampaign.count({ where: { workspaceId: user.workspaceId } }),
      prisma.messageLog.groupBy({ by: ["status"], where: { workspaceId: user.workspaceId }, _count: { status: true } }),
      prisma.emailLog.groupBy({ by: ["status"], where: { workspaceId: user.workspaceId }, _count: { status: true } }),
      prisma.user.count({ where: { workspaceId: user.workspaceId } }),
    ]);

    type StatusRow = { status: string; _count: { status: number } };
    const msgByStatus = (messages as StatusRow[]).reduce<Record<string, number>>((acc, r) => { acc[r.status] = r._count.status; return acc; }, {});
    const emailByStatus = (emailLogs as StatusRow[]).reduce<Record<string, number>>((acc, r) => { acc[r.status] = r._count.status; return acc; }, {});

    const totalWhatsapp = Object.values(msgByStatus).reduce((a, b) => a + b, 0);
    const totalEmail = Object.values(emailByStatus).reduce((a, b) => a + b, 0);

    return reply.send({
      contacts,
      campaigns,
      emailCampaigns,
      members,
      whatsappMessages: msgByStatus,
      emailMessages: emailByStatus,
      totalWhatsapp,
      totalEmail,
    });
  });

  // ── Update member permissions ────────────────────────────────────────────
  app.patch("/members/:id/permissions", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const actor = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const schema = z.object({
      can_send_whatsapp:     z.boolean().optional(),
      can_send_email:        z.boolean().optional(),
      can_manage_contacts:   z.boolean().optional(),
      can_run_campaigns:     z.boolean().optional(),
      can_view_analytics:    z.boolean().optional(),
      can_export:            z.boolean().optional(),
      can_manage_templates:  z.boolean().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const target = await prisma.user.findFirst({ where: { id, workspaceId: actor.workspaceId } });
    if (!target) return reply.status(404).send({ error: "Member not found" });
    if (target.role === "owner") return reply.status(403).send({ error: "Cannot restrict the owner" });

    const current = (target.permissions as Record<string, boolean>) ?? {};
    const updated = await prisma.user.update({
      where: { id },
      data: { permissions: { ...current, ...parsed.data } },
      select: { id: true, name: true, email: true, role: true, permissions: true },
    });

    await logAudit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "member.permissions_updated", entityType: "user", entityId: id, meta: parsed.data });
    return reply.send(updated);
  });

  // ── Get member permissions ───────────────────────────────────────────────
  app.get("/members/:id/permissions", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const actor = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const target = await prisma.user.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      select: { id: true, name: true, role: true, permissions: true },
    });
    if (!target) return reply.status(404).send({ error: "Member not found" });
    return reply.send(target);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER-ADMIN ROUTES — requireSuperAdmin guard
  // ═══════════════════════════════════════════════════════════════════════════

  // ── List all workspaces ──────────────────────────────────────────────────
  app.get("/super/workspaces", { preHandler: [requireSuperAdmin] }, async (_request, reply) => {
    const workspaces = await prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, plan: true, status: true, createdAt: true,
        _count: { select: { users: true, contacts: true, campaigns: true } },
      },
    });
    return reply.send({ workspaces });
  });

  // ── Workspace detail ─────────────────────────────────────────────────────
  app.get("/super/workspaces/:id", { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: {
        id: true, name: true, plan: true, status: true, createdAt: true,
        metaWhatsappEnabled: true, whatsappProvider: true,
        users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        _count: { select: { contacts: true, campaigns: true, messageLogs: true, emailLogs: true } },
      },
    });
    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });
    return reply.send(workspace);
  });

  // ── Update workspace status ──────────────────────────────────────────────
  app.patch("/super/workspaces/:id/status", { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const actor = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const schema = z.object({ status: z.enum(["active", "suspended"]) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const workspace = await prisma.workspace.update({ where: { id }, data: { status: parsed.data.status } });
    await logAudit({ workspaceId: id, userId: actor.userId, action: `workspace.${parsed.data.status}`, entityType: "workspace", entityId: id });
    return reply.send(workspace);
  });

  // ── Impersonate user ─────────────────────────────────────────────────────
  app.post("/super/impersonate/:userId", { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const actor = request.user as JwtPayload;
    const { userId } = request.params as { userId: string };

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, workspaceId: true },
    });
    if (!target) return reply.status(404).send({ error: "User not found" });

    // Short-lived token for impersonation sessions — 1 hour is enough for debugging
    const token = await reply.jwtSign({
      userId: target.id,
      workspaceId: target.workspaceId,
      role: target.role,
      impersonatedBy: actor.userId,
    }, { expiresIn: "1h" });

    await logAudit({ workspaceId: target.workspaceId, userId: actor.userId, action: "super.impersonated_user", entityType: "user", entityId: userId, meta: { targetEmail: target.email } });
    return reply.send({ token, user: target });
  });

  // ── Super-admin global metrics ───────────────────────────────────────────
  app.get("/super/metrics", { preHandler: [requireSuperAdmin] }, async (_request, reply) => {
    const [totalWorkspaces, totalUsers, totalContacts, totalMessages, totalEmails] = await Promise.all([
      prisma.workspace.count(),
      prisma.user.count(),
      prisma.contact.count(),
      prisma.messageLog.count(),
      prisma.emailLog.count(),
    ]);

    return reply.send({ totalWorkspaces, totalUsers, totalContacts, totalMessages, totalEmails });
  });

  // ── Promote user to super-admin (owner-only, only for current workspace owner) ──
  app.post("/super/promote/:userId", { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const actor = request.user as JwtPayload;
    const { userId } = request.params as { userId: string };
    const schema = z.object({ superAdmin: z.boolean() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { superAdmin: parsed.data.superAdmin },
      select: { id: true, email: true, superAdmin: true },
    });

    await logAudit({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: parsed.data.superAdmin ? "super.promoted_user" : "super.demoted_user",
      entityType: "user",
      entityId: userId,
      meta: { targetEmail: updated.email, superAdmin: updated.superAdmin },
    });

    return reply.send(updated);
  });
}
