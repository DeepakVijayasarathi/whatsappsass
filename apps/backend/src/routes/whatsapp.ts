import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireWhatsappEnabled } from "../middleware/whatsappEnabled";
import type { JwtPayload } from "../middleware/authenticate";
import { sendWhatsAppTemplate } from "../lib/whatsapp";
import type { ProviderConfig } from "../lib/whatsapp";
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

  return {
    provider: (ws?.whatsappProvider as "meta" | "msg91") || "meta",
    metaPhoneNumberId: ws?.metaPhoneNumberId ?? undefined,
    metaAccessToken: ws?.metaAccessToken ?? undefined,
    msg91AuthKey: ws?.msg91AuthKey ?? undefined,
    msg91IntegratedNumber: ws?.msg91IntegratedNumber ?? undefined,
  };
}

// Normalise phone numbers: strip all non-digits except leading +
function normalisePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export async function whatsappRoutes(app: FastifyInstance) {
  app.post(
    "/send",
    { preHandler: [authenticate, requireWhatsappEnabled] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const parsed = sendMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const config = await getProviderConfig(user.workspaceId);
      let status = "sent";
      let providerResponse: unknown = null;

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
        providerResponse = result.raw;
      } catch (err: unknown) {
        status = "failed";
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
            status,
          },
        });
      }

      if (status === "failed") {
        return reply.status(502).send({
          error: `Failed to send via ${config.provider}`,
          providerResponse,
        });
      }

      return reply.send({ message: "Message sent", provider: config.provider, providerResponse });
    }
  );

  app.post(
    "/send-bulk",
    { preHandler: [authenticate, requireWhatsappEnabled] },
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

      const contacts = await prisma.contact.findMany({
        where: {
          id: { in: parsed.data.contactIds },
          workspaceId: user.workspaceId,
          optIn: true,
        },
      });

      const config = await getProviderConfig(user.workspaceId);

      const results = await Promise.allSettled(
        contacts.map(async (contact) => {
          let status = "sent";
          try {
            await sendWhatsAppTemplate(
              {
                to: contact.phone,
                templateName: parsed.data.templateName,
                languageCode: parsed.data.languageCode,
                components: parsed.data.components,
              },
              config
            );
          } catch {
            status = "failed";
          }

          await prisma.messageLog.create({
            data: {
              workspaceId: user.workspaceId,
              contactId: contact.id,
              campaignId: parsed.data.campaignId,
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
  app.post("/webhook", async (request, reply) => {
    // Verify Meta signature if APP_SECRET is configured
    if (META_APP_SECRET) {
      const signature = (request.headers["x-hub-signature-256"] as string | undefined) ?? "";
      const expected = "sha256=" + crypto
        .createHmac("sha256", META_APP_SECRET)
        .update(JSON.stringify(request.body))
        .digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
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
              const normalized = normalisePhone(s.recipient_id);
              const contact = await prisma.contact.findFirst({
                where: { workspaceId: ws.id, OR: [{ phone: s.recipient_id }, { phone: normalized }] },
                select: { id: true },
              });
              if (contact) {
                await prisma.messageLog.updateMany({
                  where: { workspaceId: ws.id, contactId: contact.id, status: "sent" },
                  data: { status: newStatus },
                });
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
            const normalized = normalisePhone(fromPhone);
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
                let matches = false;
                if (rule.matchType === "exact") matches = msgLower === keyLower;
                else if (rule.matchType === "contains") matches = msgLower.includes(keyLower);
                else if (rule.matchType === "starts_with") matches = msgLower.startsWith(keyLower);

                if (matches) {
                  try {
                    const wsConfig = await getProviderConfig(ws.id);
                    await sendWhatsAppTemplate(
                      { to: fromPhone, templateName: rule.templateName, languageCode: rule.languageCode, components: [] },
                      wsConfig
                    );
                    await prisma.messageLog.create({
                      data: { workspaceId: ws.id, contactId: contact.id, status: "sent" },
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
      const { ids } = request.body as { ids?: string[] };

      const where = ids?.length
        ? { workspaceId: user.workspaceId, id: { in: ids } }
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

      // Fetch recent messages and deduplicate by fromPhone in app code
      const messages = await prisma.inboundMessage.findMany({
        where: { workspaceId: user.workspaceId },
        orderBy: { receivedAt: "desc" },
        take: 500,
        include: { contact: { select: { id: true, name: true, phone: true } } },
      });

      type MsgRow = (typeof messages)[number];
      const seen = new Set<string>();
      const latestPerPhone = messages.filter((m: MsgRow) => {
        if (seen.has(m.fromPhone)) return false;
        seen.add(m.fromPhone);
        return true;
      });

      const unreadGroups = await prisma.inboundMessage.groupBy({
        by: ["fromPhone"],
        where: { workspaceId: user.workspaceId, read: false },
        _count: { id: true },
      });
      type UnreadRow = (typeof unreadGroups)[number];
      const unreadMap = new Map(unreadGroups.map((g: UnreadRow) => [g.fromPhone, g._count.id]));

      const conversations = latestPerPhone.map((m: MsgRow) => ({
        fromPhone: m.fromPhone,
        contactId: m.contactId,
        contact: m.contact,
        latestMessage: {
          id: m.id,
          body: m.body,
          type: m.type,
          receivedAt: m.receivedAt,
          read: m.read,
        },
        unreadCount: unreadMap.get(m.fromPhone) ?? 0,
      }));

      return reply.send({ conversations });
    }
  );

  // ── Campaign reply counts (for alert badges) ─────────────────────────────
  app.get(
    "/campaign-replies",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;

      const replies = await prisma.inboundMessage.groupBy({
        by: ["campaignId"],
        where: { workspaceId: user.workspaceId, campaignId: { not: null } },
        _count: { id: true },
      });

      const unreadReplies = await prisma.inboundMessage.groupBy({
        by: ["campaignId"],
        where: { workspaceId: user.workspaceId, campaignId: { not: null }, read: false },
        _count: { id: true },
      });

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
}
