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

import { contactRoutes } from "./contacts";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const WS = "ws-1";
let app: FastifyInstance;
let owner: string;
let marketer: string;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.workspace.findUnique.mockResolvedValue({ status: "active" });
  app = await buildTestApp(contactRoutes, "/contacts");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketer = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
});

describe("GET /contacts list", () => {
  it("applies tag + search filters scoped to the workspace", async () => {
    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.contact.count.mockResolvedValue(0);
    const res = await app.inject({ method: "GET", url: "/contacts?tag=vip&search=jo&optIn=true", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WS, tags: { has: "vip" }, optIn: true }),
      })
    );
  });
});

describe("POST /contacts create", () => {
  it("403 for a marketer without can_manage_contacts", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "marketer", permissions: {} });
    const res = await app.inject({ method: "POST", url: "/contacts", headers: authHeader(marketer), payload: { name: "X", phone: "+15551234567" } });
    expect(res.statusCode).toBe(403);
  });

  it("400 on invalid body (missing phone)", async () => {
    const res = await app.inject({ method: "POST", url: "/contacts", headers: authHeader(owner), payload: { name: "X" } });
    expect(res.statusCode).toBe(400);
  });

  it("201 creates a contact in the caller's workspace", async () => {
    prismaMock.contact.create.mockResolvedValue({ id: "c1", name: "X", phone: "+15551234567" });
    const res = await app.inject({ method: "POST", url: "/contacts", headers: authHeader(owner), payload: { name: "X", phone: "+15551234567" } });
    expect(res.statusCode).toBe(201);
    expect(prismaMock.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS }) })
    );
  });
});

describe("GET /contacts/:id isolation", () => {
  it("404 for a contact in another workspace", async () => {
    prismaMock.contact.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/contacts/other-ws-contact", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS }) })
    );
  });
});

describe("GET /contacts/export (can_export)", () => {
  it("403 for a marketer (no can_export)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "marketer", permissions: {} });
    const res = await app.inject({ method: "GET", url: "/contacts/export", headers: authHeader(marketer) });
    expect(res.statusCode).toBe(403);
  });

  it("owner gets a CSV with a header row", async () => {
    prismaMock.contact.findMany.mockResolvedValue([
      { id: "c1", name: "Jane", phone: "+1", email: "j@x.com", tags: ["vip"], optIn: true, leadStatus: "customer" },
    ]);
    const res = await app.inject({ method: "GET", url: "/contacts/export", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.body.split("\n")[0]).toContain("name");
  });
});

describe("DELETE /contacts/bulk", () => {
  it("deletes only ids within the workspace", async () => {
    const ids = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"];
    prismaMock.contact.deleteMany.mockResolvedValue({ count: 2 });
    const res = await app.inject({ method: "DELETE", url: "/contacts/bulk", headers: authHeader(owner), payload: { ids } });
    expect(res.statusCode).toBe(200);
    expect(prismaMock.contact.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS, id: { in: ids } }) })
    );
  });

  it("400 on a non-uuid id", async () => {
    const res = await app.inject({ method: "DELETE", url: "/contacts/bulk", headers: authHeader(owner), payload: { ids: ["not-a-uuid"] } });
    expect(res.statusCode).toBe(400);
  });
});
