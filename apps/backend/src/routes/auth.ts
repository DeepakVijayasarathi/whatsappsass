import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { name, email, password, workspaceName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const workspace = await prisma.workspace.create({
      data: { name: workspaceName, plan: "lite", status: "active" },
    });

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "owner", workspaceId: workspace.id },
    });

    const token = app.jwt.sign(
      { userId: user.id, workspaceId: workspace.id, role: user.role },
      { expiresIn: "7d" }
    );

    return reply.status(201).send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      workspace: { id: workspace.id, name: workspace.name },
    });
  });

  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
    });

    if (!workspace || workspace.status !== "active") {
      return reply.status(403).send({ error: "Workspace is suspended" });
    }

    const token = app.jwt.sign(
      { userId: user.id, workspaceId: user.workspaceId, role: user.role },
      { expiresIn: "7d" }
    );

    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      workspace: { id: workspace.id, name: workspace.name, plan: workspace.plan },
    });
  });
}
