import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";

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
import { startScheduler } from "./lib/scheduler";

const app = Fastify({ logger: true });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}

const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "http://localhost:3000";

async function bootstrap() {
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || origin === ALLOWED_ORIGIN) return cb(null, true);
      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });
  await app.register(jwt, { secret: JWT_SECRET! });

  // ── Global rate limit: 100 req/min per IP ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(rateLimit as any, {
    max: 100,
    timeWindow: "1 minute",
    // Exclude Meta webhook endpoints from rate limiting — Meta can burst many events
    skip: (req: { url?: string }) => req.url?.startsWith("/whatsapp/webhook") ?? false,
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

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

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

  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Backend running on http://localhost:${port}`);

  startScheduler();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
