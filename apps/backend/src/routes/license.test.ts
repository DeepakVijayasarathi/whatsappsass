import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { licenseRoutes } from "./license";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;
let marketer: string;

// The authenticate/requireOwnerOrAdmin middleware reads workspace.status; the
// routes read other workspace fields. Route by the `select` keys so both work.
function routeWorkspaceBySelect(map: { status?: unknown; other?: unknown }) {
  prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
    if (args?.select?.status && !args.select.licenseKey) return map.status ?? { status: "active" };
    return map.other ?? null;
  });
}

beforeEach(async () => {
  app = await buildTestApp(licenseRoutes, "/license");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketer = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
  routeWorkspaceBySelect({ status: { status: "active" } });
});

describe("POST /license/activate", () => {
  it("403 for a marketer", async () => {
    const res = await app.inject({ method: "POST", url: "/license/activate", headers: authHeader(marketer), payload: { key: "LITE-AAAA-BBBB-CCCC" } });
    expect(res.statusCode).toBe(403);
  });

  it("400 on a malformed key", async () => {
    const res = await app.inject({ method: "POST", url: "/license/activate", headers: authHeader(owner), payload: { key: "bad-key" } });
    expect(res.statusCode).toBe(400);
  });

  it("404 when the key does not exist", async () => {
    prisma.licenseKey.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: "POST", url: "/license/activate", headers: authHeader(owner), payload: { key: "LITE-AAAA-BBBB-CCCC" } });
    expect(res.statusCode).toBe(404);
  });

  it("410 when the key is expired", async () => {
    prisma.licenseKey.findUnique.mockResolvedValue({ key: "LITE-AAAA-BBBB-CCCC", status: "expired", workspaceId: null });
    const res = await app.inject({ method: "POST", url: "/license/activate", headers: authHeader(owner), payload: { key: "LITE-AAAA-BBBB-CCCC" } });
    expect(res.statusCode).toBe(410);
  });

  it("409 when the key belongs to another workspace", async () => {
    prisma.licenseKey.findUnique.mockResolvedValue({ key: "LITE-AAAA-BBBB-CCCC", status: "active", workspaceId: "other-ws" });
    const res = await app.inject({ method: "POST", url: "/license/activate", headers: authHeader(owner), payload: { key: "LITE-AAAA-BBBB-CCCC" } });
    expect(res.statusCode).toBe(409);
  });

  it("activates and binds an unassigned key", async () => {
    prisma.licenseKey.findUnique.mockResolvedValue({ key: "LITE-AAAA-BBBB-CCCC", status: "active", workspaceId: null, plan: "lite", expiryDate: null });
    prisma.licenseKey.updateMany.mockResolvedValue({ count: 1 });
    prisma.workspace.update.mockResolvedValue({});
    const res = await app.inject({ method: "POST", url: "/license/activate", headers: authHeader(owner), payload: { key: "LITE-AAAA-BBBB-CCCC" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().plan).toBe("lite");
    // claimed atomically against workspaceId: null
    expect(prisma.licenseKey.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: null }) })
    );
  });
});

describe("GET /license/status", () => {
  it("no_license when the workspace has no key", async () => {
    routeWorkspaceBySelect({ status: { status: "active" }, other: { licenseKey: null, plan: "lite" } });
    const res = await app.inject({ method: "GET", url: "/license/status", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("no_license");
  });

  it("returns license details when present", async () => {
    routeWorkspaceBySelect({ status: { status: "active" }, other: { licenseKey: "LITE-AAAA-BBBB-CCCC", plan: "lite" } });
    prisma.licenseKey.findUnique.mockResolvedValue({ status: "active", expiryDate: null, plan: "lite" });
    const res = await app.inject({ method: "GET", url: "/license/status", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("active");
  });
});
