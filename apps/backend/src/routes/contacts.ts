import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, checkPermission } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";
import { parsePagination } from "../lib/queryParams";
import { buildContactWhere, contactFilterSchema } from "../lib/contactFilter";

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
    const { tag, search, sort, optIn, leadStatus, ...pageQuery } = request.query as Record<string, string>;
    const { page, limit, skip } = parsePagination(pageQuery, { maxLimit: 1000 });

    // ?optIn=true → opted-in only, ?optIn=false → opted-out only (used by campaign modal/CRM board)
    const where = buildContactWhere(user.workspaceId, {
      tag,
      leadStatus,
      optIn: optIn === "true" ? true : optIn === "false" ? false : undefined,
      search,
    });

    const orderBy = sort === "recent" ? { createdAt: "desc" as const } : { name: "asc" as const };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.contact.count({ where }),
    ]);

    return reply.send({ contacts, total, page, limit });
  });

  app.post("/", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
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

  app.patch("/:id", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
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

  // ── Bulk delete ───────────────────────────────────────────────────────────
  app.delete("/bulk", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const result = await prisma.contact.deleteMany({
      where: { id: { in: parsed.data.ids }, workspaceId: user.workspaceId },
    });

    return reply.send({ deleted: result.count });
  });

  // ── Bulk tag assignment ───────────────────────────────────────────────────
  app.patch("/bulk-tag", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      tags: z.array(z.string().min(1)).min(1).max(20),
      mode: z.enum(["add", "replace"]).default("add"),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { ids, tags, mode } = parsed.data;

    if (mode === "replace") {
      // updateMany scopes to workspaceId — count reflects actually-updated rows
      const result = await prisma.contact.updateMany({
        where: { id: { in: ids }, workspaceId: user.workspaceId },
        data: { tags },
      });
      return reply.send({ updated: result.count });
    }

    // Add mode — merge without duplicates per contact
    const contacts = await prisma.contact.findMany({
      where: { id: { in: ids }, workspaceId: user.workspaceId },
      select: { id: true, tags: true },
    });
    await Promise.all(contacts.map((c: { id: string; tags: string[] }) => {
      const merged = Array.from(new Set([...c.tags, ...tags]));
      return prisma.contact.update({ where: { id: c.id }, data: { tags: merged } });
    }));
    // Return actual count — may differ from ids.length if some IDs don't belong to this workspace
    return reply.send({ updated: contacts.length });
  });

  app.delete("/:id", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
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

    // Hard cap at 50 000 rows — beyond that the user should use pagination or a data-warehouse export
    const EXPORT_LIMIT = 50_000;

    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId: user.workspaceId,
        ...(tag ? { tags: { has: tag } } : {}),
      },
      orderBy: { name: "asc" },
      take: EXPORT_LIMIT,
      select: { id: true, name: true, phone: true, email: true, tags: true, optIn: true, leadStatus: true },
    });

    type ContactRow = { id: string; name: string; phone: string; email: string | null; tags: string[]; optIn: boolean; leadStatus: string };
    const escape = (v: string) => `"${v.replace(/"/g, '""').replace(/\r/g, " ").replace(/\n/g, " ")}"`;
    const header = ["id", "name", "phone", "email", "tags", "opt_in", "lead_status"].join(",");
    const rows = (contacts as ContactRow[]).map((c) =>
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

  app.post("/bulk", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
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

  // ── Contact deduplication ─────────────────────────────────────────────────
  app.post("/deduplicate", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    // Find all duplicate phone groups
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, phone: true, tags: true, optIn: true },
    });

    // Normalise phone for comparison (digits only)
    const normalise = (p: string) => p.replace(/\D/g, "");
    const groups = new Map<string, typeof contacts>();
    for (const c of contacts) {
      const key = normalise(c.phone);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    let merged = 0;
    let removed = 0;

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [keep, ...dupes] = group; // oldest is first (ordered by createdAt asc)
      const mergedTags = Array.from(new Set([...keep.tags, ...dupes.flatMap((d: { tags: string[] }) => d.tags)]));
      const mergedOptIn = group.some((c: { optIn: boolean }) => c.optIn);
      const dupeIds = dupes.map((d: { id: string }) => d.id);

      // Re-parent related records to the kept contact
      // For sequence enrollments: only migrate if kept contact isn't already enrolled in that sequence
      const dupeEnrollments = await prisma.sequenceEnrollment.findMany({
        where: { contactId: { in: dupeIds } },
        select: { id: true, sequenceId: true },
      });
      const keptEnrolledSequences = new Set(
        (await prisma.sequenceEnrollment.findMany({
          where: { contactId: keep.id },
          select: { sequenceId: true },
        })).map((e) => e.sequenceId)
      );
      const enrollmentsToMigrate = dupeEnrollments.filter((e) => !keptEnrolledSequences.has(e.sequenceId)).map((e) => e.id);
      const enrollmentsToDelete = dupeEnrollments.filter((e) => keptEnrolledSequences.has(e.sequenceId)).map((e) => e.id);

      await Promise.all([
        prisma.messageLog.updateMany({ where: { contactId: { in: dupeIds } }, data: { contactId: keep.id } }),
        prisma.inboundMessage.updateMany({ where: { contactId: { in: dupeIds } }, data: { contactId: keep.id } }),
        prisma.contactNote.updateMany({ where: { contactId: { in: dupeIds } }, data: { contactId: keep.id } }),
        enrollmentsToMigrate.length > 0
          ? prisma.sequenceEnrollment.updateMany({ where: { id: { in: enrollmentsToMigrate } }, data: { contactId: keep.id } })
          : Promise.resolve(),
        enrollmentsToDelete.length > 0
          ? prisma.sequenceEnrollment.deleteMany({ where: { id: { in: enrollmentsToDelete } } })
          : Promise.resolve(),
      ]);

      await prisma.contact.update({ where: { id: keep.id }, data: { tags: mergedTags, optIn: mergedOptIn } });
      await prisma.contact.deleteMany({ where: { id: { in: dupeIds } } });

      merged++;
      removed += dupeIds.length;
    }

    return reply.send({ merged, removed });
  });

  // ── CRM: update lead status ───────────────────────────────────────────────
  app.patch("/:id/lead-status", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
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

    type ScoreLog = { status: string };
    const breakdown = (logs as ScoreLog[]).reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const raw = (logs as ScoreLog[]).reduce<number>((sum, l) => sum + (SCORE_MAP[l.status] ?? 0), 0) / total;
    return reply.send({ score: Math.round(raw), total, breakdown });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVED SEGMENTS — reusable contact audiences for campaigns
  // ═══════════════════════════════════════════════════════════════════════════

  // List segments (with a live contact count for each)
  app.get("/segments", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const segments = await prisma.contactSegment.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    const withCounts = await Promise.all(
      segments.map(async (seg) => {
        const filter = contactFilterSchema.safeParse(seg.filter);
        const count = filter.success
          ? await prisma.contact.count({ where: buildContactWhere(user.workspaceId, filter.data) })
          : 0;
        return { ...seg, count };
      })
    );

    return reply.send({ segments: withCounts });
  });

  // Create a segment
  app.post("/segments", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = z
      .object({ name: z.string().min(1), filter: contactFilterSchema })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.contactSegment.findUnique({
      where: { workspaceId_name: { workspaceId: user.workspaceId, name: parsed.data.name } },
    });
    if (existing) return reply.status(409).send({ error: "A segment with that name already exists" });

    const segment = await prisma.contactSegment.create({
      data: { workspaceId: user.workspaceId, name: parsed.data.name, filter: parsed.data.filter },
    });
    return reply.status(201).send(segment);
  });

  // Update a segment
  app.patch("/segments/:id", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ name: z.string().min(1).optional(), filter: contactFilterSchema.optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.contactSegment.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Segment not found" });

    const segment = await prisma.contactSegment.update({
      where: { id },
      data: { name: parsed.data.name, filter: parsed.data.filter },
    });
    return reply.send(segment);
  });

  // Delete a segment
  app.delete("/segments/:id", { preHandler: [checkPermission("can_manage_contacts")] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.contactSegment.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Segment not found" });
    await prisma.contactSegment.delete({ where: { id } });
    return reply.send({ message: "Segment deleted" });
  });

  // Resolve a segment to live, opted-in contact IDs — the campaign send modal
  // calls this to turn a saved audience into the contactIds /send-bulk expects.
  app.get("/segments/:id/resolve", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const segment = await prisma.contactSegment.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!segment) return reply.status(404).send({ error: "Segment not found" });

    const filter = contactFilterSchema.safeParse(segment.filter);
    if (!filter.success) return reply.status(422).send({ error: "Segment filter is malformed" });

    // Force opt-in: campaigns may only target opted-in contacts regardless of the
    // saved filter, so a segment can never be used to message opted-out people.
    const where = buildContactWhere(user.workspaceId, { ...filter.data, optIn: true });
    const contacts = await prisma.contact.findMany({ where, select: { id: true } });

    return reply.send({ segmentId: id, name: segment.name, contactIds: contacts.map((c) => c.id), total: contacts.length });
  });
}
