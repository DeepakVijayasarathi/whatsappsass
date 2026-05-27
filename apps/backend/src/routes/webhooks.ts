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
  url:      z.string().url("Must be a valid URL").refine(
    (u) => u.startsWith("https://"),
    { message: "Webhook URL must use HTTPS" }
  ),
  secret:   z.string().optional(),
  events:   z.array(z.string()).min(1, "Select at least one event"),
  isActive: z.boolean().default(true),
});

export async function webhookRoutes(app: FastifyInstance) {
  // List available event types
  app.get("/events", { preHandler: [requireOwnerOrAdmin] }, async (_request, reply) => {
    return reply.send({ events: VALID_EVENTS });
  });

  const sanitize = (ep: { secret?: string | null; [key: string]: unknown }) => {
    const { secret, ...rest } = ep;
    return { ...rest, hasSecret: !!(secret && secret.trim()) };
  };

  // List endpoints
  app.get("/", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ endpoints: endpoints.map(sanitize) });
  });

  // Create endpoint
  app.post("/", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const endpoint = await prisma.webhookEndpoint.create({
      data: { workspaceId: user.workspaceId, ...parsed.data },
    });
    return reply.status(201).send(sanitize(endpoint));
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

  // Delivery logs for an endpoint
  app.get("/:id/logs", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const { limit = "50" } = request.query as Record<string, string>;

    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const logs = await prisma.webhookDeliveryLog.findMany({
      where: { endpointId: id },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit) || 50, 200),
    });
    return reply.send({ logs });
  });

  // Test endpoint — sends a sample payload
  app.post("/:id/test", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await fireWebhooks(user.workspaceId, "message.inbound", {
      test: true,
      messageId: "test-msg-id-000",
      fromPhone: "919999999999",
      fromName: "Test Contact",
      type: "text",
      body: "This is a test webhook delivery from WhatsApp SaaS",
      timestamp: new Date().toISOString(),
    });
    return reply.send({ ok: true });
  });
}
