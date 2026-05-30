import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { authenticate, checkPermission } from "../middleware/authenticate";
import { requireWhatsappEnabled } from "../middleware/whatsappEnabled";
import type { JwtPayload } from "../middleware/authenticate";
import { sendWhatsAppTemplate, sendMsg91Session, sendMsg91Interactive } from "../lib/whatsapp";
import type { ProviderConfig } from "../lib/whatsapp";
import axios from "axios";
import { fireWebhooks } from "../lib/webhookDispatcher";

const META_APP_SECRET = process.env.META_APP_SECRET;

const sendMessageSchema = z.object({
  to: z.string().min(7),
  templateName: z.string().min(1),
  languageCode: z.string().default("en_US"),
  components: z.array(z.any()).optional().default([]),
  contactId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
});

async function getProviderConfig(workspaceId: string): Promise<ProviderConfig> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      whatsappProvider: true,
      metaPhoneNumberId: true,
      metaAccessToken: true,
      msg91AuthKey: true,
      msg91IntegratedNumber: true,
    },
  });

  // Treat null, undefined, AND empty string as "not configured".
  // The Prisma schema defaults whatsappProvider to "meta", but a new workspace
  // has no credentials — catching the empty string prevents a misleading
  // "Meta credentials not configured" message when the real issue is provider selection.
  const provider = (ws?.whatsappProvider?.trim() as "meta" | "msg91" | "" | null | undefined);
  if (!provider) {
    throw new Error("No WhatsApp provider configured. Go to Settings → WhatsApp Provider and select Meta Cloud API or MSG91.");
  }

  return {
    provider,
    metaPhoneNumberId: ws?.metaPhoneNumberId ?? undefined,
    metaAccessToken: ws?.metaAccessToken ?? undefined,
    msg91AuthKey: ws?.msg91AuthKey ?? undefined,
    msg91IntegratedNumber: ws?.msg91IntegratedNumber ?? undefined,
  };
}

// Normalise phone numbers: strip all non-digits except leading +
function normalisePhone(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, "");
  if ((normalized.match(/\d/g) ?? []).length < 7) {
    throw new Error(`Invalid phone number: "${phone}"`);
  }
  return normalized;
}

export async function whatsappRoutes(app: FastifyInstance) {
  app.post(
    "/send",
    { preHandler: [checkPermission("can_send_whatsapp"), requireWhatsappEnabled] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const parsed = sendMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      let config;
      try {
        config = await getProviderConfig(user.workspaceId);
      } catch (err: unknown) {
        const msg = (err instanceof Error && err.message) || "WhatsApp provider not configured";
        return reply.status(422).send({ error: msg });
      }

      let status = "sent";
      let wamid: string | null = null;
      let providerResponse: unknown = null;
      let sendError: string | null = null;

      try {
        const result = await sendWhatsAppTemplate(
          {
            to: parsed.data.to,
            templateName: parsed.data.templateName,
            languageCode: parsed.data.languageCode,
            components: parsed.data.components,
          },
          config
        );
        wamid = result.wamid;
        providerResponse = result.raw;
      } catch (err: unknown) {
        status = "failed";
        sendError = (err instanceof Error && err.message) || `${config.provider} send failed`;
        app.log.error({ err }, `${config.provider} send failed`);
      }

      let contactId = parsed.data.contactId;
      if (!contactId) {
        const normalized = normalisePhone(parsed.data.to);
        const contact = await prisma.contact.findFirst({
          where: {
            workspaceId: user.workspaceId,
            OR: [{ phone: parsed.data.to }, { phone: normalized }],
          },
        });
        if (contact) contactId = contact.id;
      }

      if (contactId) {
        await prisma.messageLog.create({
          data: {
            workspaceId: user.workspaceId,
            contactId,
            campaignId: parsed.data.campaignId ?? null,
            wamid,
            status,
          },
        });
      }

      if (status === "failed") {
        return reply.status(502).send({
          error: sendError ?? `Failed to send via ${config.provider}`,
          providerResponse,
        });
      }

      return reply.send({ message: "Message sent", provider: config.provider, providerResponse });
    }
  );

  app.post(
    "/send-bulk",
    { preHandler: [checkPermission("can_send_whatsapp"), requireWhatsappEnabled] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({
        campaignId: z.string().uuid(),
        contactIds: z.array(z.string().uuid()).min(1).max(1000),
        templateName: z.string().min(1),
        languageCode: z.string().default("en_US"),
        components: z.array(z.any()).optional().default([]),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      // Verify campaign belongs to this workspace before proceeding
      const campaign = await prisma.campaign.findFirst({
        where: { id: parsed.data.campaignId, workspaceId: user.workspaceId },
        select: { id: true },
      });
      if (!campaign) return reply.status(404).send({ error: "Campaign not found" });

      const contacts = await prisma.contact.findMany({
        where: {
          id: { in: parsed.data.contactIds },
          workspaceId: user.workspaceId,
          optIn: true,
        },
      });

      let config;
      try {
        config = await getProviderConfig(user.workspaceId);
      } catch (err: unknown) {
        const msg = (err instanceof Error && err.message) || "WhatsApp provider not configured";
        return reply.status(422).send({ error: msg });
      }

      const results = await Promise.allSettled(
        contacts.map(async (contact: { id: string; phone: string; workspaceId: string }) => {
          let status = "sent";
          let wamid: string | null = null;
          try {
            const result = await sendWhatsAppTemplate(
              {
                to: contact.phone,
                templateName: parsed.data.templateName,
                languageCode: parsed.data.languageCode,
                components: parsed.data.components,
              },
              config
            );
            wamid = result.wamid;
          } catch {
            status = "failed";
          }

          await prisma.messageLog.create({
            data: {
              workspaceId: user.workspaceId,
              contactId: contact.id,
              campaignId: parsed.data.campaignId,
              wamid,
              status,
            },
          });

          return { contactId: contact.id, status };
        })
      );

      const summary = results.reduce(
        (acc, r) => {
          if (r.status === "fulfilled") {
            acc[r.value.status] = (acc[r.value.status] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      return reply.send({ campaignId: parsed.data.campaignId, summary, total: contacts.length });
    }
  );

  // ── Webhook verification (GET) ────────────────────────────────────────────
  app.get("/webhook", async (request, reply) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } =
      request.query as Record<string, string>;

    if (mode !== "subscribe" || !token) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const match = await prisma.workspace.findFirst({
      where: { metaWebhookVerifyToken: token, status: "active" },
      select: { id: true },
    });

    if (!match) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    return reply.send(Number(challenge));
  });

  // ── Webhook inbound (POST) ────────────────────────────────────────────────
  // Capture raw request bytes before JSON parsing so we can verify the
  // HMAC-SHA256 signature that Meta computes over the *original* wire bytes.
  // Using addContentTypeParser scoped to this plugin (whatsapp prefix) so it
  // only affects the webhook route, not the rest of the application.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body: Buffer, done) => {
      try {
        const parsed = JSON.parse(body.toString("utf8"));
        // Attach raw buffer under a non-enumerable property for signature check
        Object.defineProperty(parsed, "__rawBody", { value: body, enumerable: false });
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  app.post("/webhook", async (request, reply) => {
    // Verify Meta HMAC-SHA256 signature over the original raw bytes
    if (META_APP_SECRET) {
      const signature = (request.headers["x-hub-signature-256"] as string | undefined) ?? "";
      // Retrieve the raw buffer attached during content-type parsing
      const rawBody: Buffer | undefined = (request.body as Record<string, unknown>)?.["__rawBody"] as Buffer | undefined;
      if (!rawBody) {
        return reply.status(400).send({ error: "Could not read raw webhook body" });
      }
      const expected = "sha256=" + crypto
        .createHmac("sha256", META_APP_SECRET)
        .update(rawBody)
        .digest("hex");
      // Use timingSafeEqual with equal-length buffers to prevent timing attacks
      const sigBuf = Buffer.from(signature.padEnd(expected.length));
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return reply.status(403).send({ error: "Invalid webhook signature" });
      }
    }

    const body = request.body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id: string };
            contacts?: Array<{ profile: { name: string }; wa_id: string }>;
            messages?: Array<{
              id: string;
              from: string;
              timestamp: string;
              type: string;
              text?: { body: string };
              image?: { caption?: string; mime_type: string; id: string };
              audio?: { id: string; mime_type: string };
              video?: { id: string; mime_type: string; caption?: string };
              document?: { id: string; filename?: string; mime_type: string };
              sticker?: { id: string };
              reaction?: { message_id: string; emoji: string };
              context?: { from: string; id: string };
            }>;
            statuses?: Array<{ id: string; status: string; recipient_id: string }>;
          };
        }>;
      }>;
    };

    const changes = body.entry?.flatMap((e) => e.changes ?? []) ?? [];

    for (const change of changes) {
      const value = change.value;
      if (!value) continue;

      // ── Status updates — write back to MessageLog ──────────────────────
      for (const s of value.statuses ?? []) {
        const VALID_STATUSES = ["sent", "delivered", "read", "failed"];
        const newStatus = VALID_STATUSES.includes(s.status) ? s.status : null;
        app.log.info({ messageId: s.id, status: s.status }, "Status update");
        if (newStatus) {
          // MessageLog doesn't store the provider message ID, so match by workspace + phone
          // Best-effort: find the most recent matching log for this recipient
          try {
            const phoneNumberId = value.metadata?.phone_number_id;
            const ws = phoneNumberId
              ? await prisma.workspace.findFirst({
                  where: { metaPhoneNumberId: phoneNumberId, status: "active" },
                  select: { id: true },
                })
              : null;
            if (ws) {
              // Prefer precise wamid-based match — avoids updating unrelated logs for the same contact
              const byWamid = await prisma.messageLog.findFirst({
                where: { workspaceId: ws.id, wamid: s.id },
                select: { id: true },
              });

              if (byWamid) {
                // Exact match — only update this specific message
                await prisma.messageLog.update({
                  where: { id: byWamid.id },
                  data: { status: newStatus },
                });
              } else {
                // Fallback for logs sent before wamid was stored: match by recipient phone
                let normalized: string;
                try { normalized = normalisePhone(s.recipient_id); } catch { normalized = s.recipient_id; }
                const contact = await prisma.contact.findFirst({
                  where: { workspaceId: ws.id, OR: [{ phone: s.recipient_id }, { phone: normalized }] },
                  select: { id: true },
                });
                if (contact) {
                  // Scope to most recent "sent" log to minimize blast radius
                  const recent = await prisma.messageLog.findFirst({
                    where: { workspaceId: ws.id, contactId: contact.id, status: "sent" },
                    orderBy: { createdAt: "desc" },
                    select: { id: true },
                  });
                  if (recent) {
                    await prisma.messageLog.update({
                      where: { id: recent.id },
                      data: { status: newStatus },
                    });
                  }
                }
              }

              // Fire outbound webhook event for downstream integrations
              const EVENT_MAP: Record<string, string> = {
                delivered: "message.delivered",
                read: "message.read",
                failed: "message.failed",
              };
              const webhookEvent = EVENT_MAP[newStatus];
              if (webhookEvent) {
                fireWebhooks(ws.id, webhookEvent as "message.delivered" | "message.read" | "message.failed", {
                  messageId: s.id,
                  recipientId: s.recipient_id,
                  status: newStatus,
                }).catch(() => {});
              }
            }
          } catch (err) {
            app.log.error({ err, statusUpdate: s }, "Failed to update MessageLog status");
          }
        }
      }

      // ── Inbound messages ────────────────────────────────────────────────
      for (const msg of value.messages ?? []) {
        const fromPhone = msg.from;
        const phoneNumberId = value.metadata?.phone_number_id;

        let bodyText: string | null = null;
        if (msg.type === "text") bodyText = msg.text?.body ?? null;
        else if (msg.type === "image") bodyText = msg.image?.caption ?? "[image]";
        else if (msg.type === "video") bodyText = msg.video?.caption ?? "[video]";
        else if (msg.type === "audio") bodyText = "[audio]";
        else if (msg.type === "document") bodyText = msg.document?.filename ?? "[document]";
        else if (msg.type === "sticker") bodyText = "[sticker]";
        else if (msg.type === "reaction") bodyText = msg.reaction?.emoji ?? "[reaction]";

        const workspaces = phoneNumberId
          ? await prisma.workspace.findMany({
              where: { metaPhoneNumberId: phoneNumberId, status: "active" },
              select: { id: true },
            })
          : [];

        for (const ws of workspaces) {
          try {
            const existing = await prisma.inboundMessage.findUnique({
              where: { messageId: msg.id },
            });
            if (existing) continue;

            // Contact lookup with phone normalisation fallback
            let normalized: string;
            try { normalized = normalisePhone(fromPhone); } catch { normalized = fromPhone; }
            const contact = await prisma.contact.findFirst({
              where: {
                workspaceId: ws.id,
                OR: [{ phone: fromPhone }, { phone: normalized }],
              },
            });

            // Try to link reply to the most recent campaign that messaged this contact
            let campaignId: string | null = null;
            if (contact) {
              const lastCampaignLog = await prisma.messageLog.findFirst({
                where: { workspaceId: ws.id, contactId: contact.id, campaignId: { not: null } },
                orderBy: { createdAt: "desc" },
                select: { campaignId: true },
              });
              campaignId = lastCampaignLog?.campaignId ?? null;
            }

            await prisma.inboundMessage.create({
              data: {
                workspaceId: ws.id,
                contactId: contact?.id ?? null,
                campaignId,
                fromPhone,
                messageId: msg.id,
                type: msg.type,
                body: bodyText,
                replyToMessageId: msg.context?.id ?? null,
                rawPayload: msg as object,
              },
            });

            app.log.info(
              { from: fromPhone, type: msg.type, campaignId, replyTo: msg.context?.id },
              "Inbound message captured"
            );

            // ── Fire message.inbound webhook ─────────────────────────────
            fireWebhooks(ws.id, "message.inbound", {
              messageId: msg.id,
              fromPhone,
              type: msg.type,
              body: bodyText,
              contactId: contact?.id ?? null,
              campaignId,
            }).catch(() => {});

            // ── Opt-out automation ───────────────────────────────────────
            let isOptOut = false;
            const OPT_OUT_KEYWORDS = new Set(["stop", "unsubscribe", "optout", "opt-out", "cancel", "quit", "end"]);
            if (contact && msg.type === "text" && bodyText) {
              const word = bodyText.trim().toLowerCase().replace(/[^a-z-]/g, "");
              if (OPT_OUT_KEYWORDS.has(word)) {
                isOptOut = true;
                await prisma.contact.update({
                  where: { id: contact.id },
                  data: { optIn: false },
                });
                app.log.info({ contactId: contact.id, phone: fromPhone }, "Contact opted out");
                fireWebhooks(ws.id, "contact.opted_out", {
                  contactId: contact.id,
                  phone: fromPhone,
                }).catch(() => {});
              }
            }

            // ── Auto-reply ───────────────────────────────────────────────
            if (!isOptOut && contact && msg.type === "text" && bodyText) {
              const rules = await prisma.autoReply.findMany({
                where: { workspaceId: ws.id, isActive: true },
              });
              for (const rule of rules) {
                const msgLower = bodyText.trim().toLowerCase();
                const keyLower = rule.keyword.toLowerCase();
                // Support comma-separated multi-keyword OR matching (e.g. "yes,ok,sure")
                const keywords = keyLower.split(",").map((k: string) => k.trim()).filter(Boolean);
                let matches = false;
                for (const kw of keywords) {
                  if (rule.matchType === "exact") matches = msgLower === kw;
                  else if (rule.matchType === "contains") matches = msgLower.includes(kw);
                  else if (rule.matchType === "starts_with") matches = msgLower.startsWith(kw);
                  if (matches) break;
                }

                if (matches) {
                  try {
                    const wsConfig = await getProviderConfig(ws.id);
                    let autoWamid: string | null = null;
                    let autoStatus = "sent";
                    try {
                      const autoResult = await sendWhatsAppTemplate(
                        { to: fromPhone, templateName: rule.templateName, languageCode: rule.languageCode, components: [] },
                        wsConfig
                      );
                      autoWamid = autoResult.wamid;
                    } catch {
                      autoStatus = "failed";
                    }
                    await prisma.messageLog.create({
                      data: { workspaceId: ws.id, contactId: contact.id, wamid: autoWamid, status: autoStatus },
                    });
                  } catch (autoErr) {
                    app.log.error({ autoErr, ruleId: rule.id }, "Auto-reply send failed");
                  }
                  break;
                }
              }
            }
          } catch (err) {
            app.log.error({ err, msgId: msg.id }, "Failed to store inbound message");
          }
        }
      }
    }

    return reply.send({ received: true });
  });

  // ── MSG91 webhook (delivery receipts + inbound messages) ─────────────────
  // MSG91 sends events to /whatsapp/msg91-webhook
  // Delivery update: { requestId, status, number }
  // Inbound message: { type, from, body, messageId, ... }
  app.post("/msg91-webhook", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    // ── Delivery receipt ────────────────────────────────────────────────────
    const requestId = body.requestId as string | undefined;
    const deliveryStatus = body.status as string | undefined;
    const recipientNumber = (body.number ?? body.from) as string | undefined;

    if (requestId && deliveryStatus) {
      const VALID_STATUSES: Record<string, string> = {
        delivered: "delivered",
        read: "read",
        failed: "failed",
        sent: "sent",
        DELIVERED: "delivered",
        READ: "read",
        FAILED: "failed",
        SENT: "sent",
      };
      const newStatus = VALID_STATUSES[deliveryStatus];
      if (newStatus) {
        try {
          // Find workspace by msg91 integrated number or by wamid match
          const byWamid = await prisma.messageLog.findFirst({
            where: { wamid: requestId },
            select: { id: true, workspaceId: true },
          });

          if (byWamid) {
            await prisma.messageLog.update({
              where: { id: byWamid.id },
              data: { status: newStatus },
            });

            const EVENT_MAP: Record<string, string> = {
              delivered: "message.delivered",
              read: "message.read",
              failed: "message.failed",
            };
            const webhookEvent = EVENT_MAP[newStatus];
            if (webhookEvent) {
              fireWebhooks(byWamid.workspaceId, webhookEvent as "message.delivered" | "message.read" | "message.failed", {
                messageId: requestId,
                recipientId: recipientNumber ?? "",
                status: newStatus,
              }).catch(() => {});
            }
          } else if (recipientNumber) {
            // Fallback: match by recipient phone — scope to msg91 workspaces only to prevent cross-tenant contamination
            let normalized: string;
            try { normalized = normalisePhone(recipientNumber); } catch { normalized = recipientNumber; }
            const msg91Ws = await prisma.workspace.findMany({
              where: { whatsappProvider: "msg91", status: "active" },
              select: { id: true },
            });
            const msg91WsIds = msg91Ws.map((w) => w.id);
            const contact = msg91WsIds.length > 0 ? await prisma.contact.findFirst({
              where: { workspaceId: { in: msg91WsIds }, OR: [{ phone: recipientNumber }, { phone: normalized }] },
              select: { id: true, workspaceId: true },
            }) : null;
            if (contact) {
              const ws = await prisma.workspace.findFirst({
                where: { id: contact.workspaceId, whatsappProvider: "msg91", status: "active" },
                select: { id: true },
              });
              if (ws) {
                const recent = await prisma.messageLog.findFirst({
                  where: { workspaceId: ws.id, contactId: contact.id, status: "sent" },
                  orderBy: { createdAt: "desc" },
                  select: { id: true },
                });
                if (recent) {
                  await prisma.messageLog.update({ where: { id: recent.id }, data: { status: newStatus } });
                }
              }
            }
          }
        } catch (err) {
          app.log.error({ err, requestId, deliveryStatus }, "MSG91 delivery update failed");
        }
      }
      return reply.send({ received: true });
    }

    // ── Inbound message ──────────────────────────────────────────────────────
    const fromPhone = (body.from ?? body.sender) as string | undefined;
    const msgId = (body.messageId ?? body.id) as string | undefined;
    const msgType = (body.type as string | undefined) ?? "text";
    const msgBody = (body.body ?? body.text) as string | undefined | null;

    if (fromPhone && msgId) {
      try {
        let normalized: string;
        try { normalized = normalisePhone(fromPhone); } catch { normalized = fromPhone; }

        // Find workspace first (scoped to msg91 providers), then contact within that workspace
        const msg91Workspaces = await prisma.workspace.findMany({
          where: { whatsappProvider: "msg91", status: "active" },
          select: { id: true },
        });
        const msg91WorkspaceIds = msg91Workspaces.map((w) => w.id);

        const contact = msg91WorkspaceIds.length > 0
          ? await prisma.contact.findFirst({
              where: {
                workspaceId: { in: msg91WorkspaceIds },
                OR: [{ phone: fromPhone }, { phone: normalized }],
              },
              select: { id: true, workspaceId: true },
            })
          : null;

        const ws = contact
          ? await prisma.workspace.findFirst({
              where: { id: contact.workspaceId, whatsappProvider: "msg91", status: "active" },
              select: { id: true },
            })
          : null;

        if (ws) {
          const existing = await prisma.inboundMessage.findUnique({ where: { messageId: msgId } });
          if (!existing) {
            // Link to most recent campaign that messaged this contact
            let campaignId: string | null = null;
            if (contact) {
              const lastLog = await prisma.messageLog.findFirst({
                where: { workspaceId: ws.id, contactId: contact.id, campaignId: { not: null } },
                orderBy: { createdAt: "desc" },
                select: { campaignId: true },
              });
              campaignId = lastLog?.campaignId ?? null;
            }

            await prisma.inboundMessage.create({
              data: {
                workspaceId: ws.id,
                contactId: contact?.id ?? null,
                campaignId,
                fromPhone,
                messageId: msgId,
                type: msgType,
                body: msgBody ?? null,
                rawPayload: body as object,
              },
            });

            fireWebhooks(ws.id, "message.inbound", {
              messageId: msgId,
              fromPhone,
              type: msgType,
              body: msgBody ?? null,
              contactId: contact?.id ?? null,
              campaignId,
            }).catch(() => {});

            // Opt-out automation
            const OPT_OUT_KEYWORDS = new Set(["stop", "unsubscribe", "optout", "opt-out", "cancel", "quit", "end"]);
            if (contact && msgType === "text" && msgBody) {
              const word = msgBody.trim().toLowerCase().replace(/[^a-z-]/g, "");
              if (OPT_OUT_KEYWORDS.has(word)) {
                await prisma.contact.update({ where: { id: contact.id }, data: { optIn: false } });
                fireWebhooks(ws.id, "contact.opted_out", { contactId: contact.id, phone: fromPhone }).catch(() => {});
              }
            }

            // Auto-reply
            if (contact && msgType === "text" && msgBody) {
              const rules = await prisma.autoReply.findMany({ where: { workspaceId: ws.id, isActive: true } });
              for (const rule of rules) {
                const msgLower = msgBody.trim().toLowerCase();
                const keyLower = rule.keyword.toLowerCase();
                // Support comma-separated multi-keyword OR matching (e.g. "yes,ok,sure")
                const keywords = keyLower.split(",").map((k: string) => k.trim()).filter(Boolean);
                let matches = false;
                for (const kw of keywords) {
                  if (rule.matchType === "exact") matches = msgLower === kw;
                  else if (rule.matchType === "contains") matches = msgLower.includes(kw);
                  else if (rule.matchType === "starts_with") matches = msgLower.startsWith(kw);
                  if (matches) break;
                }
                if (matches) {
                  try {
                    const wsConfig = await getProviderConfig(ws.id);
                    let autoWamid: string | null = null;
                    let autoStatus = "sent";
                    try {
                      const autoResult = await sendWhatsAppTemplate(
                        { to: fromPhone, templateName: rule.templateName, languageCode: rule.languageCode, components: [] },
                        wsConfig
                      );
                      autoWamid = autoResult.wamid;
                    } catch { autoStatus = "failed"; }
                    await prisma.messageLog.create({
                      data: { workspaceId: ws.id, contactId: contact.id, wamid: autoWamid, status: autoStatus },
                    });
                  } catch (autoErr) {
                    app.log.error({ autoErr, ruleId: rule.id }, "MSG91 auto-reply failed");
                  }
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        app.log.error({ err, msgId, fromPhone }, "MSG91 inbound message failed");
      }
    }

    return reply.send({ received: true });
  });

  // ── Inbox: list inbound messages ──────────────────────────────────────────
  app.get(
    "/inbox",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { page = "1", limit = "20", unread, campaignId, search } = request.query as Record<string, string>;

      const skip = (Number(page) - 1) * Number(limit);
      const where = {
        workspaceId: user.workspaceId,
        ...(unread === "true" ? { read: false } : {}),
        ...(campaignId ? { campaignId } : {}),
        ...(search
          ? {
              OR: [
                { fromPhone: { contains: search } },
                { body: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [messages, total, totalUnread] = await Promise.all([
        prisma.inboundMessage.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { receivedAt: "desc" },
          include: {
            contact: { select: { id: true, name: true, phone: true } },
          },
        }),
        prisma.inboundMessage.count({ where }),
        prisma.inboundMessage.count({ where: { workspaceId: user.workspaceId, read: false } }),
      ]);

      return reply.send({ messages, total, totalUnread, page: Number(page), limit: Number(limit) });
    }
  );

  // ── Mark message(s) as read ───────────────────────────────────────────────
  app.patch(
    "/inbox/read",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { ids, fromPhone } = request.body as { ids?: string[]; fromPhone?: string };

      // Priority: explicit ids > fromPhone (conversation) > all workspace messages
      const where = ids?.length
        ? { workspaceId: user.workspaceId, id: { in: ids } }
        : fromPhone
        ? { workspaceId: user.workspaceId, fromPhone, read: false }
        : { workspaceId: user.workspaceId };

      const { count } = await prisma.inboundMessage.updateMany({
        where,
        data: { read: true },
      });

      return reply.send({ marked: count });
    }
  );

  // ── Conversations list (latest message per sender) ────────────────────────
  app.get(
    "/conversations",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { page = "1", limit = "50" } = request.query as Record<string, string>;
      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(Math.max(1, Number(limit)), 200);
      const skip = (pageNum - 1) * limitNum;

      try {
        // Get latest message per sender using raw SQL (Prisma groupBy with orderBy _max is unreliable)
        type LatestRow = {
          id: string; from_phone: string; contact_id: string | null;
          body: string | null; type: string; received_at: Date; read: boolean;
        };
        const latestRows = await prisma.$queryRaw<LatestRow[]>`
          SELECT DISTINCT ON (from_phone)
            id, from_phone, contact_id, body, type, received_at, read
          FROM inbound_messages
          WHERE workspace_id = ${user.workspaceId}
          ORDER BY from_phone, received_at DESC
        `;

        // Sort by most recent and paginate
        latestRows.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
        const total = latestRows.length;
        const paginated = latestRows.slice(skip, skip + limitNum);

        // Get contact info for each sender
        const contactIds = paginated.map((r) => r.contact_id).filter(Boolean) as string[];
        const contacts = contactIds.length > 0
          ? await prisma.contact.findMany({
              where: { id: { in: contactIds } },
              select: { id: true, name: true, phone: true },
            })
          : [];
        const contactMap = new Map(contacts.map((c) => [c.id, c]));

        // Get unread counts per sender
        const unreadGroups = await prisma.inboundMessage.groupBy({
          by: ["fromPhone"],
          where: { workspaceId: user.workspaceId, read: false },
          _count: { id: true },
        });
        type UnreadRow = (typeof unreadGroups)[number];
        const unreadMap = new Map(unreadGroups.map((g: UnreadRow) => [g.fromPhone, g._count.id]));

        const conversations = paginated.map((r) => ({
          fromPhone: r.from_phone,
          contactId: r.contact_id,
          contact: r.contact_id ? (contactMap.get(r.contact_id) ?? null) : null,
          latestMessage: {
            id: r.id,
            body: r.body,
            type: r.type,
            receivedAt: r.received_at,
            read: r.read,
          },
          unreadCount: unreadMap.get(r.from_phone) ?? 0,
        }));

        return reply.send({ conversations, total, page: pageNum, limit: limitNum });
      } catch (err: unknown) {
        const msg = (err instanceof Error) ? err.message : String(err);
        app.log.error({ err }, "[conversations] query failed");
        return reply.status(500).send({ error: msg });
      }
    }
  );

  // ── Campaign reply counts (for alert badges) ─────────────────────────────
  app.get(
    "/campaign-replies",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;

      type GroupByRow = { campaignId: string | null; _count: { id: number } };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const replies = (await (prisma.inboundMessage.groupBy as any)({
        by: ["campaignId"],
        where: { workspaceId: user.workspaceId, campaignId: { not: null } },
        _count: { id: true },
      })) as GroupByRow[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unreadReplies = (await (prisma.inboundMessage.groupBy as any)({
        by: ["campaignId"],
        where: { workspaceId: user.workspaceId, campaignId: { not: null }, read: false },
        _count: { id: true },
      })) as GroupByRow[];

      const unreadMap = unreadReplies.reduce<Record<string, number>>((acc, r) => {
        if (r.campaignId) acc[r.campaignId] = r._count.id;
        return acc;
      }, {});

      const result = replies.reduce<Record<string, { total: number; unread: number }>>((acc, r) => {
        if (r.campaignId) {
          acc[r.campaignId] = { total: r._count.id, unread: unreadMap[r.campaignId] ?? 0 };
        }
        return acc;
      }, {});

      return reply.send({ replies: result });
    }
  );

  // ── POST /whatsapp/send-session — free-form text (session window) ────────
  app.post(
    "/send-session",
    { preHandler: [checkPermission("can_send_whatsapp"), requireWhatsappEnabled] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({
        to:        z.string().min(7),
        text:      z.string().min(1).max(4096),
        contactId: z.string().uuid().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      let config: ProviderConfig;
      try { config = await getProviderConfig(user.workspaceId); }
      catch (err) { return reply.status(422).send({ error: (err instanceof Error && err.message) || "Provider not configured" }); }

      if (config.provider !== "msg91") {
        return reply.status(422).send({ error: "Session messages are only supported for MSG91 provider." });
      }

      try {
        const result = await sendMsg91Session({ to: parsed.data.to, text: parsed.data.text }, config);
        return reply.send({ message: "Sent", provider: "msg91", wamid: result.wamid });
      } catch (err) {
        return reply.status(502).send({ error: (err instanceof Error && err.message) || "Send failed" });
      }
    }
  );

  // ── POST /whatsapp/send-interactive — buttons / list / location / payment ─
  app.post(
    "/send-interactive",
    { preHandler: [checkPermission("can_send_whatsapp"), requireWhatsappEnabled] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({
        to:          z.string().min(7),
        interactive: z.record(z.unknown()),
        contactId:   z.string().uuid().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      let config: ProviderConfig;
      try { config = await getProviderConfig(user.workspaceId); }
      catch (err) { return reply.status(422).send({ error: (err instanceof Error && err.message) || "Provider not configured" }); }

      if (config.provider !== "msg91") {
        return reply.status(422).send({ error: "Interactive messages are only supported for MSG91 provider." });
      }

      try {
        const result = await sendMsg91Interactive({ to: parsed.data.to, interactive: parsed.data.interactive }, config);
        return reply.send({ message: "Sent", provider: "msg91", wamid: result.wamid });
      } catch (err) {
        return reply.status(502).send({ error: (err instanceof Error && err.message) || "Send failed" });
      }
    }
  );

  // ── GET /whatsapp/logs — MSG91 message logs ──────────────────────────────
  app.get("/logs", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };
    const ws = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, msg91AuthKey: true },
    });
    if (!ws || ws.whatsappProvider !== "msg91") {
      return reply.status(422).send({ error: "WhatsApp logs are only available for MSG91 provider." });
    }
    if (!ws.msg91AuthKey) return reply.status(422).send({ error: "MSG91 Auth Key required." });
    try {
      const { data } = await axios.get(
        "https://control.msg91.com/api/v5/report/logs/wa",
        {
          params: { startDate, endDate },
          headers: { authkey: ws.msg91AuthKey, accept: "application/json" },
        }
      );
      return reply.send(data);
    } catch (err: unknown) {
      const d = (err as { response?: { data?: unknown } }).response?.data as Record<string, unknown> | undefined;
      return reply.status(502).send({ error: (typeof d?.message === "string" && d.message) || "Failed to fetch logs" });
    }
  });

  // ── GET /whatsapp/msg91-analytics — MSG91 WhatsApp analytics ─────────────
  app.get("/msg91-analytics", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };
    const ws = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, msg91AuthKey: true },
    });
    if (!ws || ws.whatsappProvider !== "msg91") {
      return reply.status(422).send({ error: "MSG91 analytics are only available for MSG91 provider." });
    }
    if (!ws.msg91AuthKey) return reply.status(422).send({ error: "MSG91 Auth Key required." });
    try {
      const { data } = await axios.get(
        "https://control.msg91.com/api/v5/report/analytics/p/wa/",
        {
          params: { startDate, endDate },
          headers: { Authkey: ws.msg91AuthKey, accept: "application/json" },
        }
      );
      return reply.send(data);
    } catch (err: unknown) {
      const d = (err as { response?: { data?: unknown } }).response?.data as Record<string, unknown> | undefined;
      return reply.status(502).send({ error: (typeof d?.message === "string" && d.message) || "Failed to fetch analytics" });
    }
  });

  // ── GET /whatsapp/balance — MSG91 prepaid balance ─────────────────────────
  app.get("/balance", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const ws = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, msg91AuthKey: true, msg91IntegratedNumber: true },
    });
    if (!ws || ws.whatsappProvider !== "msg91") {
      return reply.status(422).send({ error: "Balance check is only available for MSG91 provider." });
    }
    if (!ws.msg91AuthKey || !ws.msg91IntegratedNumber) {
      return reply.status(422).send({ error: "MSG91 credentials required." });
    }
    try {
      const { data } = await axios.post(
        "https://control.msg91.com/api/v5/subscriptions/fetchPrepaidBalance",
        { integrated_number: ws.msg91IntegratedNumber.replace(/^\+/, ""), service: "whatsapp" },
        { headers: { Authkey: ws.msg91AuthKey, "Content-Type": "application/json" } }
      );
      return reply.send(data);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: unknown } };
      const d = axErr.response?.data as Record<string, unknown> | undefined;
      return reply.status(502).send({ error: (typeof d?.message === "string" && d.message) || "Failed to fetch balance" });
    }
  });

  // ── GET /whatsapp/numbers — fetch registered MSG91 WhatsApp numbers ────────
  app.get("/numbers", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const ws = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { whatsappProvider: true, msg91AuthKey: true },
    });
    if (!ws || ws.whatsappProvider !== "msg91") {
      return reply.status(422).send({ error: "Numbers fetch is only available for MSG91 provider." });
    }
    if (!ws.msg91AuthKey) {
      return reply.status(422).send({ error: "MSG91 Auth Key required." });
    }
    try {
      const { data } = await axios.get(
        "https://control.msg91.com/api/v5/whatsapp/whatsapp-activation/",
        { headers: { authkey: ws.msg91AuthKey, accept: "application/json" } }
      );
      return reply.send(data);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: unknown } };
      const d = axErr.response?.data as Record<string, unknown> | undefined;
      return reply.status(502).send({ error: (typeof d?.message === "string" && d.message) || "Failed to fetch numbers" });
    }
  });

  // ── SSE: real-time inbox notifications ────────────────────────────────────
  // Clients subscribe once; receive "new_message" events when inbound messages arrive.
  // Sends a heartbeat comment every 25s to keep load-balancers from dropping the connection.
  app.get(
    "/inbox/stream",
    {},
    async (request, reply) => {
      // EventSource cannot set Authorization header — accept token via query param
      const { token } = request.query as { token?: string };
      if (token) {
        request.headers.authorization = `Bearer ${token}`;
      }
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const user = request.user as JwtPayload;

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      reply.raw.flushHeaders();

      const write = (event: string, data: unknown) => {
        try {
          reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch { /* client disconnected */ }
      };

      write("connected", { workspaceId: user.workspaceId, ts: Date.now() });

      let lastSeen = new Date();

      const pollInterval = setInterval(async () => {
        try {
          const [newCount, totalUnread] = await Promise.all([
            prisma.inboundMessage.count({
              where: { workspaceId: user.workspaceId, receivedAt: { gte: lastSeen } },
            }),
            prisma.inboundMessage.count({
              where: { workspaceId: user.workspaceId, read: false },
            }),
          ]);
          if (newCount > 0) {
            lastSeen = new Date();
            write("new_message", { count: newCount, totalUnread });
          }
        } catch { /* ignore DB errors — keep connection alive */ }
      }, 5_000);

      // Heartbeat prevents proxy/LB timeouts
      const heartbeat = setInterval(() => {
        try { reply.raw.write(": heartbeat\n\n"); } catch { /* disconnected */ }
      }, 25_000);

      // Cleanup when client disconnects
      await new Promise<void>((resolve) => {
        request.raw.on("close", () => { clearInterval(pollInterval); clearInterval(heartbeat); resolve(); });
        request.raw.on("error", () => { clearInterval(pollInterval); clearInterval(heartbeat); resolve(); });
      });
    }
  );
}
