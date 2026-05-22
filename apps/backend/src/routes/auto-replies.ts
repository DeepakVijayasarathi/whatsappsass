import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

const bodySchema = z.object({
  keyword:      z.string().min(1),
  matchType:    z.enum(["exact", "contains", "starts_with"]).default("exact"),
  templateName: z.string().min(1),
  languageCode: z.string().default("en_US"),
  isActive:     z.boolean().default(true),
});

export async function autoReplyRoutes(app: FastifyInstance) {
  // List
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const rules = await prisma.autoReply.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ rules });
  });

  // Create
  app.post("/", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const rule = await prisma.autoReply.create({
      data: { workspaceId: user.workspaceId, ...parsed.data },
    });
    return reply.status(201).send(rule);
  });

  // Update
  app.patch("/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const parsed = bodySchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.autoReply.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.autoReply.update({ where: { id }, data: parsed.data });
    return reply.send(updated);
  });

  // Delete
  app.delete("/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.autoReply.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    await prisma.autoReply.delete({ where: { id } });
    return reply.send({ message: "Deleted" });
  });
}
