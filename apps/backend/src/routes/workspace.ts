import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

export async function workspaceRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    const workspace = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: {
        id: true,
        name: true,
        plan: true,
        metaWhatsappEnabled: true,
        whatsappProvider: true,
        msg91IntegratedNumber: true,
        status: true,
        licenseKey: true,
        createdAt: true,
      },
    });

    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });

    return reply.send(workspace);
  });

  app.patch(
    "/me",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({ name: z.string().min(1).optional() });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const workspace = await prisma.workspace.update({
        where: { id: user.workspaceId },
        data: parsed.data,
      });

      return reply.send(workspace);
    }
  );

  app.get(
    "/members",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;

      const members = await prisma.user.findMany({
        where: { workspaceId: user.workspaceId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });

      return reply.send(members);
    }
  );

  app.post(
    "/invite",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(["admin", "marketer"]),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const existing = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });
      if (existing) {
        return reply.status(409).send({ error: "Email already in use" });
      }

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(parsed.data.password, 10);

      const newUser = await prisma.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: parsed.data.role,
          workspaceId: user.workspaceId,
        },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });

      return reply.status(201).send(newUser);
    }
  );

  // ── Member role update ─────────────────────────────────────────────────────
  app.patch(
    "/members/:id/role",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const actor = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const schema = z.object({ role: z.enum(["admin", "marketer"]) });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const target = await prisma.user.findFirst({
        where: { id, workspaceId: actor.workspaceId },
      });
      if (!target) return reply.status(404).send({ error: "Member not found" });
      if (target.role === "owner") {
        return reply.status(403).send({ error: "Cannot change the owner's role" });
      }
      if (actor.role !== "owner" && target.role === "admin") {
        return reply.status(403).send({ error: "Only owner can change an admin's role" });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { role: parsed.data.role },
        select: { id: true, name: true, email: true, role: true },
      });

      return reply.send(updated);
    }
  );

  // ── Remove member ──────────────────────────────────────────────────────────
  app.delete(
    "/members/:id",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const actor = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      if (id === actor.userId) {
        return reply.status(400).send({ error: "You cannot remove yourself" });
      }

      const target = await prisma.user.findFirst({
        where: { id, workspaceId: actor.workspaceId },
      });
      if (!target) return reply.status(404).send({ error: "Member not found" });
      if (target.role === "owner") {
        return reply.status(403).send({ error: "Cannot remove the workspace owner" });
      }
      if (actor.role !== "owner" && target.role === "admin") {
        return reply.status(403).send({ error: "Only owner can remove an admin" });
      }

      await prisma.user.delete({ where: { id } });
      return reply.send({ message: "Member removed" });
    }
  );

  // ── Current user profile ───────────────────────────────────────────────────
  app.get(
    "/profile",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const actor = request.user as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });
      return reply.send(user);
    }
  );

  // ── Update own profile / password ─────────────────────────────────────────
  app.patch(
    "/profile",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const actor = request.user as JwtPayload;
      const schema = z.object({
        name: z.string().min(1).optional(),
        currentPassword: z.string().optional(),
        newPassword: z.string().min(8).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const user = await prisma.user.findUnique({ where: { id: actor.userId } });
      if (!user) return reply.status(404).send({ error: "User not found" });

      const updateData: { name?: string; passwordHash?: string } = {};

      if (parsed.data.name) updateData.name = parsed.data.name;

      if (parsed.data.newPassword) {
        if (!parsed.data.currentPassword) {
          return reply.status(400).send({ error: "Current password required to set new password" });
        }
        const bcrypt = await import("bcryptjs");
        const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
        if (!valid) return reply.status(401).send({ error: "Current password is incorrect" });
        updateData.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
      }

      const updated = await prisma.user.update({
        where: { id: actor.userId },
        data: updateData,
        select: { id: true, name: true, email: true, role: true },
      });

      return reply.send(updated);
    }
  );

  // ── WhatsApp provider configuration ────────────────────────────────────────
  app.patch(
    "/provider",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.discriminatedUnion("whatsappProvider", [
        z.object({
          whatsappProvider: z.literal("meta"),
          metaPhoneNumberId: z.string().min(1, "Phone Number ID required"),
          metaWabaId: z.string().min(1, "WABA ID required"),
          metaAccessToken: z.string().min(1, "Access Token required"),
          metaWebhookVerifyToken: z.string().min(1, "Webhook Verify Token required"),
        }),
        z.object({
          whatsappProvider: z.literal("msg91"),
          msg91AuthKey: z.string().min(1, "Auth key required"),
          msg91IntegratedNumber: z.string().min(7, "Integrated number required"),
        }),
      ]);

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const updateData =
        parsed.data.whatsappProvider === "meta"
          ? {
              whatsappProvider: "meta" as const,
              metaPhoneNumberId: parsed.data.metaPhoneNumberId,
              metaWabaId: parsed.data.metaWabaId,
              metaAccessToken: parsed.data.metaAccessToken,
              metaWebhookVerifyToken: parsed.data.metaWebhookVerifyToken,
              msg91AuthKey: null,
              msg91IntegratedNumber: null,
            }
          : {
              whatsappProvider: "msg91" as const,
              msg91AuthKey: parsed.data.msg91AuthKey,
              msg91IntegratedNumber: parsed.data.msg91IntegratedNumber,
              metaPhoneNumberId: null,
              metaWabaId: null,
              metaAccessToken: null,
              metaWebhookVerifyToken: null,
            };

      const workspace = await prisma.workspace.update({
        where: { id: user.workspaceId },
        data: updateData,
        select: {
          whatsappProvider: true,
          metaPhoneNumberId: true,
          metaWabaId: true,
          metaWebhookVerifyToken: true,
          msg91IntegratedNumber: true,
        },
      });

      // Never return secrets (access token, auth key) in the response
      return reply.send({ message: "Provider updated", ...workspace });
    }
  );

  app.get(
    "/provider",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const workspace = await prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        // Omit secret fields (metaAccessToken, msg91AuthKey) from response
        select: {
          whatsappProvider: true,
          metaPhoneNumberId: true,
          metaWabaId: true,
          metaWebhookVerifyToken: true,
          msg91IntegratedNumber: true,
        },
      });
      return reply.send(workspace);
    }
  );
}
