import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, checkPermission } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
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

  // ── CSV export ─────────────────────────────────────────────────────────────
  app.get("/export", { preHandler: [checkPermission("can_export")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { tag } = request.query as Record<string, string>;

    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId: user.workspaceId,
        ...(tag ? { tags: { has: tag } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, email: true, tags: true, optIn: true, leadStatus: true },
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["id", "name", "phone", "email", "tags", "opt_in", "lead_status"].join(",");
    const rows = contacts.map((c) =>
      [
        escape(c.id),
        escape(c.name),
        escape(c.phone),
        escape(c.email ?? ""),
        escape(c.tags.join("|")),
        c.optIn ? "true" : "false",
        escape(c.leadStatus),
      ].join(",")
    );

    const csv = [header, ...rows].join("\n");

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="contacts-${Date.now()}.csv"`)
      .send(csv);
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

  // ── CRM: update lead status ───────────────────────────────────────────────
  app.patch("/:id/lead-status", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const VALID = ["new", "prospect", "qualified", "customer", "churned"];
    if (!VALID.includes(status)) {
      return reply.status(400).send({ error: `status must be one of: ${VALID.join(", ")}` });
    }

    const existing = await prisma.contact.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) return reply.status(404).send({ error: "Contact not found" });

    const contact = await prisma.contact.update({
      where: { id },
      data: { leadStatus: status },
    });

    return reply.send(contact);
  });

  // ── CRM: notes ───────────────────────────────────────────────────────────
  app.get("/:id/notes", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const contact = await prisma.contact.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!contact) return reply.status(404).send({ error: "Contact not found" });

    const notes = await prisma.contactNote.findMany({
      where: { contactId: id, workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ notes });
  });

  app.post("/:id/notes", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const parsed = z.object({ body: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const contact = await prisma.contact.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!contact) return reply.status(404).send({ error: "Contact not found" });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });

    const note = await prisma.contactNote.create({
      data: {
        workspaceId: user.workspaceId,
        contactId: id,
        userId: user.userId,
        userEmail: dbUser?.email ?? null,
        body: parsed.data.body,
      },
    });

    return reply.status(201).send(note);
  });

  app.delete("/:id/notes/:noteId", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id, noteId } = request.params as { id: string; noteId: string };

    const note = await prisma.contactNote.findFirst({
      where: { id: noteId, contactId: id, workspaceId: user.workspaceId },
    });
    if (!note) return reply.status(404).send({ error: "Note not found" });

    await prisma.contactNote.delete({ where: { id: noteId } });

    return reply.send({ message: "Note deleted" });
  });

  // ── CRM: timeline (sent + received messages merged) ───────────────────────
  app.get("/:id/timeline", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const contact = await prisma.contact.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: { notes: { orderBy: { createdAt: "desc" } } },
    });
    if (!contact) return reply.status(404).send({ error: "Contact not found" });

    const [sentLogs, inbound] = await Promise.all([
      prisma.messageLog.findMany({
        where: { contactId: id, workspaceId: user.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { campaign: { select: { id: true, name: true } } },
      }),
      prisma.inboundMessage.findMany({
        where: { contactId: id, workspaceId: user.workspaceId },
        orderBy: { receivedAt: "desc" },
        take: 50,
      }),
    ]);

    type SentEntry = { type: "sent"; id: string; status: string; campaign: { id: string; name: string } | null; createdAt: Date };
    type ReceivedEntry = { type: "received"; id: string; body: string | null; msgType: string; replyToMessageId: string | null; createdAt: Date };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sentEntries: SentEntry[] = (sentLogs as any[]).map((l: SentEntry & { createdAt: Date; campaign: { id: string; name: string } | null }) => ({
      type: "sent" as const,
      id: l.id,
      status: l.status,
      campaign: l.campaign,
      createdAt: l.createdAt,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receivedEntries: ReceivedEntry[] = (inbound as any[]).map((m: { id: string; body: string | null; type: string; replyToMessageId: string | null; receivedAt: Date }) => ({
      type: "received" as const,
      id: m.id,
      body: m.body,
      msgType: m.type,
      replyToMessageId: m.replyToMessageId,
      createdAt: m.receivedAt,
    }));

    const timeline = [...sentEntries, ...receivedEntries]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return reply.send({ contact, timeline });
  });

  // ── Engagement score ──────────────────────────────────────────────────────
  app.get("/:id/engagement", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const contact = await prisma.contact.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!contact) return reply.status(404).send({ error: "Contact not found" });

    const logs = await prisma.messageLog.findMany({
      where: { contactId: id, workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { status: true },
    });

    const SCORE_MAP: Record<string, number> = { read: 100, delivered: 70, sent: 40, failed: 0 };
    const total = logs.length;
    if (total === 0) return reply.send({ score: 0, total: 0, breakdown: {} });

    const breakdown = logs.reduce((acc: Record<string, number>, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const raw = logs.reduce((sum: number, l) => sum + (SCORE_MAP[l.status] ?? 0), 0) / total;
    return reply.send({ score: Math.round(raw), total, breakdown });
  });
}
