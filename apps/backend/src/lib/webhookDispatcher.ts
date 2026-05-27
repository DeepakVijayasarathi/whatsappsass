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
    select: { id: true, url: true, secret: true },
  });

  if (endpoints.length === 0) return;

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

  await Promise.allSettled(
    endpoints.map(async ({ id, url, secret }: { id: string; url: string; secret: string | null }) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
      };
      if (secret) {
        const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
        headers["X-Webhook-Signature"] = `sha256=${sig}`;
      }

      const start = Date.now();
      let statusCode: number | null = null;
      let success = false;
      let errorMsg: string | null = null;

      try {
        const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
        statusCode = res.status;
        success = res.ok;
        if (!res.ok) errorMsg = `HTTP ${res.status}`;
      } catch (err) {
        errorMsg = (err as Error).message;
        console.error(`[webhook] delivery failed to ${url}:`, errorMsg);
      }

      const durationMs = Date.now() - start;

      // Log delivery result — fire-and-forget, don't let DB failure affect caller
      prisma.webhookDeliveryLog.create({
        data: { endpointId: id, event, statusCode, success, durationMs, error: errorMsg },
      }).catch((e: unknown) => console.error("[webhook] failed to write delivery log:", e));
    })
  );
}
