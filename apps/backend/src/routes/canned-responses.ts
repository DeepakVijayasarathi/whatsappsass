import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

const schema = z.object({
  title:    z.string().min(1).max(100),
  body:     z.string().min(1).max(1000),
  shortcut: z.string().max(30).optional().transform((v) => v?.trim() || undefined),
});

export async function cannedResponseRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { search } = request.query as { search?: string };

    const responses = await prisma.cannedResponse.findMany({
      where: {
        workspaceId: user.workspaceId,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { body: { contains: search, mode: "insensitive" as const } },
                { shortcut: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ responses });
  });

  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const response = await prisma.cannedResponse.create({
      data: { ...parsed.data, workspaceId: user.workspaceId },
    });

    return reply.status(201).send(response);
  });

  app.patch("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const parsed = schema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.cannedResponse.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.cannedResponse.update({ where: { id }, data: parsed.data });
    return reply.send(updated);
  });

  app.delete("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const existing = await prisma.cannedResponse.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await prisma.cannedResponse.delete({ where: { id } });
    return reply.send({ message: "Deleted" });
  });
}
