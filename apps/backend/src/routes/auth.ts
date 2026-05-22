import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../lib/email";

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [workspace, user] = await prisma.$transaction(async (tx: any) => {
      const ws = await tx.workspace.create({
        data: { name: workspaceName, plan: "lite", status: "active" },
      });
      const u = await tx.user.create({
        data: { name, email, passwordHash, role: "owner", workspaceId: ws.id },
      });
      return [ws, u] as const;
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

  // ── Forgot password ───────────────────────────────────────────────────────
  app.post("/forgot-password", async (request, reply) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    // Always return 200 to prevent user enumeration
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) return reply.send({ message: "If that email exists, a reset link has been sent." });

    const ws = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFromEmail: true, smtpFromName: true },
    });
    if (!ws?.smtpHost || !ws.smtpUser || !ws.smtpPass || !ws.smtpFromEmail) {
      // SMTP not configured — still 200 to avoid enumeration, but log the problem
      app.log.warn({ userId: user.id }, "Password reset requested but SMTP not configured");
      return reply.send({ message: "If that email exists, a reset link has been sent." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any previous tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendEmail(
      { host: ws.smtpHost, port: ws.smtpPort ?? 587, user: ws.smtpUser, pass: ws.smtpPass, fromEmail: ws.smtpFromEmail, fromName: ws.smtpFromName },
      {
        to: user.email,
        subject: "Reset your password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Reset your password</h2>
            <p>Hi ${user.name},</p>
            <p>Click the link below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
              Reset Password
            </a>
            <p style="color:#666;font-size:13px">If you didn't request this, ignore this email. Your password won't change.</p>
          </div>
        `,
        text: `Reset your password: ${resetUrl}`,
      }
    );

    return reply.send({ message: "If that email exists, a reset link has been sent." });
  });

  // ── Reset password ────────────────────────────────────────────────────────
  app.post("/reset-password", async (request, reply) => {
    const parsed = z
      .object({ token: z.string().min(1), password: z.string().min(8) })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");

    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.used || record.expiresAt < new Date()) {
      return reply.status(400).send({ error: "Reset link is invalid or has expired." });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    ]);

    return reply.send({ message: "Password updated successfully. You can now sign in." });
  });
}
