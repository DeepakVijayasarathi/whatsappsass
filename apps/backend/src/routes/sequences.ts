import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

export async function sequenceRoutes(app: FastifyInstance) {
  // ── List sequences ────────────────────────────────────────────────────────
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const sequences = await prisma.campaignSequence.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        _count: { select: { enrollments: true } },
      },
    });
    return reply.send({ sequences });
  });

  // ── Get one sequence ──────────────────────────────────────────────────────
  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const seq = await prisma.campaignSequence.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        enrollments: {
          include: { contact: { select: { id: true, name: true, phone: true } } },
          orderBy: { startedAt: "desc" },
          take: 50,
        },
        _count: { select: { enrollments: true } },
      },
    });
    if (!seq) return reply.status(404).send({ error: "Sequence not found" });
    return reply.send(seq);
  });

  // ── Create sequence ───────────────────────────────────────────────────────
  app.post("/", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const schema = z.object({
      name:  z.string().min(1),
      steps: z.array(z.object({
        stepNumber:   z.number().int().min(1),
        templateName: z.string().min(1),
        languageCode: z.string().default("en_US"),
        delayDays:    z.number().int().min(0).default(0),
      })).min(1, "At least one step required")
        .superRefine((steps, ctx) => {
          // Step numbers must be unique
          const nums = steps.map((s) => s.stepNumber);
          const dupes = nums.filter((n, i) => nums.indexOf(n) !== i);
          if (dupes.length > 0) {
            ctx.addIssue({ code: "custom", message: `Duplicate step numbers: ${[...new Set(dupes)].join(", ")}` });
          }
          // Step numbers must form a contiguous sequence starting at 1
          const sorted = [...nums].sort((a, b) => a - b);
          const expected = Array.from({ length: sorted.length }, (_, i) => i + 1);
          if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
            ctx.addIssue({ code: "custom", message: `Step numbers must be sequential starting from 1 (got: ${sorted.join(", ")})` });
          }
        }),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const seq = await prisma.campaignSequence.create({
      data: {
        workspaceId: user.workspaceId,
        name: parsed.data.name,
        steps: { create: parsed.data.steps },
      },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    });
    return reply.status(201).send(seq);
  });

  // ── Update sequence status / name ─────────────────────────────────────────
  app.patch("/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const schema = z.object({
      name:   z.string().min(1).optional(),
      status: z.enum(["draft", "active", "paused"]).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.campaignSequence.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.campaignSequence.update({ where: { id }, data: parsed.data });
    return reply.send(updated);
  });

  // ── Delete sequence ───────────────────────────────────────────────────────
  app.delete("/:id", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.campaignSequence.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (existing.status === "active" && existing._count.enrollments > 0) {
      return reply.status(409).send({ error: "Pause the sequence and stop all enrollments before deleting" });
    }
    // Stop any remaining enrollments before cascade delete
    await prisma.sequenceEnrollment.updateMany({
      where: { sequenceId: id, status: "active" },
      data: { status: "stopped", completedAt: new Date() },
    });
    await prisma.campaignSequence.delete({ where: { id } });
    return reply.send({ message: "Deleted" });
  });

  // ── Enroll contacts ───────────────────────────────────────────────────────
  app.post("/:id/enroll", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const schema = z.object({ contactIds: z.array(z.string().uuid()).min(1) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const seq = await prisma.campaignSequence.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!seq) return reply.status(404).send({ error: "Sequence not found" });
    if (seq.status !== "active") return reply.status(409).send({ error: "Activate the sequence before enrolling contacts" });

    // Verify all submitted contacts belong to this workspace and have opted in
    const contacts = await prisma.contact.findMany({
      where: { id: { in: parsed.data.contactIds }, workspaceId: user.workspaceId },
      select: { id: true, optIn: true },
    });

    const contactMap = new Map<string, { id: string; optIn: boolean }>((contacts as Array<{ id: string; optIn: boolean }>).map((c) => [c.id, c]));

    // Reject if any ID doesn't belong to this workspace
    const unknown = parsed.data.contactIds.filter((cid) => !contactMap.has(cid));
    if (unknown.length > 0) {
      return reply.status(400).send({ error: `Unknown contact IDs: ${unknown.join(", ")}` });
    }

    // Reject non-opted-in contacts — WhatsApp compliance requirement
    const notOptedIn = parsed.data.contactIds.filter((cid) => !contactMap.get(cid)?.optIn);
    if (notOptedIn.length > 0) {
      return reply.status(400).send({
        error: `${notOptedIn.length} contact(s) have not opted in to receive messages. Only opted-in contacts can be enrolled in sequences.`,
        notOptedIn,
      });
    }

    // Skip contacts that are already actively enrolled (status = "active" or "completed")
    // Allow re-enrollment of stopped/failed contacts by resetting them
    const existingEnrollments = await prisma.sequenceEnrollment.findMany({
      where: { sequenceId: id, contactId: { in: parsed.data.contactIds } },
      select: { contactId: true, status: true },
    });
    type EnrollRow = { contactId: string; status: string };
    const activeOrCompleted = new Set(
      (existingEnrollments as EnrollRow[])
        .filter((e) => e.status === "active" || e.status === "completed")
        .map((e) => e.contactId)
    );
    const stoppedIds = (existingEnrollments as EnrollRow[])
      .filter((e) => e.status === "stopped")
      .map((e) => e.contactId);

    const toEnroll = parsed.data.contactIds.filter((cid) => !activeOrCompleted.has(cid));
    if (toEnroll.length === 0) return reply.send({ enrolled: 0, skipped: activeOrCompleted.size });

    // Reset stopped enrollments so they restart from step 0
    if (stoppedIds.length > 0) {
      await prisma.sequenceEnrollment.updateMany({
        where: { sequenceId: id, contactId: { in: stoppedIds } },
        data: { status: "active", currentStep: 0, completedAt: null },
      });
    }

    // Create new enrollments for contacts that have never been enrolled
    const brandNewIds = toEnroll.filter((cid) => !stoppedIds.includes(cid));
    if (brandNewIds.length > 0) {
      await prisma.sequenceEnrollment.createMany({
        data: brandNewIds.map((contactId) => ({
          sequenceId: id,
          contactId,
          currentStep: 0,
          status: "active",
        })),
      });
    }

    return reply.send({ enrolled: toEnroll.length, skipped: activeOrCompleted.size });
  });

  // ── Stop enrollment for a contact ─────────────────────────────────────────
  app.patch("/:id/enrollments/:contactId/stop", { preHandler: [requireOwnerOrAdmin] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id, contactId } = request.params as { id: string; contactId: string };

    const seq = await prisma.campaignSequence.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!seq) return reply.status(404).send({ error: "Not found" });

    await prisma.sequenceEnrollment.updateMany({
      where: { sequenceId: id, contactId, status: "active" },
      data: { status: "stopped", completedAt: new Date() },
    });
    return reply.send({ ok: true });
  });

  // ── Enrollment stats ──────────────────────────────────────────────────────
  app.get("/:id/stats", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const seq = await prisma.campaignSequence.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!seq) return reply.status(404).send({ error: "Not found" });

    const enrollments = await prisma.sequenceEnrollment.findMany({
      where: { sequenceId: id },
      select: { status: true, currentStep: true },
    });

    const stats = (enrollments as Array<{ status: string; currentStep: number }>).reduce<Record<string, number>>((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    }, {});

    return reply.send({ stats, total: enrollments.length });
  });

  // ── Active enrollment count (sidebar badge) ────────────────────────────────
  app.get("/enrollments/active-count", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    // SequenceEnrollment has no workspaceId — filter through the parent sequence
    const count = await prisma.sequenceEnrollment.count({
      where: {
        status: "active",
        sequence: { workspaceId: user.workspaceId },
      },
    });
    return reply.send({ count });
  });
}
