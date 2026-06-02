import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { webhookRoutes } from "./webhooks";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;
let marketer: string;

beforeEach(async () => {
  app = await buildTestApp(webhookRoutes, "/webhooks");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketer = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
});

describe("GET /webhooks/events", () => {
  it("403 for a marketer", async () => {
    expect((await app.inject({ method: "GET", url: "/webhooks/events", headers: authHeader(marketer) })).statusCode).toBe(403);
  });
  it("lists the valid event types", async () => {
    const res = await app.inject({ method: "GET", url: "/webhooks/events", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json().events).toContain("message.inbound");
  });
});

describe("POST /webhooks — validation", () => {
  it("rejects a non-HTTPS URL", async () => {
    const res = await app.inject({ method: "POST", url: "/webhooks", headers: authHeader(owner), payload: { url: "http://example.com/hook", events: ["message.inbound"] } });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a private/internal URL (SSRF guard)", async () => {
    const res = await app.inject({ method: "POST", url: "/webhooks", headers: authHeader(owner), payload: { url: "https://127.0.0.1/hook", events: ["message.inbound"] } });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an unknown event", async () => {
    const res = await app.inject({ method: "POST", url: "/webhooks", headers: authHeader(owner), payload: { url: "https://example.com/hook", events: ["not.a.real.event"] } });
    expect(res.statusCode).toBe(400);
  });

  it("creates a webhook and never returns the raw secret", async () => {
    prisma.webhookEndpoint.create.mockResolvedValue({ id: "w1", url: "https://example.com/hook", events: ["message.inbound"], isActive: true, secret: "supersecret", workspaceId: WS });
    const res = await app.inject({ method: "POST", url: "/webhooks", headers: authHeader(owner), payload: { url: "https://example.com/hook", events: ["message.inbound"], secret: "supersecret" } });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).not.toHaveProperty("secret");
    expect(body.hasSecret).toBe(true);
    expect(prisma.webhookEndpoint.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS }) })
    );
  });
});

describe("PATCH/DELETE /webhooks/:id — isolation", () => {
  it("404 updating another workspace's endpoint", async () => {
    prisma.webhookEndpoint.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "PATCH", url: "/webhooks/x", headers: authHeader(owner), payload: { isActive: false } });
    expect(res.statusCode).toBe(404);
  });

  it("404 deleting another workspace's endpoint", async () => {
    prisma.webhookEndpoint.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "DELETE", url: "/webhooks/x", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
    expect(prisma.webhookEndpoint.delete).not.toHaveBeenCalled();
  });

  it("deletes an owned endpoint", async () => {
    prisma.webhookEndpoint.findFirst.mockResolvedValue({ id: "w1", workspaceId: WS });
    prisma.webhookEndpoint.delete.mockResolvedValue({});
    const res = await app.inject({ method: "DELETE", url: "/webhooks/w1", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /webhooks/:id/logs", () => {
  it("404 for another workspace's endpoint", async () => {
    prisma.webhookEndpoint.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/webhooks/x/logs", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
  });
  it("returns paginated delivery logs", async () => {
    prisma.webhookEndpoint.findFirst.mockResolvedValue({ id: "w1", workspaceId: WS });
    prisma.webhookDeliveryLog.findMany.mockResolvedValue([{ id: "l1", status: 200 }]);
    prisma.webhookDeliveryLog.count.mockResolvedValue(1);
    const res = await app.inject({ method: "GET", url: "/webhooks/w1/logs", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
  });
});

describe("POST /webhooks/:id/test", () => {
  it("404 for another workspace's endpoint", async () => {
    prisma.webhookEndpoint.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "POST", url: "/webhooks/x/test", headers: authHeader(owner), payload: {} });
    expect(res.statusCode).toBe(404);
  });
  it("fires a test event for an owned endpoint", async () => {
    prisma.webhookEndpoint.findFirst.mockResolvedValue({ id: "w1", workspaceId: WS });
    const res = await app.inject({ method: "POST", url: "/webhooks/w1/test", headers: authHeader(owner), payload: { event: "message.delivered" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().event).toBe("message.delivered");
  });
});
