import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin, checkPermission } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";
import { parsePagination } from "../lib/queryParams";

const campaignSchema = z.object({
  name: z.string().min(1),
  template: z.string().min(1),
  languageCode: z.string().default("en_US"),
  scheduledAt: z.string().datetime().optional(),
});

export async function campaignRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { status, search, ...pageQuery } = request.query as Record<string, string>;
    const { page, limit, skip } = parsePagination(pageQuery);

    const where = {
      workspaceId: user.workspaceId,
      ...(status ? { status } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" as const },
      }),
      prisma.campaign.count({ where }),
    ]);

    return reply.send({ campaigns, total, page, limit });
  });

  app.post(
    "/",
    { preHandler: [checkPermission("can_run_campaigns")] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const parsed = campaignSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const campaign = await prisma.campaign.create({
        data: {
          ...parsed.data,
          scheduledAt: parsed.data.scheduledAt
            ? new Date(parsed.data.scheduledAt)
            : null,
          workspaceId: user.workspaceId,
          status: "draft",
        },
      });

      return reply.status(201).send(campaign);
    }
  );

  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!campaign) return reply.status(404).send({ error: "Campaign not found" });

    return reply.send(campaign);
  });

  app.patch(
    "/:id",
    { preHandler: [checkPermission("can_run_campaigns")] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const schema = campaignSchema.partial().extend({
        status: z.enum(["draft", "running", "paused", "completed"]).optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const existing = await prisma.campaign.findFirst({
        where: { id, workspaceId: user.workspaceId },
      });
      if (!existing) return reply.status(404).send({ error: "Campaign not found" });

      const campaign = await prisma.campaign.update({
        where: { id },
        data: {
          ...parsed.data,
          scheduledAt: parsed.data.scheduledAt
            ? new Date(parsed.data.scheduledAt)
            : undefined,
        },
      });

      return reply.send(campaign);
    }
  );

  app.delete(
    "/:id",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const existing = await prisma.campaign.findFirst({
        where: { id, workspaceId: user.workspaceId },
      });
      if (!existing) return reply.status(404).send({ error: "Campaign not found" });
      if (existing.status === "running") {
        return reply.status(409).send({ error: "Cannot delete a running campaign. Pause it first." });
      }

      await prisma.campaign.delete({ where: { id } });

      return reply.send({ message: "Campaign deleted" });
    }
  );

  // ── Duplicate campaign ────────────────────────────────────────────────────
  app.post(
    "/:id/duplicate",
    { preHandler: [checkPermission("can_run_campaigns")] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const existing = await prisma.campaign.findFirst({
        where: { id, workspaceId: user.workspaceId },
      });
      if (!existing) return reply.status(404).send({ error: "Campaign not found" });

      const copy = await prisma.campaign.create({
        data: {
          name: `${existing.name} (copy)`,
          template: existing.template,
          languageCode: existing.languageCode,
          workspaceId: user.workspaceId,
          status: "draft",
          scheduledAt: null,
        },
      });

      return reply.status(201).send(copy);
    }
  );

  app.get(
    "/:id/stats",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const campaign = await prisma.campaign.findFirst({
        where: { id, workspaceId: user.workspaceId },
      });
      if (!campaign) return reply.status(404).send({ error: "Campaign not found" });

      const [stats, replies] = await Promise.all([
        prisma.messageLog.groupBy({
          by: ["status"],
          where: { campaignId: id, workspaceId: user.workspaceId },
          _count: { status: true },
        }),
        // Replies attributed to this campaign (inbound messages linked to it)
        prisma.inboundMessage.count({ where: { campaignId: id, workspaceId: user.workspaceId } }),
      ]);

      type StatsRow = { status: string; _count: { status: number } };
      const byStatus = (stats as StatsRow[]).reduce<Record<string, number>>(
        (acc, s) => ({ ...acc, [s.status]: s._count.status }),
        {}
      );

      // Build a delivery funnel. read implies delivered implies sent, but providers
      // don't always emit every intermediate event, so we treat the counts as the
      // furthest stage each message reached and roll them up for the funnel view.
      const sent = byStatus.sent ?? 0;
      const delivered = byStatus.delivered ?? 0;
      const read = byStatus.read ?? 0;
      const failed = byStatus.failed ?? 0;
      const totalAttempted = sent + delivered + read + failed;
      const totalSent = sent + delivered + read; // everything that left successfully
      const reachedDelivered = delivered + read; // delivered or beyond
      const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

      return reply.send({
        campaignId: id,
        stats: byStatus,
        funnel: {
          attempted: totalAttempted,
          sent: totalSent,
          delivered: reachedDelivered,
          read,
          failed,
          replies,
          rates: {
            deliveryRate: pct(reachedDelivered, totalSent),
            readRate: pct(read, totalSent),
            failureRate: pct(failed, totalAttempted),
            replyRate: pct(replies, totalSent),
          },
        },
      });
    }
  );

  // ── Per-recipient CSV export ──────────────────────────────────────────────
  app.get(
    "/:id/export",
    { preHandler: [checkPermission("can_export")] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const campaign = await prisma.campaign.findFirst({
        where: { id, workspaceId: user.workspaceId },
        select: { id: true, name: true },
      });
      if (!campaign) return reply.status(404).send({ error: "Campaign not found" });

      const EXPORT_LIMIT = 50_000;
      const logs = await prisma.messageLog.findMany({
        where: { campaignId: id, workspaceId: user.workspaceId },
        orderBy: { createdAt: "asc" },
        take: EXPORT_LIMIT,
        select: {
          status: true,
          wamid: true,
          createdAt: true,
          contact: { select: { name: true, phone: true, email: true } },
        },
      });

      // Escape for CSV and neutralise spreadsheet formula injection (leading = + - @).
      const escape = (v: string) => {
        const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
        return `"${safe.replace(/"/g, '""').replace(/[\r\n]/g, " ")}"`;
      };
      const header = ["contact_name", "phone", "email", "status", "wamid", "sent_at"].join(",");
      const rows = logs.map((l) =>
        [
          escape(l.contact?.name ?? ""),
          escape(l.contact?.phone ?? ""),
          escape(l.contact?.email ?? ""),
          escape(l.status),
          escape(l.wamid ?? ""),
          escape(l.createdAt.toISOString()),
        ].join(",")
      );
      const csv = [header, ...rows].join("\n");

      const slug = campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="campaign-${slug}-${Date.now()}.csv"`)
        .send(csv);
    }
  );
}
