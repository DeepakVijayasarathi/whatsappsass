import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

type LogRow = { status: string; createdAt: Date };
type GroupByStatusRow = { status: string; _count: { status: number } };
type TagRow = { tags: string[] };

// Fill in zero-count dates so charts have continuous axes
function fillDates(byDate: Record<string, number>, since: Date, until: Date): { date: string; count: number }[] {
  const result: { date: string; count: number }[] = [];
  const cursor = new Date(since);
  while (cursor <= until) {
    const dateStr = cursor.toISOString().split("T")[0];
    result.push({ date: dateStr, count: byDate[dateStr] ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/overview", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalContacts,
      totalCampaigns,
      totalMessages,
      messagesByStatus,
      messagesThisWeek,
      messagesPrevWeek,
      contactsThisWeek,
      contactsPrevWeek,
    ] = await Promise.all([
      prisma.contact.count({ where: { workspaceId: user.workspaceId } }),
      prisma.campaign.count({ where: { workspaceId: user.workspaceId } }),
      prisma.messageLog.count({ where: { workspaceId: user.workspaceId } }),
      prisma.messageLog.groupBy({
        by: ["status"],
        where: { workspaceId: user.workspaceId },
        _count: { status: true },
      }),
      prisma.messageLog.count({ where: { workspaceId: user.workspaceId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.messageLog.count({ where: { workspaceId: user.workspaceId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      prisma.contact.count({ where: { workspaceId: user.workspaceId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.contact.count({ where: { workspaceId: user.workspaceId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    ]);

    const calcTrend = (current: number, prev: number): number | null =>
      prev === 0 ? null : Math.round(((current - prev) / prev) * 100);

    const statusBreakdown = (messagesByStatus as GroupByStatusRow[]).reduce<Record<string, number>>(
      (acc, s) => ({ ...acc, [s.status]: s._count.status }),
      {}
    );

    return reply.send({
      totalContacts,
      totalCampaigns,
      totalMessages,
      messagesByStatus: statusBreakdown,
      trends: {
        messagesThisWeek,
        messagesTrend: calcTrend(messagesThisWeek, messagesPrevWeek),
        contactsThisWeek,
        contactsTrend: calcTrend(contactsThisWeek, contactsPrevWeek),
      },
    });
  });

  app.get("/messages", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { days = "7", from, to } = request.query as { days?: string; from?: string; to?: string };

    let since: Date;
    let until: Date = new Date();
    if (from && to) {
      since = new Date(from);
      // End-of-day in UTC: set to 23:59:59.999 UTC to include the full `to` date
      until = new Date(to.split("T")[0] + "T23:59:59.999Z");
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
      until = new Date(to.split("T")[0] + "T23:59:59.999Z");
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
        take: 10_000,
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

  // ── Campaign funnel ─────────────────────────────────────────────────────────
  app.get("/funnel/:campaignId", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { campaignId } = request.params as { campaignId: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: user.workspaceId },
      select: { id: true, name: true, template: true, status: true, createdAt: true },
    });
    if (!campaign) return reply.status(404).send({ error: "Campaign not found" });

    const [sentTotal, delivered, read, failed, replies] = await Promise.all([
      prisma.messageLog.count({ where: { campaignId, workspaceId: user.workspaceId } }),
      prisma.messageLog.count({ where: { campaignId, workspaceId: user.workspaceId, status: "delivered" } }),
      prisma.messageLog.count({ where: { campaignId, workspaceId: user.workspaceId, status: "read" } }),
      prisma.messageLog.count({ where: { campaignId, workspaceId: user.workspaceId, status: "failed" } }),
      prisma.inboundMessage.count({ where: { campaignId, workspaceId: user.workspaceId } }),
    ]);

    const pct = (n: number) => sentTotal > 0 ? Math.round((n / sentTotal) * 100) : 0;

    return reply.send({
      campaignId,
      campaign,
      funnel: {
        sent:      { count: sentTotal,         rate: 100 },
        delivered: { count: delivered,          rate: pct(delivered) },
        read:      { count: read,              rate: pct(read) },
        replied:   { count: replies,           rate: pct(replies) },
        failed:    { count: failed,            rate: pct(failed) },
      },
    });
  });

  // ── Contact growth over time ────────────────────────────────────────────────
  app.get("/contact-growth", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { days = "30" } = request.query as { days?: string };
    const n = Math.min(365, Math.max(1, Number(days)));

    const since = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const until = new Date();

    const [newContacts, totalBefore] = await Promise.all([
      prisma.contact.findMany({
        where: { workspaceId: user.workspaceId, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.contact.count({ where: { workspaceId: user.workspaceId, createdAt: { lt: since } } }),
    ]);

    const byDate: Record<string, number> = {};
    for (const c of newContacts) {
      const d = c.createdAt.toISOString().split("T")[0];
      byDate[d] = (byDate[d] ?? 0) + 1;
    }

    const daily = fillDates(byDate, since, until);
    let cumulative = totalBefore;
    const data = daily.map((d) => {
      cumulative += d.count;
      return { date: d.date, newContacts: d.count, cumulative };
    });

    return reply.send({ data, totalBefore, days: n });
  });

  // ── Send-time heatmap (weekday × hour) ─────────────────────────────────────
  app.get("/heatmap", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const logs = await prisma.messageLog.findMany({
      where: { workspaceId: user.workspaceId, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    // heatmap[weekday 0-6][hour 0-23]
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let maxVal = 0;
    for (const { createdAt } of logs) {
      const wd = createdAt.getDay();
      const hr = createdAt.getHours();
      heatmap[wd][hr]++;
      if (heatmap[wd][hr] > maxVal) maxVal = heatmap[wd][hr];
    }

    return reply.send({ heatmap, maxVal, totalMessages: logs.length, days: 90 });
  });
}
