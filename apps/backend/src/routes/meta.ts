import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireOwnerOrAdmin } from "../middleware/authenticate";
import { authenticate } from "../middleware/authenticate";
import type { JwtPayload } from "../middleware/authenticate";

export async function metaRoutes(app: FastifyInstance) {
  app.post(
    "/toggle",
    { preHandler: [requireOwnerOrAdmin] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const schema = z.object({ enabled: z.boolean() });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const workspace = await prisma.workspace.update({
        where: { id: user.workspaceId },
        data: { metaWhatsappEnabled: parsed.data.enabled },
        select: { id: true, metaWhatsappEnabled: true },
      });

      return reply.send({
        message: `WhatsApp integration ${parsed.data.enabled ? "enabled" : "disabled"}`,
        metaWhatsappEnabled: workspace.metaWhatsappEnabled,
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
        select: { metaWhatsappEnabled: true },
      });

      return reply.send({ metaWhatsappEnabled: workspace?.metaWhatsappEnabled ?? false });
    }
  );
}
