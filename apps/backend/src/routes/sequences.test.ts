import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { sequenceRoutes } from "./sequences";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
const C1 = "11111111-1111-1111-1111-111111111111";
const C2 = "22222222-2222-2222-2222-222222222222";
let app: FastifyInstance;
let owner: string;
let marketer: string;

beforeEach(async () => {
  app = await buildTestApp(sequenceRoutes, "/sequences");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketer = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
});

describe("POST /sequences (create) — step validation", () => {
  it("403 for a marketer", async () => {
    const res = await app.inject({ method: "POST", url: "/sequences", headers: authHeader(marketer), payload: { name: "S", steps: [{ stepNumber: 1, templateName: "t" }] } });
    expect(res.statusCode).toBe(403);
  });

  it("400 on non-sequential step numbers", async () => {
    const res = await app.inject({ method: "POST", url: "/sequences", headers: authHeader(owner), payload: { name: "S", steps: [{ stepNumber: 1, templateName: "a" }, { stepNumber: 3, templateName: "b" }] } });
    expect(res.statusCode).toBe(400);
  });

  it("400 on duplicate step numbers", async () => {
    const res = await app.inject({ method: "POST", url: "/sequences", headers: authHeader(owner), payload: { name: "S", steps: [{ stepNumber: 1, templateName: "a" }, { stepNumber: 1, templateName: "b" }] } });
    expect(res.statusCode).toBe(400);
  });

  it("201 on valid sequential steps", async () => {
    prisma.campaignSequence.create.mockResolvedValue({ id: "s1", name: "S", steps: [] });
    const res = await app.inject({ method: "POST", url: "/sequences", headers: authHeader(owner), payload: { name: "S", steps: [{ stepNumber: 1, templateName: "a" }, { stepNumber: 2, templateName: "b" }] } });
    expect(res.statusCode).toBe(201);
    expect(prisma.campaignSequence.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS }) })
    );
  });
});

describe("DELETE /sequences/:id", () => {
  it("409 when active with enrollments", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1", status: "active", _count: { enrollments: 3 } });
    const res = await app.inject({ method: "DELETE", url: "/sequences/s1", headers: authHeader(owner) });
    expect(res.statusCode).toBe(409);
  });

  it("deletes a draft sequence", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1", status: "draft", _count: { enrollments: 0 } });
    prisma.sequenceEnrollment.updateMany.mockResolvedValue({ count: 0 });
    prisma.campaignSequence.delete.mockResolvedValue({});
    const res = await app.inject({ method: "DELETE", url: "/sequences/s1", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
  });
});

describe("POST /sequences/:id/enroll — compliance rules", () => {
  it("409 when the sequence is not active", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1", status: "draft" });
    const res = await app.inject({ method: "POST", url: "/sequences/s1/enroll", headers: authHeader(owner), payload: { contactIds: [C1] } });
    expect(res.statusCode).toBe(409);
  });

  it("400 when a contact id is not in the workspace", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1", status: "active" });
    prisma.contact.findMany.mockResolvedValue([]); // none found
    const res = await app.inject({ method: "POST", url: "/sequences/s1/enroll", headers: authHeader(owner), payload: { contactIds: [C1] } });
    expect(res.statusCode).toBe(400);
  });

  it("400 when a contact has not opted in", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1", status: "active" });
    prisma.contact.findMany.mockResolvedValue([{ id: C1, optIn: false }]);
    const res = await app.inject({ method: "POST", url: "/sequences/s1/enroll", headers: authHeader(owner), payload: { contactIds: [C1] } });
    expect(res.statusCode).toBe(400);
    expect(res.json().notOptedIn).toContain(C1);
  });

  it("enrolls opted-in, never-before-enrolled contacts", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1", status: "active" });
    prisma.contact.findMany.mockResolvedValue([{ id: C1, optIn: true }, { id: C2, optIn: true }]);
    prisma.sequenceEnrollment.findMany.mockResolvedValue([]); // none enrolled yet
    prisma.sequenceEnrollment.createMany.mockResolvedValue({ count: 2 });
    const res = await app.inject({ method: "POST", url: "/sequences/s1/enroll", headers: authHeader(owner), payload: { contactIds: [C1, C2] } });
    expect(res.statusCode).toBe(200);
    expect(res.json().enrolled).toBe(2);
    expect(prisma.sequenceEnrollment.createMany).toHaveBeenCalled();
  });

  it("skips already-active enrollments", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1", status: "active" });
    prisma.contact.findMany.mockResolvedValue([{ id: C1, optIn: true }]);
    prisma.sequenceEnrollment.findMany.mockResolvedValue([{ contactId: C1, status: "active" }]);
    const res = await app.inject({ method: "POST", url: "/sequences/s1/enroll", headers: authHeader(owner), payload: { contactIds: [C1] } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ enrolled: 0, skipped: 1 });
  });
});

describe("GET /sequences/:id/stats", () => {
  it("404 for another workspace's sequence", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/sequences/x/stats", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
  });

  it("aggregates enrollment statuses", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1" });
    prisma.sequenceEnrollment.findMany.mockResolvedValue([
      { status: "active", currentStep: 1 }, { status: "active", currentStep: 2 }, { status: "completed", currentStep: 3 },
    ]);
    const res = await app.inject({ method: "GET", url: "/sequences/s1/stats", headers: authHeader(owner) });
    expect(res.json()).toMatchObject({ stats: { active: 2, completed: 1 }, total: 3 });
  });
});

describe("PATCH /sequences/:id/enrollments/:contactId/stop", () => {
  it("404 for another workspace's sequence", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "PATCH", url: `/sequences/s1/enrollments/${C1}/stop`, headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
  });
  it("stops an active enrollment", async () => {
    prisma.campaignSequence.findFirst.mockResolvedValue({ id: "s1" });
    prisma.sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });
    const res = await app.inject({ method: "PATCH", url: `/sequences/s1/enrollments/${C1}/stop`, headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(prisma.sequenceEnrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "stopped" }) })
    );
  });
});

describe("GET /sequences/enrollments/active-count", () => {
  it("counts active enrollments via the parent sequence's workspace", async () => {
    prisma.sequenceEnrollment.count.mockResolvedValue(7);
    const res = await app.inject({ method: "GET", url: "/sequences/enrollments/active-count", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(7);
    expect(prisma.sequenceEnrollment.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "active", sequence: { workspaceId: WS } }) })
    );
  });
});
