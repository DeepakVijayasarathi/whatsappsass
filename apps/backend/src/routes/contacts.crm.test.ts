import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { contactRoutes } from "./contacts";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;

beforeEach(async () => {
  app = await buildTestApp(contactRoutes, "/contacts");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
});

describe("POST /contacts/deduplicate", () => {
  it("merges duplicate phone groups, keeping the oldest", async () => {
    prisma.contact.findMany.mockResolvedValue([
      { id: "c1", phone: "+1 555 111", tags: ["a"], optIn: false },
      { id: "c2", phone: "+1555111", tags: ["b"], optIn: true },   // dup of c1 (digits match)
      { id: "c3", phone: "+1555999", tags: [], optIn: false },     // unique
    ]);
    prisma.sequenceEnrollment.findMany.mockResolvedValue([]);
    prisma.messageLog.updateMany.mockResolvedValue({ count: 0 });
    prisma.inboundMessage.updateMany.mockResolvedValue({ count: 0 });
    prisma.contactNote.updateMany.mockResolvedValue({ count: 0 });
    prisma.contact.update.mockResolvedValue({});
    prisma.contact.deleteMany.mockResolvedValue({ count: 1 });

    const res = await app.inject({ method: "POST", url: "/contacts/deduplicate", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ merged: 1, removed: 1 });
    // kept contact (oldest = c1) gets merged tags + OR'd optIn
    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ optIn: true }) })
    );
  });
});

describe("PATCH /contacts/:id/lead-status", () => {
  it("400 on an invalid status", async () => {
    const res = await app.inject({ method: "PATCH", url: "/contacts/c1/lead-status", headers: authHeader(owner), payload: { status: "bogus" } });
    expect(res.statusCode).toBe(400);
  });
  it("404 for a contact in another workspace", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "PATCH", url: "/contacts/c1/lead-status", headers: authHeader(owner), payload: { status: "customer" } });
    expect(res.statusCode).toBe(404);
  });
  it("updates a valid status", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1", workspaceId: WS });
    prisma.contact.update.mockResolvedValue({ id: "c1", leadStatus: "customer" });
    const res = await app.inject({ method: "PATCH", url: "/contacts/c1/lead-status", headers: authHeader(owner), payload: { status: "customer" } });
    expect(res.statusCode).toBe(200);
  });
});

describe("contact notes", () => {
  it("404 listing notes for a contact in another workspace", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/contacts/c1/notes", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
  });
  it("creates a note bound to the contact + workspace", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1", workspaceId: WS });
    prisma.user.findUnique.mockResolvedValue({ email: "u@x" });
    prisma.contactNote.create.mockResolvedValue({ id: "n1" });
    const res = await app.inject({ method: "POST", url: "/contacts/c1/notes", headers: authHeader(owner), payload: { body: "Called them" } });
    expect(res.statusCode).toBe(201);
    expect(prisma.contactNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS, contactId: "c1" }) })
    );
  });
});

describe("GET /contacts/:id/timeline", () => {
  it("merges sent + received into one sorted timeline", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1", notes: [] });
    prisma.messageLog.findMany.mockResolvedValue([
      { id: "m1", status: "sent", campaign: { id: "ca1", name: "C" }, createdAt: new Date("2026-01-02") },
    ]);
    prisma.inboundMessage.findMany.mockResolvedValue([
      { id: "i1", body: "hey", type: "text", replyToMessageId: null, receivedAt: new Date("2026-01-03") },
    ]);
    const res = await app.inject({ method: "GET", url: "/contacts/c1/timeline", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    const tl = res.json().timeline;
    expect(tl).toHaveLength(2);
    expect(tl[0].type).toBe("received"); // most recent first
  });
});

describe("GET /contacts/:id/engagement", () => {
  it("scores from recent message statuses", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1" });
    prisma.messageLog.findMany.mockResolvedValue([{ status: "read" }, { status: "delivered" }]);
    const res = await app.inject({ method: "GET", url: "/contacts/c1/engagement", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    // (100 + 70) / 2 = 85
    expect(res.json().score).toBe(85);
  });
  it("returns 0 when there is no history", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1" });
    prisma.messageLog.findMany.mockResolvedValue([]);
    const res = await app.inject({ method: "GET", url: "/contacts/c1/engagement", headers: authHeader(owner) });
    expect(res.json()).toMatchObject({ score: 0, total: 0 });
  });
});

describe("PATCH /contacts/bulk-tag", () => {
  it("adds tags to workspace-scoped contacts", async () => {
    const ids = ["11111111-1111-1111-1111-111111111111"];
    prisma.contact.findMany.mockResolvedValue([{ id: ids[0], tags: ["old"] }]);
    prisma.contact.update.mockResolvedValue({});
    const res = await app.inject({ method: "PATCH", url: "/contacts/bulk-tag", headers: authHeader(owner), payload: { ids, tags: ["new"] } });
    expect(res.statusCode).toBe(200);
  });
});
