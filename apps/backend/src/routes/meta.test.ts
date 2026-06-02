import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { metaRoutes } from "./meta";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;
let marketer: string;

beforeEach(async () => {
  app = await buildTestApp(metaRoutes, "/meta");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketer = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
});

describe("POST /meta/toggle", () => {
  it("403 for a marketer", async () => {
    const res = await app.inject({ method: "POST", url: "/meta/toggle", headers: authHeader(marketer), payload: { enabled: true } });
    expect(res.statusCode).toBe(403);
  });

  it("400 on a non-boolean payload", async () => {
    const res = await app.inject({ method: "POST", url: "/meta/toggle", headers: authHeader(owner), payload: { enabled: "yes" } });
    expect(res.statusCode).toBe(400);
  });

  it("toggles WhatsApp on for the caller's workspace", async () => {
    prisma.workspace.update.mockResolvedValue({ id: WS, metaWhatsappEnabled: true });
    const res = await app.inject({ method: "POST", url: "/meta/toggle", headers: authHeader(owner), payload: { enabled: true } });
    expect(res.statusCode).toBe(200);
    expect(res.json().metaWhatsappEnabled).toBe(true);
    expect(prisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WS }, data: { metaWhatsappEnabled: true } })
    );
  });
});

describe("GET /meta/status", () => {
  it("401 without a token", async () => {
    expect((await app.inject({ method: "GET", url: "/meta/status" })).statusCode).toBe(401);
  });

  it("reports the enabled flag (default false when unset)", async () => {
    // middleware status check + route both hit workspace.findUnique; route reads the flag.
    prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args?.select?.metaWhatsappEnabled ? { metaWhatsappEnabled: true } : { status: "active" }
    );
    const res = await app.inject({ method: "GET", url: "/meta/status", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json().metaWhatsappEnabled).toBe(true);
  });
});
