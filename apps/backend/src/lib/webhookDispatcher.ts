import crypto from "crypto";
import { prisma } from "./prisma";
import { decryptNullable } from "./encrypt";

export type WebhookEvent =
  | "message.inbound"
  | "message.delivered"
  | "message.read"
  | "message.failed"
  | "contact.opted_out"
  | "contact.opted_in"
  | "campaign.completed"
  | "sequence.step_sent";

// ── SSRF protection ──────────────────────────────────────────────────────────
// Blocks loopback, private RFC-1918, link-local, and cloud metadata addresses.
// This prevents a workspace owner from registering a webhook that probes
// internal services (e.g. http://localhost/admin, http://169.254.169.254).
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,               // link-local (includes AWS metadata)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/, // CGNAT
  /^fd[0-9a-f]{2}:/i,                   // IPv6 ULA
  /^fe80:/i,                             // IPv6 link-local
];

// Additional blocked hostnames
const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "169.254.169.254",
  "instance-data",
]);

export function isPrivateWebhookUrl(rawUrl: string): boolean {
  try {
    const { hostname, protocol } = new URL(rawUrl);
    if (protocol !== "https:") return true; // only HTTPS allowed
    if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;
    return PRIVATE_IP_PATTERNS.some((r) => r.test(hostname));
  } catch {
    return true; // unparseable URL → block
  }
}

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
      // SSRF guard: skip (and log) endpoints that resolve to private addresses
      if (isPrivateWebhookUrl(url)) {
        console.warn(`[webhook] Skipping private/loopback webhook URL: ${url} (endpoint ${id})`);
        return;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
      };

      // Decrypt the stored signing secret before computing HMAC
      const secretPlain = decryptNullable(secret);
      if (secretPlain) {
        const sig = crypto.createHmac("sha256", secretPlain).update(body).digest("hex");
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
