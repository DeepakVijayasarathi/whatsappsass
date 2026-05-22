import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

const campaignSchema = z.object({
  name: z.string().min(1),
  template: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});

export async function campaignRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { page = "1", limit = "20", status } = request.query as Record<string, string>;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      workspaceId: user.workspaceId,
      ...(status ? { status } : {}),
    };

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.campaign.count({ where }),
    ]);

    return reply.send({ campaigns, total, page: Number(page), limit: Number(limit) });
  });

  app.post(
    "/",
    { preHandler: [requireOwnerOrAdmin] },
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
    { preHandler: [requireOwnerOrAdmin] },
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

      await prisma.campaign.delete({ where: { id } });

      return reply.send({ message: "Campaign deleted" });
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

      const stats = await prisma.messageLog.groupBy({
        by: ["status"],
        where: { campaignId: id, workspaceId: user.workspaceId },
        _count: { status: true },
      });

      const result = stats.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count.status }),
        {} as Record<string, number>
      );

      return reply.send({ campaignId: id, stats: result });
    }
  );
}
