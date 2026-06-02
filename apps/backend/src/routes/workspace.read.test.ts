import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { workspaceRoutes } from "./workspace";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;

// Distinguish the authenticate status-check findUnique from the route's findUnique.
function wsFind(routeValue: unknown) {
  prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
    const sel = args?.select ?? {};
    if (sel.status && Object.keys(sel).length === 1) return { status: "active" };
    return routeValue;
  });
}

beforeEach(async () => {
  app = await buildTestApp(workspaceRoutes, "/workspace");
  owner = signToken(app, { userId: "owner-id", workspaceId: WS, role: "owner" });
});

describe("GET /workspace/me", () => {
  it("returns the workspace, scoped", async () => {
    wsFind({ id: WS, name: "W", plan: "lite", metaWhatsappEnabled: true, whatsappProvider: "msg91", msg91IntegratedNumber: "1", status: "active", licenseKey: null, createdAt: new Date() });
    const res = await app.inject({ method: "GET", url: "/workspace/me", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(WS);
  });
});

describe("GET /workspace/members", () => {
  it("lists members of the workspace", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "u1", name: "O", email: "o@x", role: "owner", createdAt: new Date() }]);
    const res = await app.inject({ method: "GET", url: "/workspace/members", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: WS } })
    );
  });
});

describe("GET /workspace/smtp", () => {
  it("returns config with the password masked, never raw", async () => {
    wsFind({ smtpHost: "smtp.x", smtpPort: 587, smtpUser: "u", smtpPass: "v1:secret", smtpFromEmail: "f@x", smtpFromName: "X" });
    const res = await app.inject({ method: "GET", url: "/workspace/smtp", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).not.toHaveProperty("smtpPass");
    expect(body.hasSmtpPass).toBe(true);
  });
});

describe("GET /workspace/provider", () => {
  it("returns only boolean flags for secrets, never the values", async () => {
    wsFind({ whatsappProvider: "msg91", metaPhoneNumberId: null, metaWabaId: null, metaWebhookVerifyToken: null, msg91IntegratedNumber: "1", metaAccessToken: null, msg91AuthKey: "v1:abc" });
    const res = await app.inject({ method: "GET", url: "/workspace/provider", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).not.toHaveProperty("msg91AuthKey");
    expect(body.hasMsg91AuthKey).toBe(true);
  });
});

describe("GET /workspace/onboarding-status", () => {
  it("reports providerConfigured + counts", async () => {
    prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      const sel = args?.select ?? {};
      if (sel.status && Object.keys(sel).length === 1) return { status: "active" };
      return { whatsappProvider: "msg91", msg91AuthKey: "k", msg91IntegratedNumber: "1", metaWhatsappEnabled: true, smtpHost: "x", metaPhoneNumberId: null, metaAccessToken: null };
    });
    prisma.contact.count.mockResolvedValue(4);
    prisma.campaign.count.mockResolvedValue(0);
    const res = await app.inject({ method: "GET", url: "/workspace/onboarding-status", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json().steps).toMatchObject({ providerConfigured: true, hasContacts: true, hasTemplates: false });
  });
});

describe("GET /workspace/profile", () => {
  it("404 when the user record is missing", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/workspace/profile", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
  });
  it("returns the caller's profile", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "owner-id", name: "O", email: "o@x", role: "owner", createdAt: new Date() });
    const res = await app.inject({ method: "GET", url: "/workspace/profile", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
  });
});
