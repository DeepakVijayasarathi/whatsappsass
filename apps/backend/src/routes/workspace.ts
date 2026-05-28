import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";
import { encrypt, decryptNullable, maskHint, DECRYPT_FAILED } from "../lib/encrypt";

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

      if (Object.keys(updateData).length === 0) {
        return reply.send({ id: user.id, name: user.name, email: user.email, role: user.role });
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
          metaAccessToken: z.string().optional(),
          // Allow empty string — we preserve existing stored value when blank
          metaWebhookVerifyToken: z.string().optional(),
        }),
        z.object({
          whatsappProvider: z.literal("msg91"),
          msg91AuthKey: z.string().optional(),
          // Allow empty string — frontend sends "" when integrated number is set but not changed
          msg91IntegratedNumber: z.string().optional(),
        }),
      ]);

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      // Fetch existing workspace so we can preserve stored secrets / optional fields when blank is submitted
      const existing = await prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: {
          metaAccessToken: true,
          metaWebhookVerifyToken: true,
          msg91AuthKey: true,
          msg91IntegratedNumber: true,
        },
      });

      // Keep the submitted value if non-blank, otherwise keep stored, otherwise null.
      // Never stores empty string — that would cause downstream parsers (e.g. MSG91 number formats)
      // to produce garbage. null means "not configured" and is handled gracefully everywhere.
      const keepOrNull = (submitted: string | undefined, stored: string | null | undefined): string | null => {
        const s = submitted?.trim() ?? "";
        if (s.length > 0) return s;
        const t = stored?.trim() ?? "";
        return t.length > 0 ? t : null;
      };

      // Encrypt new secret values; keep (already-encrypted) stored value when blank
      const encryptIfNew = (submitted: string | undefined, stored: string | null | undefined): string | null => {
        const s = submitted?.trim() ?? "";
        if (s.length > 0) return encrypt(s);           // new value → encrypt
        const t = stored?.trim() ?? "";
        return t.length > 0 ? t : null;                // keep stored (already encrypted) or null
      };

      const updateData =
        parsed.data.whatsappProvider === "meta"
          ? {
              whatsappProvider: "meta" as const,
              metaPhoneNumberId: parsed.data.metaPhoneNumberId?.trim() ?? "",
              metaWabaId: parsed.data.metaWabaId?.trim() ?? "",
              metaAccessToken: encryptIfNew(parsed.data.metaAccessToken, existing?.metaAccessToken),
              metaWebhookVerifyToken: encryptIfNew(parsed.data.metaWebhookVerifyToken, existing?.metaWebhookVerifyToken),
              msg91AuthKey: null,
              msg91IntegratedNumber: null,
            }
          : {
              whatsappProvider: "msg91" as const,
              msg91AuthKey: encryptIfNew(parsed.data.msg91AuthKey, existing?.msg91AuthKey),
              msg91IntegratedNumber: keepOrNull(parsed.data.msg91IntegratedNumber, existing?.msg91IntegratedNumber),
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

  // ── SMTP / email config ────────────────────────────────────────────────────
  app.patch(
    "/smtp",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({
        smtpHost:      z.string().min(1),
        smtpPort:      z.number().int().min(1).max(65535).default(587),
        smtpUser:      z.string().min(1),
        smtpPass:      z.string().optional(), // blank = keep existing
        smtpFromEmail: z.string().email(),
        smtpFromName:  z.string().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const { smtpPass, ...rest } = parsed.data;

      // Only update smtpPass when a new value is supplied
      const updatePass = smtpPass?.trim()
        ? { smtpPass: encrypt(smtpPass.trim()) }
        : {};

      // Validate that the workspace has a password (either stored or newly supplied)
      if (!smtpPass?.trim()) {
        const existing = await prisma.workspace.findUnique({
          where: { id: user.workspaceId },
          select: { smtpPass: true },
        });
        if (!existing?.smtpPass) {
          return reply.status(400).send({ error: "SMTP password is required" });
        }
      }

      await prisma.workspace.update({
        where: { id: user.workspaceId },
        data: { ...rest, ...updatePass },
      });
      return reply.send({ message: "Email config saved" });
    }
  );

  app.get(
    "/smtp",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const ws = await prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFromEmail: true, smtpFromName: true },
      });
      if (!ws) return reply.send({});
      const { smtpPass, ...safe } = ws;
      const passPlain = decryptNullable(smtpPass);
      return reply.send({
        ...safe,
        hasSmtpPass: !!(passPlain),
        smtpPassHint: maskHint(passPlain),
      });
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
          metaPhoneNumberId: true,
          metaWabaId: true,
          metaWebhookVerifyToken: true,
          msg91IntegratedNumber: true,
          // Secrets — only return boolean flags, never the actual values
          metaAccessToken: true,
          msg91AuthKey: true,
        },
      });
      if (!workspace) return reply.status(404).send({ error: "Not found" });
      // Decrypt to get plaintext for hint generation, but NEVER send the actual value
      const metaTokenRaw = decryptNullable(workspace.metaAccessToken);
      const msg91KeyRaw  = decryptNullable(workspace.msg91AuthKey);
      const webhookTokenRaw = decryptNullable(workspace.metaWebhookVerifyToken);
      // Treat DECRYPT_FAILED as "present but unreadable" — show a hint so user knows to re-enter
      const metaTokenPlain = metaTokenRaw === DECRYPT_FAILED ? null : metaTokenRaw;
      const msg91KeyPlain  = msg91KeyRaw  === DECRYPT_FAILED ? null : msg91KeyRaw;
      const webhookTokenPlain = webhookTokenRaw === DECRYPT_FAILED ? null : webhookTokenRaw;
      const { metaAccessToken, msg91AuthKey, metaWebhookVerifyToken, ...safe } = workspace;
      return reply.send({
        ...safe,
        hasMetaAccessToken:         metaTokenRaw === DECRYPT_FAILED ? true : !!(metaTokenPlain),
        hasMsg91AuthKey:            msg91KeyRaw  === DECRYPT_FAILED ? true : !!(msg91KeyPlain),
        metaAccessTokenHint:        metaTokenRaw === DECRYPT_FAILED ? "⚠ Re-enter (key changed)" : maskHint(metaTokenPlain),
        msg91AuthKeyHint:           msg91KeyRaw  === DECRYPT_FAILED ? "⚠ Re-enter (key changed)" : maskHint(msg91KeyPlain),
        metaWebhookVerifyToken:     webhookTokenPlain,
        metaWebhookVerifyTokenHint: webhookTokenRaw === DECRYPT_FAILED ? "⚠ Re-enter (key changed)" : maskHint(webhookTokenPlain),
        credentialDecryptError:     (metaTokenRaw === DECRYPT_FAILED || msg91KeyRaw === DECRYPT_FAILED)
                                      ? "Stored credentials could not be decrypted. ENCRYPTION_KEY may have changed. Please re-enter your credentials."
                                      : undefined,
      });
    }
  );

  // ── Onboarding status ──────────────────────────────────────────────────────
  app.get(
    "/onboarding-status",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;

      const [workspace, contactCount, campaignCount] = await Promise.all([
        prisma.workspace.findUnique({
          where: { id: user.workspaceId },
          select: {
            metaPhoneNumberId: true,
            metaAccessToken: true,
            msg91AuthKey: true,
            msg91IntegratedNumber: true,
            whatsappProvider: true,
            metaWhatsappEnabled: true,
            smtpHost: true,
          },
        }),
        prisma.contact.count({ where: { workspaceId: user.workspaceId } }),
        prisma.campaign.count({ where: { workspaceId: user.workspaceId } }),
      ]);

      if (!workspace) return reply.status(404).send({ error: "Not found" });

      const metaTokenOk = decryptNullable(workspace.metaAccessToken);
      const msg91KeyOk  = decryptNullable(workspace.msg91AuthKey);
      const providerConfigured =
        workspace.whatsappProvider === "meta"
          ? !!(workspace.metaPhoneNumberId && metaTokenOk && metaTokenOk !== DECRYPT_FAILED)
          : !!(msg91KeyOk && msg91KeyOk !== DECRYPT_FAILED && workspace.msg91IntegratedNumber);

      return reply.send({
        steps: {
          providerConfigured,
          whatsappEnabled: workspace.metaWhatsappEnabled,
          hasContacts: contactCount > 0,
          hasTemplates: campaignCount > 0,
        },
        counts: { contacts: contactCount, templates: campaignCount },
      });
    }
  );
}
