import crypto from "crypto";
import { prisma } from "./prisma";

export type WebhookEvent =
  | "message.inbound"
  | "message.delivered"
  | "message.read"
  | "message.failed"
  | "contact.opted_out"
  | "contact.opted_in"
  | "campaign.completed"
  | "sequence.step_sent";

export async function fireWebhooks(
  workspaceId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { workspaceId, isActive: true, events: { has: event } },
    select: { url: true, secret: true },
  });

  if (endpoints.length === 0) return;

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

  await Promise.allSettled(
    endpoints.map(async ({ url, secret }) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
      };
      if (secret) {
        const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
        headers["X-Webhook-Signature"] = `sha256=${sig}`;
      }
      try {
        await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
      } catch (err) {
        console.error(`[webhook] delivery failed to ${url}:`, (err as Error).message);
      }
    })
  );
}
