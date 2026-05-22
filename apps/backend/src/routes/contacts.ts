import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  tags: z.array(z.string()).optional().default([]),
  optIn: z.boolean().optional().default(false),
});

export async function contactRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { page = "1", limit = "20", tag, search } = request.query as Record<string, string>;

    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      workspaceId: user.workspaceId,
      ...(tag ? { tags: { has: tag } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { name: "asc" },
      }),
      prisma.contact.count({ where }),
    ]);

    return reply.send({ contacts, total, page: Number(page), limit: Number(limit) });
  });

  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = contactSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const contact = await prisma.contact.create({
      data: { ...parsed.data, workspaceId: user.workspaceId },
    });

    return reply.status(201).send(contact);
  });

  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const contact = await prisma.contact.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });

    if (!contact) return reply.status(404).send({ error: "Contact not found" });

    return reply.send(contact);
  });

  app.patch("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const parsed = contactSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.contact.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Contact not found" });

    const contact = await prisma.contact.update({
      where: { id },
      data: parsed.data,
    });

    return reply.send(contact);
  });

  app.delete("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const existing = await prisma.contact.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Contact not found" });

    await prisma.contact.delete({ where: { id } });

    return reply.send({ message: "Contact deleted" });
  });

  app.post("/bulk", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const schema = z.object({ contacts: z.array(contactSchema).min(1).max(500) });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const result = await prisma.contact.createMany({
      data: parsed.data.contacts.map((c) => ({
        ...c,
        workspaceId: user.workspaceId,
      })),
      skipDuplicates: true,
    });

    return reply.status(201).send({ created: result.count });
  });
}
