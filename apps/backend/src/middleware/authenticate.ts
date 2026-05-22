import type { FastifyRequest, FastifyReply } from "fastify";

export interface JwtPayload {
  userId: string;
  workspaceId: string;
  role: string;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

export async function requireOwnerOrAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  const user = request.user as JwtPayload;
  if (!["owner", "admin"].includes(user.role)) {
    return reply.status(403).send({ error: "Forbidden: insufficient role" });
  }
}
