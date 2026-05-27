import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import type { JwtPayload } from "./authenticate";

export async function requireWhatsappEnabled(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { metaWhatsappEnabled: true, status: true },
  });

  if (!workspace || workspace.status !== "active") {
    return reply.status(403).send({ error: "Workspace is suspended or not found" });
  }

  // metaWhatsappEnabled is the global "send messages" toggle — applies to both Meta and MSG91
  if (!workspace.metaWhatsappEnabled) {
    return reply.status(403).send({
      error: "WhatsApp sending is disabled for this workspace. Enable it in Settings → WhatsApp Provider.",
    });
  }
}
