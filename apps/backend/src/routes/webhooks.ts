import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";
import { fireWebhooks, type WebhookEvent } from "../lib/webhookDispatcher";

const VALID_EVENTS: WebhookEvent[] = [
  "message.inbound",
  "message.delivered",
  "message.read",
  "message.failed",
  "contact.opted_out",
  "contact.opted_in",
  "campaign.completed",
  "sequence.step_sent",
];

const bodySchema = z.object({
  url:      z.string().url("Must be a valid HTTPS URL"),
  secret:   z.string().optional(),
  events:   z.array(z.string()).min(1, "Select at least one event"),
  isActive: z.boolean().default(true),
});

export async function webhookRoutes(app: FastifyInstance) {
  // List available event types
  app.get("/events", { preHandler: [requireOwnerOrAdmin] }, async (_request, reply) => {
    return reply.send({ events: VALID_EVENTS });
  });

  // List endpoints
  app.get("/", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ endpoints });
  });

  // Create endpoint
  app.post("/", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const endpoint = await prisma.webhookEndpoint.create({
      data: { workspaceId: user.workspaceId, ...parsed.data },
    });
    return reply.status(201).send(endpoint);
  });

  // Update endpoint
  app.patch("/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const parsed = bodySchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.webhookEndpoint.update({ where: { id }, data: parsed.data });
    return reply.send(updated);
  });

  // Delete endpoint
  app.delete("/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    await prisma.webhookEndpoint.delete({ where: { id } });
    return reply.send({ message: "Deleted" });
  });

  // Test endpoint — sends a sample payload
  app.post("/:id/test", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await fireWebhooks(user.workspaceId, "message.inbound", {
      test: true,
      message: "This is a test webhook delivery from WhatsApp SaaS",
    });
    return reply.send({ ok: true });
  });
}
