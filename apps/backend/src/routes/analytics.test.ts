import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { analyticsRoutes } from "./analytics";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let token: string;

beforeEach(async () => {
  app = await buildTestApp(analyticsRoutes, "/analytics");
  token = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
});

describe("GET /analytics/overview", () => {
  it("401 without a token", async () => {
    expect((await app.inject({ method: "GET", url: "/analytics/overview" })).statusCode).toBe(401);
  });

  it("aggregates totals and trends, scoped to the workspace", async () => {
    prisma.contact.count.mockResolvedValue(10);
    prisma.campaign.count.mockResolvedValue(3);
    prisma.messageLog.count.mockResolvedValue(100);
    prisma.messageLog.groupBy.mockResolvedValue([
      { status: "sent", _count: { status: 60 } },
      { status: "delivered", _count: { status: 40 } },
    ]);
    const res = await app.inject({ method: "GET", url: "/analytics/overview", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalContacts).toBe(10);
    expect(body.totalMessages).toBe(100);
    // every query is workspace-scoped
    expect(prisma.contact.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS }) })
    );
  });
});

describe("GET /analytics/export", () => {
  it("returns a date-bucketed CSV scoped to the workspace", async () => {
    prisma.messageLog.findMany.mockResolvedValue([
      { status: "sent", createdAt: new Date("2026-01-01T00:00:00Z") },
      { status: "delivered", createdAt: new Date("2026-01-01T01:00:00Z") },
    ]);
    const res = await app.inject({ method: "GET", url: "/analytics/export", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.body.split("\n")[0]).toBe("date,sent,delivered,read,failed");
    expect(prisma.messageLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS }) })
    );
  });
});

describe("GET /analytics/funnel/:campaignId", () => {
  it("404 for a campaign in another workspace", async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/analytics/funnel/c1", headers: authHeader(token) });
    expect(res.statusCode).toBe(404);
  });

  it("computes funnel rates relative to total sent", async () => {
    prisma.campaign.findFirst.mockResolvedValue({ id: "c1", name: "C", template: "t", status: "completed", createdAt: new Date() });
    // sentTotal=100, delivered=80, read=40, failed=10, replies=20
    prisma.messageLog.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(10);
    prisma.inboundMessage.count.mockResolvedValue(20);
    const res = await app.inject({ method: "GET", url: "/analytics/funnel/c1", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    const { funnel } = res.json();
    expect(funnel.delivered).toMatchObject({ count: 80, rate: 80 });
    expect(funnel.read).toMatchObject({ count: 40, rate: 40 });
    expect(funnel.replied).toMatchObject({ count: 20, rate: 20 });
  });
});

describe("GET /analytics/contacts", () => {
  it("returns totals + tag breakdown scoped to the workspace", async () => {
    prisma.contact.count.mockResolvedValueOnce(20).mockResolvedValueOnce(15);
    prisma.contact.findMany.mockResolvedValue([{ tags: ["vip", "lead"] }, { tags: ["vip"] }]);
    const res = await app.inject({ method: "GET", url: "/analytics/contacts", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 20, optedIn: 15, tagCounts: { vip: 2, lead: 1 } });
  });
});

describe("GET /analytics/messages + /contact-growth + /heatmap", () => {
  it("messages returns a per-day grouped series", async () => {
    prisma.messageLog.findMany.mockResolvedValue([
      { status: "sent", createdAt: new Date("2026-01-01T10:00:00Z") },
      { status: "read", createdAt: new Date("2026-01-01T11:00:00Z") },
    ]);
    const res = await app.inject({ method: "GET", url: "/analytics/messages?days=7", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("data");
  });

  it("contact-growth returns a series", async () => {
    prisma.contact.findMany.mockResolvedValue([{ createdAt: new Date() }]);
    const res = await app.inject({ method: "GET", url: "/analytics/contact-growth?days=7", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
  });

  it("heatmap returns buckets", async () => {
    prisma.messageLog.findMany.mockResolvedValue([{ createdAt: new Date("2026-01-01T10:00:00Z") }]);
    const res = await app.inject({ method: "GET", url: "/analytics/heatmap", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
  });
});
