import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin, checkPermission } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";
import { sendEmail, verifySmtp } from "../lib/email";
import { logAudit } from "../lib/audit";
import { decryptNullable } from "../lib/encrypt";

const PAGE_SIZE = 20;

export async function emailRoutes(app: FastifyInstance) {
  // ── SMTP config test ─────────────────────────────────────────────────────
  app.post("/smtp/test", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const ws = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFromEmail: true, smtpFromName: true },
    });
    const smtpPassPlain = decryptNullable(ws?.smtpPass);
    if (!ws?.smtpHost || !ws.smtpUser || !smtpPassPlain || !ws.smtpFromEmail) {
      return reply.status(400).send({ error: "SMTP not fully configured (host, user, password, and from-email are required)" });
    }
    try {
      await verifySmtp({
        host: ws.smtpHost,
        port: ws.smtpPort ?? 587,
        user: ws.smtpUser,
        pass: smtpPassPlain!,
        fromEmail: ws.smtpFromEmail,
        fromName: ws.smtpFromName,
      });
      return reply.send({ ok: true });
    } catch (err: unknown) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  // ── List email campaigns ─────────────────────────────────────────────────
  app.get("/campaigns", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { page = "1" } = request.query as Record<string, string>;
    const skip = (Number(page) - 1) * PAGE_SIZE;

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where: { workspaceId: user.workspaceId },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.emailCampaign.count({ where: { workspaceId: user.workspaceId } }),
    ]);

    return reply.send({ campaigns, total });
  });

  // ── Create email campaign ────────────────────────────────────────────────
  app.post("/campaigns", { preHandler: [checkPermission("can_send_email")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const schema = z.object({
      name: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
      scheduledAt: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const campaign = await prisma.emailCampaign.create({
      data: {
        workspaceId: user.workspaceId,
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: parsed.data.body,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      },
    });

    await logAudit({ workspaceId: user.workspaceId, userId: user.userId, action: "email_campaign.created", entityType: "email_campaign", entityId: campaign.id, meta: { name: campaign.name } });
    return reply.status(201).send(campaign);
  });

  // ── Update email campaign ────────────────────────────────────────────────
  app.patch("/campaigns/:id", { preHandler: [checkPermission("can_send_email")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().min(1).optional(),
      subject: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      status: z.enum(["draft", "running", "paused", "completed"]).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.emailCampaign.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Campaign not found" });

    const updated = await prisma.emailCampaign.update({ where: { id }, data: parsed.data });
    return reply.send(updated);
  });

  // ── Delete email campaign ────────────────────────────────────────────────
  app.delete("/campaigns/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.emailCampaign.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Campaign not found" });
    await prisma.emailCampaign.delete({ where: { id } });
    return reply.send({ message: "Deleted" });
  });

  // ── Campaign stats ───────────────────────────────────────────────────────
  app.get("/campaigns/:id/stats", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const logs = await prisma.emailLog.findMany({
      where: { campaignId: id, workspaceId: user.workspaceId },
      select: { status: true },
    });

    const stats = (logs as Array<{ status: string }>).reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    return reply.send({ stats, total: logs.length });
  });

  // ── Send single email ────────────────────────────────────────────────────
  app.post("/send", { preHandler: [checkPermission("can_send_email")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const schema = z.object({
      to: z.string().email(),
      subject: z.string().min(1),
      body: z.string().min(1),
      contactId: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const ws = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFromEmail: true, smtpFromName: true },
    });
    const smtpPassPlain = decryptNullable(ws?.smtpPass);
    if (!ws?.smtpHost || !ws.smtpUser || !smtpPassPlain || !ws.smtpFromEmail) {
      return reply.status(400).send({ error: "Email (SMTP) not fully configured. Set host, user, password, and from-email in Settings → Email." });
    }

    await sendEmail(
      { host: ws.smtpHost, port: ws.smtpPort ?? 587, user: ws.smtpUser, pass: smtpPassPlain!, fromEmail: ws.smtpFromEmail, fromName: ws.smtpFromName },
      { to: parsed.data.to, subject: parsed.data.subject, html: parsed.data.body }
    );

    if (parsed.data.contactId) {
      await prisma.emailLog.create({
        data: { workspaceId: user.workspaceId, contactId: parsed.data.contactId, toEmail: parsed.data.to, status: "sent" },
      });
    }

    return reply.send({ message: "Email sent" });
  });

  // ── Send bulk email campaign ─────────────────────────────────────────────
  app.post("/campaigns/:id/send", { preHandler: [checkPermission("can_send_email")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const schema = z.object({ contactIds: z.array(z.string()).optional() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [campaign, ws] = await Promise.all([
      prisma.emailCampaign.findFirst({ where: { id, workspaceId: user.workspaceId } }),
      prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFromEmail: true, smtpFromName: true },
      }),
    ]);

    if (!campaign) return reply.status(404).send({ error: "Campaign not found" });
    if (campaign.status === "running") {
      return reply.status(409).send({ error: "Campaign is already running. Wait for it to complete before re-sending." });
    }
    if (campaign.status === "completed") {
      return reply.status(409).send({ error: "Campaign already completed. Duplicate to re-send." });
    }
    const smtpPassPlain = decryptNullable(ws?.smtpPass);
    if (!ws?.smtpHost || !ws.smtpUser || !smtpPassPlain || !ws.smtpFromEmail) {
      return reply.status(400).send({ error: "Email (SMTP) not fully configured. Set host, user, password, and from-email in Settings → Email." });
    }

    const contactWhere = {
      workspaceId: user.workspaceId,
      optIn: true,
      email: { not: null },
      ...(parsed.data.contactIds?.length ? { id: { in: parsed.data.contactIds } } : {}),
    };

    const contacts = await prisma.contact.findMany({ where: contactWhere, select: { id: true, email: true, name: true } });
    if (contacts.length === 0) return reply.status(400).send({ error: "No opted-in contacts with email addresses" });

    await prisma.emailCampaign.update({ where: { id }, data: { status: "running" } });

    // Return immediately — send emails in the background so large lists don't timeout
    reply.send({ message: "Campaign queued", campaignId: id, total: contacts.length });

    const smtpCfg = { host: ws.smtpHost, port: ws.smtpPort ?? 587, user: ws.smtpUser, pass: smtpPassPlain!, fromEmail: ws.smtpFromEmail, fromName: ws.smtpFromName };
    const workspaceId = user.workspaceId;
    const userId = user.userId;

    setImmediate(async () => {
      let sent = 0;
      let failed = 0;
      try {
        for (const contact of contacts) {
          try {
            await sendEmail(smtpCfg, { to: contact.email!, subject: campaign.subject, html: campaign.body });
            await prisma.emailLog.create({
              data: { workspaceId, campaignId: id, contactId: contact.id, toEmail: contact.email!, status: "sent" },
            });
            sent++;
          } catch {
            await prisma.emailLog.create({
              data: { workspaceId, campaignId: id, contactId: contact.id, toEmail: contact.email!, status: "failed" },
            });
            failed++;
          }
        }
        await prisma.emailCampaign.update({ where: { id }, data: { status: "completed" } });
        await logAudit({ workspaceId, userId, action: "email_campaign.sent", entityType: "email_campaign", entityId: id, meta: { sent, failed, total: contacts.length } });
      } catch (err) {
        // Unexpected crash (e.g. DB connection lost) — roll back status so operator can retry
        console.error(`[email] Campaign ${id} background send crashed:`, err);
        await prisma.emailCampaign.update({ where: { id }, data: { status: "paused" } }).catch(() => {});
      }
    });
  });
}
