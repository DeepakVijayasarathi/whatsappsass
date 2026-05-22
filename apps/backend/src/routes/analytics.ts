import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

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

    const statusBreakdown = messagesByStatus.reduce(
      (acc, s) => ({ ...acc, [s.status]: s._count.status }),
      {} as Record<string, number>
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
    const { days = "7" } = request.query as { days?: string };

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const logs = await prisma.messageLog.findMany({
      where: {
        workspaceId: user.workspaceId,
        createdAt: { gte: since },
      },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const VALID_STATUSES = new Set(["sent", "delivered", "read", "failed"]);
    const grouped = logs.reduce(
      (acc, log) => {
        const date = log.createdAt.toISOString().split("T")[0];
        if (!acc[date]) acc[date] = { sent: 0, delivered: 0, read: 0, failed: 0 };
        const key = VALID_STATUSES.has(log.status) ? log.status : "sent";
        acc[date][key] = (acc[date][key] || 0) + 1;
        return acc;
      },
      {} as Record<string, Record<string, number>>
    );

    return reply.send({ days: Number(days), data: grouped });
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

    const tagCounts = byTag.reduce(
      (acc, c) => {
        for (const tag of c.tags) {
          acc[tag] = (acc[tag] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return reply.send({ total, optedIn, tagCounts });
  });
}
