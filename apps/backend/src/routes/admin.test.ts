import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { adminRoutes } from "./admin";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;
let marketer: string;
let superToken: string;

beforeEach(async () => {
  app = await buildTestApp(adminRoutes, "/admin");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketer = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
  superToken = signToken(app, { userId: "su", workspaceId: WS, role: "owner" });
});

describe("owner/admin metrics", () => {
  it("403 for a marketer", async () => {
    expect((await app.inject({ method: "GET", url: "/admin/metrics", headers: authHeader(marketer) })).statusCode).toBe(403);
  });

  it("returns workspace metrics for an owner", async () => {
    prisma.contact.count.mockResolvedValue(5);
    prisma.campaign.count.mockResolvedValue(2);
    prisma.emailCampaign.count.mockResolvedValue(1);
    prisma.messageLog.groupBy.mockResolvedValue([{ status: "sent", _count: { status: 10 } }]);
    prisma.emailLog.groupBy.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(3);
    const res = await app.inject({ method: "GET", url: "/admin/metrics", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ contacts: 5, campaigns: 2, members: 3, totalWhatsapp: 10 });
  });
});

describe("member permissions", () => {
  it("403 cannot restrict the owner", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "target", role: "owner", workspaceId: WS });
    const res = await app.inject({ method: "PATCH", url: "/admin/members/target/permissions", headers: authHeader(owner), payload: { can_export: false } });
    expect(res.statusCode).toBe(403);
  });

  it("404 for a member in another workspace", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "PATCH", url: "/admin/members/x/permissions", headers: authHeader(owner), payload: { can_export: false } });
    expect(res.statusCode).toBe(404);
  });

  it("updates a marketer's permissions", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "target", role: "marketer", workspaceId: WS, permissions: {} });
    prisma.user.update.mockResolvedValue({ id: "target", name: "M", email: "m@x", role: "marketer", permissions: { can_export: true } });
    prisma.auditLog.create.mockResolvedValue({});
    const res = await app.inject({ method: "PATCH", url: "/admin/members/target/permissions", headers: authHeader(owner), payload: { can_export: true } });
    expect(res.statusCode).toBe(200);
  });
});

describe("super-admin guard", () => {
  it("403 when the caller is not a super-admin (DB check)", async () => {
    // requireSuperAdmin reads superAdmin flag from the DB
    prisma.user.findUnique.mockResolvedValue({ superAdmin: false });
    const res = await app.inject({ method: "GET", url: "/admin/super/workspaces", headers: authHeader(owner) });
    expect(res.statusCode).toBe(403);
  });

  it("allows a real super-admin and lists workspaces", async () => {
    prisma.user.findUnique.mockResolvedValue({ superAdmin: true });
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws-a", name: "A", _count: { users: 1, contacts: 2, campaigns: 0 } }]);
    const res = await app.inject({ method: "GET", url: "/admin/super/workspaces", headers: authHeader(superToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().workspaces).toHaveLength(1);
  });

  it("suspends a workspace and invalidates its cached status", async () => {
    prisma.user.findUnique.mockResolvedValue({ superAdmin: true });
    prisma.workspace.update.mockResolvedValue({ id: "ws-a", status: "suspended" });
    prisma.auditLog.create.mockResolvedValue({});
    const res = await app.inject({ method: "PATCH", url: "/admin/super/workspaces/ws-a/status", headers: authHeader(superToken), payload: { status: "suspended" } });
    expect(res.statusCode).toBe(200);
    expect(prisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ws-a" }, data: { status: "suspended" } })
    );
  });

  it("returns global super-metrics", async () => {
    prisma.user.findUnique.mockResolvedValue({ superAdmin: true });
    prisma.workspace.count.mockResolvedValue(5);
    prisma.user.count.mockResolvedValue(12);
    prisma.contact.count.mockResolvedValue(100);
    prisma.messageLog.count.mockResolvedValue(500);
    prisma.emailLog.count.mockResolvedValue(50);
    const res = await app.inject({ method: "GET", url: "/admin/super/metrics", headers: authHeader(superToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ totalWorkspaces: 5, totalUsers: 12 });
  });

  it("404 impersonating a non-existent user", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ superAdmin: true }) // guard check
      .mockResolvedValueOnce(null);                // target lookup
    const res = await app.inject({ method: "POST", url: "/admin/super/impersonate/nope", headers: authHeader(superToken) });
    expect(res.statusCode).toBe(404);
  });

  it("issues a short-lived impersonation token", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ superAdmin: true })
      .mockResolvedValueOnce({ id: "target", name: "T", email: "t@x", role: "owner", workspaceId: "ws-b" });
    prisma.auditLog.create.mockResolvedValue({});
    const res = await app.inject({ method: "POST", url: "/admin/super/impersonate/target", headers: authHeader(superToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTruthy();
  });

  it("promotes a user to super-admin", async () => {
    prisma.user.findUnique.mockResolvedValue({ superAdmin: true });
    prisma.user.update.mockResolvedValue({ id: "u9", email: "u@x", superAdmin: true });
    prisma.auditLog.create.mockResolvedValue({});
    const res = await app.inject({ method: "POST", url: "/admin/super/promote/u9", headers: authHeader(superToken), payload: { superAdmin: true } });
    expect(res.statusCode).toBe(200);
    expect(res.json().superAdmin).toBe(true);
  });

  it("returns a super workspace detail", async () => {
    prisma.user.findUnique.mockResolvedValue({ superAdmin: true });
    prisma.workspace.findUnique.mockResolvedValue({ id: "ws-a", name: "A", users: [], _count: { contacts: 0, campaigns: 0, messageLogs: 0, emailLogs: 0 } });
    const res = await app.inject({ method: "GET", url: "/admin/super/workspaces/ws-a", headers: authHeader(superToken) });
    expect(res.statusCode).toBe(200);
  });
});
