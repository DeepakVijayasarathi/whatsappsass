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
    reply.status(401).send({ error: "Unauthorized" });
  }
}

export async function requireOwnerOrAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authenticate(request, reply);
  const user = request.user as JwtPayload;
  if (!["owner", "admin"].includes(user.role)) {
    reply.status(403).send({ error: "Forbidden: insufficient role" });
  }
}
