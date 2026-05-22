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

  // ── WhatsApp provider configuration ────────────────────────────────────────
  app.patch(
    "/provider",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({
        whatsappProvider: z.enum(["meta", "msg91"]),
        msg91AuthKey: z.string().optional(),
        msg91IntegratedNumber: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      if (parsed.data.whatsappProvider === "msg91") {
        if (!parsed.data.msg91AuthKey || !parsed.data.msg91IntegratedNumber) {
          return reply.status(400).send({
            error: "msg91AuthKey and msg91IntegratedNumber are required for MSG91",
          });
        }
      }

      const workspace = await prisma.workspace.update({
        where: { id: user.workspaceId },
        data: {
          whatsappProvider: parsed.data.whatsappProvider,
          msg91AuthKey: parsed.data.msg91AuthKey ?? null,
          msg91IntegratedNumber: parsed.data.msg91IntegratedNumber ?? null,
        },
        select: {
          whatsappProvider: true,
          msg91IntegratedNumber: true,
        },
      });

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
        select: {
          whatsappProvider: true,
          msg91IntegratedNumber: true,
        },
      });
      return reply.send(workspace);
    }
  );
}
