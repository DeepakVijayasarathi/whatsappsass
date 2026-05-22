import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireWhatsappEnabled } from "../middleware/whatsappEnabled";
import type { JwtPayload } from "../middleware/authenticate";
import { sendWhatsAppTemplate } from "../lib/whatsapp";
import type { ProviderConfig } from "../lib/whatsapp";

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
        const contact = await prisma.contact.findFirst({
          where: { phone: parsed.data.to, workspaceId: user.workspaceId },
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
        contactIds: z.array(z.string().uuid()).min(1).max(100),
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

      return reply.send({ summary, total: contacts.length });
    }
  );

  // ── Webhook verification (GET) ───────────────────────────────────────────────
  // Meta calls this with the verify_token you set in Meta console.
  // We match it against any active workspace's metaWebhookVerifyToken.
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

  // ── Webhook inbound (POST) ────────────────────────────────────────────────────
  // Routes each message to the workspace whose metaPhoneNumberId matches.
  app.post("/webhook", async (request, reply) => {
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

      for (const s of value.statuses ?? []) {
        app.log.info({ messageId: s.id, status: s.status }, "Status update");
      }

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

        // Route to the workspace that owns this phone number
        const workspaces = phoneNumberId
          ? await prisma.workspace.findMany({
              where: { metaPhoneNumberId: phoneNumberId, status: "active" },
              select: { id: true },
            })
          : [];

        for (const ws of workspaces) {
          const existing = await prisma.inboundMessage.findUnique({
            where: { messageId: msg.id },
          });
          if (existing) continue;

          const contact = await prisma.contact.findFirst({
            where: { workspaceId: ws.id, phone: fromPhone },
          });

          await prisma.inboundMessage.create({
            data: {
              workspaceId: ws.id,
              contactId: contact?.id ?? null,
              fromPhone,
              messageId: msg.id,
              type: msg.type,
              body: bodyText,
              replyToMessageId: msg.context?.id ?? null,
              rawPayload: msg as object,
            },
          });

          app.log.info(
            { from: fromPhone, type: msg.type, replyTo: msg.context?.id },
            "Inbound message captured"
          );
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
      const { page = "1", limit = "20", unread } = request.query as Record<string, string>;

      const skip = (Number(page) - 1) * Number(limit);
      const where = {
        workspaceId: user.workspaceId,
        ...(unread === "true" ? { read: false } : {}),
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
}
