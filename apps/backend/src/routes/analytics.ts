import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

type LogRow = { status: string; createdAt: Date };
type GroupByStatusRow = { status: string; _count: { status: number } };
type TagRow = { tags: string[] };

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/overview", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const [totalContacts, totalCampaigns, totalMessages, messagesByStatus] =
      await Promise.all([
        prisma.contact.count({ where: { workspaceId: user.workspaceId } }),
        prisma.campaign.count({ where: { workspaceId: user.workspaceId } }),
        prisma.messageLog.count({ where: { workspaceId: user.workspaceId } }),
        prisma.messageLog.groupBy({
          by: ["status"],
          where: { workspaceId: user.workspaceId },
          _count: { status: true },
        }),
      ]);

    const statusBreakdown = (messagesByStatus as GroupByStatusRow[]).reduce<Record<string, number>>(
      (acc, s) => ({ ...acc, [s.status]: s._count.status }),
      {}
    );

    return reply.send({
      totalContacts,
      totalCampaigns,
      totalMessages,
      messagesByStatus: statusBreakdown,
    });
  });

  app.get("/messages", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { days = "7", from, to } = request.query as { days?: string; from?: string; to?: string };

    let since: Date;
    let until: Date = new Date();
    if (from && to) {
      since = new Date(from);
      until = new Date(to);
      until.setHours(23, 59, 59, 999);
    } else {
      since = new Date();
      since.setDate(since.getDate() - Number(days));
    }

    const logs = await prisma.messageLog.findMany({
      where: {
        workspaceId: user.workspaceId,
        createdAt: { gte: since, lte: until },
      },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const VALID_STATUSES = new Set(["sent", "delivered", "read", "failed"]);
    const grouped = (logs as LogRow[]).reduce<Record<string, Record<string, number>>>(
      (acc, log) => {
        const date = log.createdAt.toISOString().split("T")[0];
        if (!acc[date]) acc[date] = { sent: 0, delivered: 0, read: 0, failed: 0 };
        const key = VALID_STATUSES.has(log.status) ? log.status : "sent";
        acc[date][key] = (acc[date][key] || 0) + 1;
        return acc;
      },
      {}
    );

    return reply.send({ days: Number(days), from: since.toISOString(), to: until.toISOString(), data: grouped });
  });

  // ── Export analytics as CSV ────────────────────────────────────────────────
  app.get("/export", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { from, to, days = "30" } = request.query as { from?: string; to?: string; days?: string };

    let since: Date;
    let until: Date = new Date();
    if (from && to) {
      since = new Date(from);
      until = new Date(to);
      until.setHours(23, 59, 59, 999);
    } else {
      since = new Date();
      since.setDate(since.getDate() - Number(days));
    }

    const logs = await prisma.messageLog.findMany({
      where: { workspaceId: user.workspaceId, createdAt: { gte: since, lte: until } },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const grouped = (logs as LogRow[]).reduce<Record<string, Record<string, number>>>((acc, log) => {
      const date = log.createdAt.toISOString().split("T")[0];
      if (!acc[date]) acc[date] = { sent: 0, delivered: 0, read: 0, failed: 0 };
      const key = ["sent","delivered","read","failed"].includes(log.status) ? log.status : "sent";
      acc[date][key] = (acc[date][key] || 0) + 1;
      return acc;
    }, {});

    const header = "date,sent,delivered,read,failed";
    const rows = Object.entries(grouped).map(([date, s]) =>
      `${date},${s.sent ?? 0},${s.delivered ?? 0},${s.read ?? 0},${s.failed ?? 0}`
    );

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="analytics-${Date.now()}.csv"`)
      .send([header, ...rows].join("\n"));
  });

  app.get("/contacts", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const [total, optedIn, byTag] = await Promise.all([
      prisma.contact.count({ where: { workspaceId: user.workspaceId } }),
      prisma.contact.count({ where: { workspaceId: user.workspaceId, optIn: true } }),
      prisma.contact.findMany({
        where: { workspaceId: user.workspaceId },
        select: { tags: true },
      }),
    ]);

    const tagCounts = (byTag as TagRow[]).reduce<Record<string, number>>(
      (acc, c) => {
        for (const tag of c.tags) {
          acc[tag] = (acc[tag] || 0) + 1;
        }
        return acc;
      },
      {}
    );

    return reply.send({ total, optedIn, tagCounts });
  });
}
