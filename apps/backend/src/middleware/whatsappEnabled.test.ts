import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { requireWhatsappEnabled } from "./whatsappEnabled";
import { authenticate } from "./authenticate";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let token: string;

// Mount a tiny route guarded by authenticate + requireWhatsappEnabled.
async function plugin(a: FastifyInstance) {
  a.post("/x", { preHandler: [authenticate, requireWhatsappEnabled] }, async () => ({ ok: true }));
}

beforeEach(async () => {
  app = await buildTestApp(plugin, "/wa");
  token = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
});

describe("requireWhatsappEnabled", () => {
  it("403 when the workspace is not found / suspended", async () => {
    // authenticate sees active (default), but the middleware's own lookup returns suspended.
    prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args?.select?.metaWhatsappEnabled ? { status: "suspended", metaWhatsappEnabled: true } : { status: "active" }
    );
    const res = await app.inject({ method: "POST", url: "/wa/x", headers: authHeader(token) });
    expect(res.statusCode).toBe(403);
  });

  it("403 when sending is disabled (metaWhatsappEnabled = false)", async () => {
    prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args?.select?.metaWhatsappEnabled ? { status: "active", metaWhatsappEnabled: false } : { status: "active" }
    );
    const res = await app.inject({ method: "POST", url: "/wa/x", headers: authHeader(token) });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/disabled/i);
  });

  it("passes when active and sending is enabled", async () => {
    prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args?.select?.metaWhatsappEnabled ? { status: "active", metaWhatsappEnabled: true } : { status: "active" }
    );
    const res = await app.inject({ method: "POST", url: "/wa/x", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});
