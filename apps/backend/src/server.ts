import "dotenv/config";
import crypto from "crypto";
import path from "path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";

import { authRoutes } from "./routes/auth";
import { workspaceRoutes } from "./routes/workspace";
import { licenseRoutes } from "./routes/license";
import { metaRoutes } from "./routes/meta";
import { contactRoutes } from "./routes/contacts";
import { campaignRoutes } from "./routes/campaigns";
import { whatsappRoutes } from "./routes/whatsapp";
import { analyticsRoutes } from "./routes/analytics";
import { templateRoutes } from "./routes/templates";
import { emailRoutes } from "./routes/email";
import { adminRoutes } from "./routes/admin";
import { autoReplyRoutes } from "./routes/auto-replies";
import { webhookRoutes } from "./routes/webhooks";
import { sequenceRoutes } from "./routes/sequences";
import { cannedResponseRoutes } from "./routes/canned-responses";
import { uploadRoutes, getUploadDir } from "./routes/uploads";
import { startScheduler } from "./lib/scheduler";

const app = Fastify({
  logger: true,
  // 5 MB max body — prevents memory exhaustion from large payloads.
  // Webhooks (Meta / MSG91) send small JSON so this doesn't affect them.
  bodyLimit: 5 * 1024 * 1024,
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}

async function bootstrap() {
  // Multipart/form-data support (required for file uploads)
  await app.register(multipart);

  // Serve uploaded files at GET /uploads/*
  await app.register(staticFiles, {
    root: getUploadDir(),
    prefix: "/uploads/",
    decorateReply: false,
  });

  await app.register(helmet, { global: true });
  // When FRONTEND_URL is set, restrict CORS to that exact origin.
  // The comparison is exact (not prefix) to prevent subdomain-bypass attacks.
  // null/undefined origin (e.g. server-side tool calls) are blocked in production.
  const frontendOrigin = process.env.FRONTEND_URL?.replace(/\/$/, "") ?? null;
  const corsOrigin = frontendOrigin
    ? (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
        const normalised = origin?.replace(/\/$/, "");
        cb(null, normalised === frontendOrigin);
      }
    : true; // dev: allow all
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });
  await app.register(jwt, { secret: JWT_SECRET! });

  // ── Global rate limit: 100 req/min per IP ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(rateLimit as any, {
    max: 100,
    timeWindow: "1 minute",
    // Exclude exact Meta webhook paths from rate limiting — Meta can burst many events.
    // Only the two exact paths are skipped; a typo/variant won't accidentally bypass the limit.
    skip: (req: { url?: string }) => {
      const path = req.url?.split("?")[0];
      return path === "/whatsapp/webhook" || path === "/whatsapp/msg91-webhook";
    },
    // Expose standard headers so clients can self-throttle
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });

  // ── Global error handler — never leak stack traces in production ──────────
  app.setErrorHandler((error, _request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      app.log.error({ err: error }, "Unhandled server error");
      return reply.status(500).send({
        error: process.env.NODE_ENV === "production"
          ? "Internal server error"
          : error.message,
      });
    }
    // 4xx errors pass through as-is (validation errors, rate-limit 429, etc.)
    return reply.status(status).send({ error: error.message });
  });

  // Add request ID to every request for tracing
  app.addHook("onRequest", async (request) => {
    request.headers["x-request-id"] = request.headers["x-request-id"] ?? crypto.randomUUID();
  });

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString(), version: "d8e506b" }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(workspaceRoutes, { prefix: "/workspace" });
  await app.register(licenseRoutes, { prefix: "/license" });
  await app.register(metaRoutes, { prefix: "/meta" });
  await app.register(contactRoutes, { prefix: "/contacts" });
  await app.register(campaignRoutes, { prefix: "/campaigns" });
  await app.register(whatsappRoutes, { prefix: "/whatsapp" });
  await app.register(analyticsRoutes, { prefix: "/analytics" });
  await app.register(templateRoutes, { prefix: "/templates" });
  await app.register(emailRoutes, { prefix: "/email" });
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(autoReplyRoutes, { prefix: "/auto-replies" });
  await app.register(webhookRoutes, { prefix: "/webhooks" });
  await app.register(sequenceRoutes, { prefix: "/sequences" });
  await app.register(cannedResponseRoutes, { prefix: "/canned-responses" });
  await app.register(uploadRoutes, { prefix: "/uploads" });

  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Backend running on http://localhost:${port}`);

  startScheduler();

  // Graceful shutdown — finish in-flight requests before exiting
  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received — shutting down gracefully`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
