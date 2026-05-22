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

const app = Fastify({ logger: true });

const JWT_SECRET = process.env.JWT_SECRET || "whatsapp-saas-secret-key-2025";

async function bootstrap() {
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(workspaceRoutes, { prefix: "/workspace" });
  await app.register(licenseRoutes, { prefix: "/license" });
  await app.register(metaRoutes, { prefix: "/meta" });
  await app.register(contactRoutes, { prefix: "/contacts" });
  await app.register(campaignRoutes, { prefix: "/campaigns" });
  await app.register(whatsappRoutes, { prefix: "/whatsapp" });
  await app.register(analyticsRoutes, { prefix: "/analytics" });

  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
