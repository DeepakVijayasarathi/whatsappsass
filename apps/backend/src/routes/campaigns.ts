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

      const stats = await prisma.messageLog.groupBy({
        by: ["status"],
        where: { campaignId: id, workspaceId: user.workspaceId },
        _count: { status: true },
      });

      type StatsRow = { status: string; _count: { status: number } };
      const result = (stats as StatsRow[]).reduce<Record<string, number>>(
        (acc, s) => ({ ...acc, [s.status]: s._count.status }),
        {}
      );

      return reply.send({ campaignId: id, stats: result });
    }
  );
}
