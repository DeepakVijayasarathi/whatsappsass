import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";

export const TEST_JWT_SECRET = "test-jwt-secret-for-vitest";

export interface TokenClaims {
  userId: string;
  workspaceId: string;
  role: string;
  superAdmin?: boolean;
}

type RoutePlugin = (app: FastifyInstance) => Promise<void> | void;

/**
 * Build a Fastify app with the same JWT + error-handler wiring as the real
 * server, register one route plugin under a prefix, and return it ready for
 * `app.inject()`. No network, no DB.
 */
export async function buildTestApp(plugin: RoutePlugin, prefix: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: TEST_JWT_SECRET });

  // Mirror server.ts: 4xx pass through with their message, 5xx are masked.
  app.setErrorHandler((error, _req, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) return reply.status(500).send({ error: "Internal server error" });
    return reply.status(status).send({ error: error.message });
  });

  await app.register(plugin as never, { prefix });
  await app.ready();
  return app;
}

/** Sign a JWT the way the routes expect (request.jwtVerify reads these claims). */
export function signToken(app: FastifyInstance, claims: TokenClaims): string {
  return app.jwt.sign(claims, { expiresIn: "1h" });
}

export function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
