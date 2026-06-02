import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PrismaMock } from "../test/prismaMock";

const prismaMock = vi.hoisted((): PrismaMock => {
  const MODELS = [
    "workspace", "user", "passwordResetToken", "licenseKey", "contact", "contactNote",
    "contactSegment", "campaign", "emailCampaign", "messageLog", "emailLog", "auditLog",
    "inboundMessage", "cannedResponse", "autoReply", "webhookEndpoint", "webhookDeliveryLog",
    "campaignSequence", "sequenceStep", "sequenceEnrollment", "customTemplate",
  ];
  const METHODS = [
    "findUnique", "findFirst", "findMany", "create", "createMany", "update", "updateMany",
    "upsert", "delete", "deleteMany", "count", "groupBy", "aggregate",
  ];
  const m = {} as PrismaMock;
  for (const model of MODELS) { m[model] = {}; for (const method of METHODS) m[model][method] = vi.fn(); }
  m.$transaction = vi.fn(async (a: unknown) => (typeof a === "function" ? (a as (t: PrismaMock) => unknown)(m) : Array.isArray(a) ? Promise.all(a) : a));
  return m;
});
vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));

import { campaignRoutes } from "./campaigns";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const WS = "ws-1";
let app: FastifyInstance;
let token: string;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.workspace.findUnique.mockResolvedValue({ status: "active" });
  app = await buildTestApp(campaignRoutes, "/campaigns");
  token = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
});

describe("GET /campaigns", () => {
  it("401 without a token", async () => {
    expect((await app.inject({ method: "GET", url: "/campaigns" })).statusCode).toBe(401);
  });

  it("returns paginated, workspace-scoped campaigns", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([{ id: "c1", name: "Promo" }]);
    prismaMock.campaign.count.mockResolvedValue(1);
    const res = await app.inject({ method: "GET", url: "/campaigns?page=1&limit=10", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS }) })
    );
  });
});

describe("DELETE /campaigns/:id", () => {
  it("404 for a campaign in another workspace", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "DELETE", url: "/campaigns/x", headers: authHeader(token) });
    expect(res.statusCode).toBe(404);
  });

  it("409 when the campaign is running", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "c1", status: "running" });
    const res = await app.inject({ method: "DELETE", url: "/campaigns/c1", headers: authHeader(token) });
    expect(res.statusCode).toBe(409);
    expect(prismaMock.campaign.delete).not.toHaveBeenCalled();
  });

  it("200 deletes a non-running campaign", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "c1", status: "draft" });
    prismaMock.campaign.delete.mockResolvedValue({});
    const res = await app.inject({ method: "DELETE", url: "/campaigns/c1", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /campaigns/:id/stats — funnel math", () => {
  it("404 for a campaign in another workspace", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/campaigns/x/stats", headers: authHeader(token) });
    expect(res.statusCode).toBe(404);
  });

  it("computes delivery/read/failure/reply rates correctly", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "c1" });
    // sent=10, delivered=20, read=20, failed=10  → totalSent=50, attempted=60, delivered-or-beyond=40
    prismaMock.messageLog.groupBy.mockResolvedValue([
      { status: "sent", _count: { status: 10 } },
      { status: "delivered", _count: { status: 20 } },
      { status: "read", _count: { status: 20 } },
      { status: "failed", _count: { status: 10 } },
    ]);
    prismaMock.inboundMessage.count.mockResolvedValue(5); // replies

    const res = await app.inject({ method: "GET", url: "/campaigns/c1/stats", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    const { funnel } = res.json();
    expect(funnel.attempted).toBe(60);
    expect(funnel.sent).toBe(50);
    expect(funnel.delivered).toBe(40);
    expect(funnel.read).toBe(20);
    expect(funnel.replies).toBe(5);
    expect(funnel.rates.deliveryRate).toBe(80);   // 40/50
    expect(funnel.rates.readRate).toBe(40);       // 20/50
    expect(funnel.rates.failureRate).toBe(16.7);  // 10/60 → 16.666 → 16.7
    expect(funnel.rates.replyRate).toBe(10);      // 5/50
  });

  it("returns zeroed rates with no messages (no divide-by-zero)", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.messageLog.groupBy.mockResolvedValue([]);
    prismaMock.inboundMessage.count.mockResolvedValue(0);
    const res = await app.inject({ method: "GET", url: "/campaigns/c1/stats", headers: authHeader(token) });
    const { funnel } = res.json();
    expect(funnel.rates.deliveryRate).toBe(0);
    expect(funnel.rates.failureRate).toBe(0);
  });
});

describe("GET /campaigns/:id/export — CSV", () => {
  it("404 for a campaign in another workspace", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/campaigns/x/export", headers: authHeader(token) });
    expect(res.statusCode).toBe(404);
  });

  it("streams CSV with a header and neutralises formula injection", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "c1", name: "Promo Q1" });
    prismaMock.messageLog.findMany.mockResolvedValue([
      { status: "sent", wamid: "w1", createdAt: new Date("2026-01-01T00:00:00Z"), contact: { name: "=cmd()", phone: "+15551234567", email: "a@b.com" } },
    ]);
    const res = await app.inject({ method: "GET", url: "/campaigns/c1/export", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename=/);
    const body = res.body;
    expect(body.split("\n")[0]).toBe("contact_name,phone,email,status,wamid,sent_at");
    // formula-injection guard prefixes a leading "=" with a single quote
    expect(body).toContain("'=cmd()");
  });
});
