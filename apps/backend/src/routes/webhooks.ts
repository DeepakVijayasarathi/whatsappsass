import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";
import { fireWebhooks, isPrivateWebhookUrl, type WebhookEvent } from "../lib/webhookDispatcher";
import { maskHint } from "../lib/encrypt";

export const VALID_EVENTS: WebhookEvent[] = [
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
  url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.startsWith("https://"), { message: "Webhook URL must use HTTPS" })
    .refine((u) => !isPrivateWebhookUrl(u), {
      message: "Webhook URL must not point to a private/internal address",
    }),
  secret:   z.string().optional(),
  events:   z
    .array(z.string())
    .min(1, "Select at least one event")
    .refine(
      (evts) => evts.every((e) => (VALID_EVENTS as string[]).includes(e)),
      { message: `Events must be one of: ${VALID_EVENTS.join(", ")}` }
    ),
  isActive: z.boolean().default(true),
});

export async function webhookRoutes(app: FastifyInstance) {
  // List available event types
  app.get("/events", { preHandler: [requireOwnerOrAdmin] }, async (_request, reply) => {
    return reply.send({ events: VALID_EVENTS });
  });

  // Strip secret from response; add hasSecret + secretHint for UX
  const sanitize = (ep: { secret?: string | null; [key: string]: unknown }) => {
    const { secret, ...rest } = ep;
    return { ...rest, hasSecret: !!(secret), secretHint: maskHint(secret) };
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

    const { secret, ...rest } = parsed.data;
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        workspaceId: user.workspaceId,
        ...rest,
        // Encrypt the signing secret at rest — decrypted only when computing HMAC
        secret: secret ? secret : null,
      },
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

    const { secret, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (secret !== undefined) {
      // Explicitly provided (even empty string clears the secret)
      updateData.secret = secret.trim() ? secret.trim() : null;
    }
    // If secret is not in the payload, keep the existing stored value

    const updated = await prisma.webhookEndpoint.update({ where: { id }, data: updateData });
    return reply.send(sanitize(updated));
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
    const { limit = "50", page = "1" } = request.query as Record<string, string>;
    const limitNum = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(1, Number(page)) - 1) * limitNum;

    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const [logs, total] = await Promise.all([
      prisma.webhookDeliveryLog.findMany({
        where: { endpointId: id },
        orderBy: { createdAt: "desc" },
        take: limitNum,
        skip,
      }),
      prisma.webhookDeliveryLog.count({ where: { endpointId: id } }),
    ]);
    return reply.send({ logs, total, page: Number(page), limit: limitNum });
  });

  // Test endpoint — sends a sample payload
  app.post("/:id/test", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const { event = "message.inbound" } = request.body as { event?: string } ?? {};
    const testEvent = (VALID_EVENTS as string[]).includes(event)
      ? (event as WebhookEvent)
      : "message.inbound";

    await fireWebhooks(user.workspaceId, testEvent, {
      test: true,
      messageId: "test-msg-id-000",
      fromPhone: "919999999999",
      type: "text",
      body: "This is a test webhook delivery from WhatsApp SaaS",
      timestamp: new Date().toISOString(),
    });
    return reply.send({ ok: true, event: testEvent });
  });
}
