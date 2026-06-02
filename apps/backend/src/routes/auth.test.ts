import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
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
  m.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: PrismaMock) => unknown)(m);
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg;
  });
  return m;
});
vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));
// Stub the email sender so forgot-password never tries real SMTP.
vi.mock("../lib/email", () => ({ sendEmail: vi.fn(async () => undefined) }));

import { authRoutes } from "./auth";
import { buildTestApp } from "../test/harness";

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  app = await buildTestApp(authRoutes, "/auth");
});

describe("POST /auth/register", () => {
  it("400 on invalid body (short password, bad email)", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: { name: "A", email: "x", password: "short", workspaceName: "W" } });
    expect(res.statusCode).toBe(400);
  });

  it("409 when email is already registered", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" });
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: { name: "A", email: "a@b.com", password: "password123", workspaceName: "W" } });
    expect(res.statusCode).toBe(409);
  });

  it("201 creates workspace+user and returns a token", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue([
      { id: "ws1", name: "W" },
      { id: "u1", name: "A", email: "a@b.com", role: "owner" },
    ]);
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: { name: "A", email: "a@b.com", password: "password123", workspaceName: "W" } });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe("owner");
  });
});

describe("POST /auth/login", () => {
  it("401 on unknown email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "no@b.com", password: "x" } });
    expect(res.statusCode).toBe(401);
  });

  it("401 on wrong password", async () => {
    const hash = await bcrypt.hash("correct-horse", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com", passwordHash: hash, workspaceId: "ws1", role: "owner", name: "A" });
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "a@b.com", password: "wrong" } });
    expect(res.statusCode).toBe(401);
  });

  it("403 when the workspace is suspended", async () => {
    const hash = await bcrypt.hash("correct-horse", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com", passwordHash: hash, workspaceId: "ws1", role: "owner", name: "A" });
    prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws1", status: "suspended", name: "W", plan: "lite" });
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "a@b.com", password: "correct-horse" } });
    expect(res.statusCode).toBe(403);
  });

  it("200 with a token on valid credentials", async () => {
    const hash = await bcrypt.hash("correct-horse", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com", passwordHash: hash, workspaceId: "ws1", role: "owner", name: "A" });
    prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws1", status: "active", name: "W", plan: "lite" });
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "a@b.com", password: "correct-horse" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTruthy();
  });
});

describe("POST /auth/forgot-password (user enumeration safety)", () => {
  it("returns a generic 200 even for an unknown email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: "ghost@b.com" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatch(/if that email exists/i);
    // No token row is created for a non-existent user.
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("does NOT leak the reset token in the response when SMTP is configured", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com", name: "A", workspaceId: "ws1" });
    prismaMock.workspace.findUnique.mockResolvedValue({ smtpHost: "smtp.x", smtpUser: "u", smtpPass: "p", smtpFromEmail: "f@x", smtpPort: 587, smtpFromName: "X" });
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.passwordResetToken.create.mockResolvedValue({ id: "t1" });
    const res = await app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: "a@b.com" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty("resetUrl");
  });
});

describe("POST /auth/reset-password", () => {
  it("400 on an invalid/expired token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: "POST", url: "/auth/reset-password", payload: { token: "deadbeef", password: "newpassword1" } });
    expect(res.statusCode).toBe(400);
  });

  it("400 when the token is already used", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({ id: "t1", userId: "u1", used: true, expiresAt: new Date(Date.now() + 100000) });
    const res = await app.inject({ method: "POST", url: "/auth/reset-password", payload: { token: "x", password: "newpassword1" } });
    expect(res.statusCode).toBe(400);
  });

  it("200 updates the password for a valid token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({ id: "t1", userId: "u1", used: false, expiresAt: new Date(Date.now() + 100000) });
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    const res = await app.inject({ method: "POST", url: "/auth/reset-password", payload: { token: "x", password: "newpassword1" } });
    expect(res.statusCode).toBe(200);
  });
});
