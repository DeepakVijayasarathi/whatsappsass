import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PrismaMock } from "../test/prismaMock";

// Build the mock inside vi.hoisted (runs before the route module's top-level
// prisma import). The callback is fully self-contained: it builds the mock with
// the vi instance Vitest injects, then we hand it to vi.mock.
const prismaMock = vi.hoisted((): PrismaMock => {
  const MODELS = [
    "workspace", "user", "passwordResetToken", "licenseKey",
    "contact", "contactNote", "contactSegment",
    "campaign", "emailCampaign", "messageLog", "emailLog",
    "auditLog", "inboundMessage", "cannedResponse", "autoReply",
    "webhookEndpoint", "webhookDeliveryLog",
    "campaignSequence", "sequenceStep", "sequenceEnrollment", "customTemplate",
  ];
  const METHODS = [
    "findUnique", "findFirst", "findMany", "create", "createMany",
    "update", "updateMany", "upsert", "delete", "deleteMany",
    "count", "groupBy", "aggregate",
  ];
  const m = {} as PrismaMock;
  for (const model of MODELS) {
    m[model] = {};
    for (const method of METHODS) m[model][method] = vi.fn();
  }
  m.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: PrismaMock) => unknown)(m);
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg;
  });
  return m;
});
vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));

import { contactRoutes } from "./contacts";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const WS = "ws-1";
const OTHER_WS = "ws-2";

let app: FastifyInstance;
let ownerToken: string;
let marketerToken: string;

beforeEach(async () => {
  vi.clearAllMocks();
  // authenticate middleware checks workspace status — return active by default.
  prismaMock.workspace.findUnique.mockResolvedValue({ status: "active" });
  app = await buildTestApp(contactRoutes, "/contacts");
  ownerToken = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketerToken = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
});

describe("GET /contacts/segments", () => {
  it("401 without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/contacts/segments" });
    expect(res.statusCode).toBe(401);
  });

  it("returns segments with live counts, scoped to the workspace", async () => {
    prismaMock.contactSegment.findMany.mockResolvedValue([
      { id: "s1", name: "VIP", filter: { tag: "vip" }, workspaceId: WS, createdAt: new Date() },
    ]);
    prismaMock.contact.count.mockResolvedValue(7);

    const res = await app.inject({ method: "GET", url: "/contacts/segments", headers: authHeader(ownerToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.segments).toHaveLength(1);
    expect(body.segments[0].count).toBe(7);
    // workspace scoping enforced in the query
    expect(prismaMock.contactSegment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: WS } })
    );
  });
});

describe("POST /contacts/segments", () => {
  it("403 for a marketer (lacks can_manage_contacts)", async () => {
    // checkPermission re-reads the user from the DB for non-owners.
    prismaMock.user.findUnique.mockResolvedValue({ role: "marketer", permissions: {} });
    const res = await app.inject({
      method: "POST", url: "/contacts/segments",
      headers: authHeader(marketerToken),
      payload: { name: "X", filter: { tag: "a" } },
    });
    expect(res.statusCode).toBe(403);
  });

  it("400 on invalid body (missing name)", async () => {
    const res = await app.inject({
      method: "POST", url: "/contacts/segments",
      headers: authHeader(ownerToken),
      payload: { filter: { tag: "a" } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("409 when a segment name already exists", async () => {
    prismaMock.contactSegment.findUnique.mockResolvedValue({ id: "existing" });
    const res = await app.inject({
      method: "POST", url: "/contacts/segments",
      headers: authHeader(ownerToken),
      payload: { name: "Dup", filter: {} },
    });
    expect(res.statusCode).toBe(409);
  });

  it("201 creates a segment scoped to the workspace", async () => {
    prismaMock.contactSegment.findUnique.mockResolvedValue(null);
    prismaMock.contactSegment.create.mockResolvedValue({ id: "new", name: "New", filter: {}, workspaceId: WS });
    const res = await app.inject({
      method: "POST", url: "/contacts/segments",
      headers: authHeader(ownerToken),
      payload: { name: "New", filter: { leadStatus: "customer" } },
    });
    expect(res.statusCode).toBe(201);
    expect(prismaMock.contactSegment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS, name: "New" }) })
    );
  });
});

describe("DELETE /contacts/segments/:id", () => {
  it("404 when the segment belongs to another workspace (isolation)", async () => {
    prismaMock.contactSegment.findFirst.mockResolvedValue(null); // not found within WS
    const res = await app.inject({
      method: "DELETE", url: "/contacts/segments/s-other",
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(404);
    expect(prismaMock.contactSegment.delete).not.toHaveBeenCalled();
  });

  it("deletes a segment owned by the workspace", async () => {
    prismaMock.contactSegment.findFirst.mockResolvedValue({ id: "s1", workspaceId: WS });
    prismaMock.contactSegment.delete.mockResolvedValue({});
    const res = await app.inject({
      method: "DELETE", url: "/contacts/segments/s1",
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /contacts/segments/:id/resolve", () => {
  it("forces opt-in regardless of the saved filter", async () => {
    prismaMock.contactSegment.findFirst.mockResolvedValue({
      id: "s1", name: "All", workspaceId: WS, filter: { optIn: false },
    });
    prismaMock.contact.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);

    const res = await app.inject({
      method: "GET", url: "/contacts/segments/s1/resolve",
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().contactIds).toEqual(["c1", "c2"]);
    // resolution must force optIn:true even though the segment said false
    expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ optIn: true }) })
    );
  });

  it("422 when the stored filter is malformed", async () => {
    prismaMock.contactSegment.findFirst.mockResolvedValue({
      id: "s1", name: "Bad", workspaceId: WS, filter: { optIn: "not-a-boolean" },
    });
    const res = await app.inject({
      method: "GET", url: "/contacts/segments/s1/resolve",
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(422);
  });

  it("404 for a segment in another workspace", async () => {
    prismaMock.contactSegment.findFirst.mockResolvedValue(null);
    const res = await app.inject({
      method: "GET", url: "/contacts/segments/x/resolve",
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(404);
  });
});

// Guard sanity: a suspended workspace is rejected by authenticate.
// The middleware caches workspace status (30s TTL), so use a fresh workspaceId
// that hasn't been seen by earlier tests to guarantee a cache miss.
describe("workspace suspension", () => {
  it("403 when the workspace is suspended", async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ status: "suspended" });
    const suspendedToken = signToken(app, { userId: "u9", workspaceId: "ws-suspended-unique", role: "owner" });
    const res = await app.inject({ method: "GET", url: "/contacts/segments", headers: authHeader(suspendedToken) });
    expect(res.statusCode).toBe(403);
  });

  it("401 when the workspace no longer exists", async () => {
    prismaMock.workspace.findUnique.mockResolvedValue(null);
    const orphanToken = signToken(app, { userId: "u10", workspaceId: "ws-deleted-unique", role: "owner" });
    const res = await app.inject({ method: "GET", url: "/contacts/segments", headers: authHeader(orphanToken) });
    expect(res.statusCode).toBe(401);
  });
});

void OTHER_WS;
