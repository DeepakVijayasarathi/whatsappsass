import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { emailRoutes } from "./email";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;
let marketer: string;

beforeEach(async () => {
  app = await buildTestApp(emailRoutes, "/email");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketer = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
  prisma.auditLog.create.mockResolvedValue({});
});

describe("GET /email/campaigns", () => {
  it("401 without a token", async () => {
    expect((await app.inject({ method: "GET", url: "/email/campaigns" })).statusCode).toBe(401);
  });
  it("lists workspace-scoped campaigns", async () => {
    prisma.emailCampaign.findMany.mockResolvedValue([{ id: "e1", name: "Newsletter" }]);
    prisma.emailCampaign.count.mockResolvedValue(1);
    const res = await app.inject({ method: "GET", url: "/email/campaigns", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(prisma.emailCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: WS } })
    );
  });
});

describe("POST /email/campaigns", () => {
  it("403 for a marketer lacking can_send_email", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: "marketer", permissions: { can_send_email: false } });
    const res = await app.inject({ method: "POST", url: "/email/campaigns", headers: authHeader(marketer), payload: { name: "N", subject: "S", body: "B" } });
    expect(res.statusCode).toBe(403);
  });

  it("400 on invalid body", async () => {
    const res = await app.inject({ method: "POST", url: "/email/campaigns", headers: authHeader(owner), payload: { name: "N" } });
    expect(res.statusCode).toBe(400);
  });

  it("201 creates a campaign for the workspace", async () => {
    prisma.emailCampaign.create.mockResolvedValue({ id: "e1", name: "N" });
    const res = await app.inject({ method: "POST", url: "/email/campaigns", headers: authHeader(owner), payload: { name: "N", subject: "S", body: "B" } });
    expect(res.statusCode).toBe(201);
    expect(prisma.emailCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS }) })
    );
  });
});

describe("email campaign isolation", () => {
  it("404 updating another workspace's campaign", async () => {
    prisma.emailCampaign.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "PATCH", url: "/email/campaigns/x", headers: authHeader(owner), payload: { name: "New" } });
    expect(res.statusCode).toBe(404);
  });

  it("404 deleting another workspace's campaign", async () => {
    prisma.emailCampaign.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "DELETE", url: "/email/campaigns/x", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
    expect(prisma.emailCampaign.delete).not.toHaveBeenCalled();
  });
});

describe("GET /email/campaigns/:id/stats", () => {
  it("aggregates email log statuses scoped to the workspace", async () => {
    prisma.emailLog.findMany.mockResolvedValue([{ status: "sent" }, { status: "sent" }, { status: "failed" }]);
    const res = await app.inject({ method: "GET", url: "/email/campaigns/e1/stats", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ stats: { sent: 2, failed: 1 }, total: 3 });
    expect(prisma.emailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS, campaignId: "e1" }) })
    );
  });
});

describe("POST /email/smtp/test", () => {
  it("400 when SMTP is not configured", async () => {
    prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args?.select?.smtpHost ? { smtpHost: null } : { status: "active" }
    );
    const res = await app.inject({ method: "POST", url: "/email/smtp/test", headers: authHeader(owner) });
    expect(res.statusCode).toBe(400);
  });
});
