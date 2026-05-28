import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireOwnerOrAdmin } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

export async function licenseRoutes(app: FastifyInstance) {
  app.post(
    "/activate",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({
        key: z.string().regex(/^LITE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid license key format" });
      }

      const license = await prisma.licenseKey.findUnique({
        where: { key: parsed.data.key },
      });

      if (!license) {
        return reply.status(404).send({ error: "License key not found" });
      }

      if (license.status === "expired") {
        return reply.status(410).send({ error: "License key has expired" });
      }

      if (license.workspaceId && license.workspaceId !== user.workspaceId) {
        return reply.status(409).send({ error: "License key is already in use by another workspace" });
      }

      if (license.expiryDate && license.expiryDate < new Date()) {
        await prisma.licenseKey.update({
          where: { key: parsed.data.key },
          data: { status: "expired" },
        });
        return reply.status(410).send({ error: "License key has expired" });
      }

      // Atomic "claim" using updateMany with a WHERE condition — prevents TOCTOU.
      // Two concurrent requests both pass the checks above, but only ONE can
      // win this updateMany because it matches only unassigned (workspaceId IS NULL) rows.
      const claimed = await prisma.licenseKey.updateMany({
        where: { key: parsed.data.key, workspaceId: null },
        data: { workspaceId: user.workspaceId, status: "active" },
      });

      if (claimed.count === 0) {
        // Another request beat us to it (or the key was already assigned)
        const current = await prisma.licenseKey.findUnique({ where: { key: parsed.data.key }, select: { workspaceId: true } });
        if (current?.workspaceId && current.workspaceId !== user.workspaceId) {
          return reply.status(409).send({ error: "License key is already in use by another workspace" });
        }
        // If same workspace claimed it in the race, fall through to success
      }

      // Bind the license to this workspace (idempotent — safe to call even if already set)
      await prisma.workspace.update({
        where: { id: user.workspaceId },
        data: { licenseKey: parsed.data.key, plan: license.plan },
      });

      return reply.send({
        message: "License activated successfully",
        plan: license.plan,
        expiryDate: license.expiryDate,
      });
    }
  );

  app.get(
    "/status",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;

      const workspace = await prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: { licenseKey: true, plan: true },
      });

      if (!workspace?.licenseKey) {
        return reply.send({ status: "no_license", plan: workspace?.plan ?? "lite" });
      }

      const license = await prisma.licenseKey.findUnique({
        where: { key: workspace.licenseKey },
        select: { status: true, expiryDate: true, plan: true },
      });

      return reply.send(license ?? { status: "not_found" });
    }
  );
}
