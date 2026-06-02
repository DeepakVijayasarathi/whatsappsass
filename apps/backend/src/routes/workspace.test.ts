import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { workspaceRoutes } from "./workspace";
import { buildTestApp, signToken, authHeader } from "../test/harness";
import { decryptNullable } from "../lib/encrypt";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;
let admin: string;
let marketer: string;

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = "test-key";
  app = await buildTestApp(workspaceRoutes, "/workspace");
  owner = signToken(app, { userId: "owner-id", workspaceId: WS, role: "owner" });
  admin = signToken(app, { userId: "admin-id", workspaceId: WS, role: "admin" });
  marketer = signToken(app, { userId: "mk-id", workspaceId: WS, role: "marketer" });
});

describe("POST /workspace/invite", () => {
  it("403 for a marketer", async () => {
    const res = await app.inject({ method: "POST", url: "/workspace/invite", headers: authHeader(marketer), payload: { name: "N", email: "n@x.com", password: "password123", role: "marketer" } });
    expect(res.statusCode).toBe(403);
  });

  it("409 when the email is already in use", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u9" });
    const res = await app.inject({ method: "POST", url: "/workspace/invite", headers: authHeader(owner), payload: { name: "N", email: "n@x.com", password: "password123", role: "marketer" } });
    expect(res.statusCode).toBe(409);
  });

  it("201 invites a member into the actor's workspace", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u9", name: "N", email: "n@x.com", role: "marketer", createdAt: new Date() });
    const res = await app.inject({ method: "POST", url: "/workspace/invite", headers: authHeader(owner), payload: { name: "N", email: "n@x.com", password: "password123", role: "marketer" } });
    expect(res.statusCode).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS, role: "marketer" }) })
    );
  });
});

describe("DELETE /workspace/members/:id — authorization rules", () => {
  it("400 when removing yourself", async () => {
    const res = await app.inject({ method: "DELETE", url: "/workspace/members/owner-id", headers: authHeader(owner) });
    expect(res.statusCode).toBe(400);
  });

  it("403 when removing the owner", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "t", role: "owner", workspaceId: WS });
    const res = await app.inject({ method: "DELETE", url: "/workspace/members/t", headers: authHeader(admin) });
    expect(res.statusCode).toBe(403);
  });

  it("403 when an admin tries to remove another admin", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "t", role: "admin", workspaceId: WS });
    const res = await app.inject({ method: "DELETE", url: "/workspace/members/t", headers: authHeader(admin) });
    expect(res.statusCode).toBe(403);
  });

  it("owner removes a marketer", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "t", role: "marketer", workspaceId: WS });
    prisma.user.delete.mockResolvedValue({});
    const res = await app.inject({ method: "DELETE", url: "/workspace/members/t", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
  });

  it("404 for a member in another workspace", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "DELETE", url: "/workspace/members/x", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /workspace/provider — encrypts credentials at rest", () => {
  it("stores the MSG91 auth key encrypted, never plaintext", async () => {
    prisma.workspace.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args?.select?.status && !args.select.msg91AuthKey ? { status: "active" } : {}
    );
    prisma.workspace.update.mockResolvedValue({ whatsappProvider: "msg91" });
    const res = await app.inject({
      method: "PATCH", url: "/workspace/provider", headers: authHeader(owner),
      payload: { whatsappProvider: "msg91", msg91AuthKey: "PLAINTEXT-KEY-123", msg91IntegratedNumber: "15551234567" },
    });
    expect(res.statusCode).toBe(200);
    const call = prisma.workspace.update.mock.calls[0][0] as { data: { msg91AuthKey: string } };
    const stored = call.data.msg91AuthKey;
    expect(stored).not.toBe("PLAINTEXT-KEY-123");      // not stored raw
    expect(stored.startsWith("v1:")).toBe(true);       // encrypted envelope
    expect(decryptNullable(stored)).toBe("PLAINTEXT-KEY-123"); // round-trips
  });
});

describe("PATCH /workspace/profile — password change", () => {
  it("401 when the current password is wrong", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("realpassword", 10);
    prisma.user.findUnique.mockResolvedValue({ id: "owner-id", name: "O", email: "o@x", role: "owner", passwordHash: hash });
    const res = await app.inject({ method: "PATCH", url: "/workspace/profile", headers: authHeader(owner), payload: { currentPassword: "wrong", newPassword: "newpassword1" } });
    expect(res.statusCode).toBe(401);
  });
});
