import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { autoReplyRoutes } from "./auto-replies";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let owner: string;
let marketer: string;

beforeEach(async () => {
  app = await buildTestApp(autoReplyRoutes, "/auto-replies");
  owner = signToken(app, { userId: "u1", workspaceId: WS, role: "owner" });
  marketer = signToken(app, { userId: "u2", workspaceId: WS, role: "marketer" });
});

describe("auto-replies", () => {
  it("401 without a token", async () => {
    expect((await app.inject({ method: "GET", url: "/auto-replies" })).statusCode).toBe(401);
  });

  it("lists rules scoped to the workspace", async () => {
    prisma.autoReply.findMany.mockResolvedValue([{ id: "r1", keyword: "hi" }]);
    const res = await app.inject({ method: "GET", url: "/auto-replies", headers: authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(prisma.autoReply.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: WS } })
    );
  });

  it("403 when a marketer tries to create (requireOwnerOrAdmin)", async () => {
    const res = await app.inject({ method: "POST", url: "/auto-replies", headers: authHeader(marketer), payload: { keyword: "hi", templateName: "t" } });
    expect(res.statusCode).toBe(403);
  });

  it("400 on invalid body", async () => {
    const res = await app.inject({ method: "POST", url: "/auto-replies", headers: authHeader(owner), payload: { matchType: "exact" } });
    expect(res.statusCode).toBe(400);
  });

  it("201 creates a rule for the workspace", async () => {
    prisma.autoReply.create.mockResolvedValue({ id: "r1" });
    const res = await app.inject({ method: "POST", url: "/auto-replies", headers: authHeader(owner), payload: { keyword: "hi", templateName: "welcome" } });
    expect(res.statusCode).toBe(201);
    expect(prisma.autoReply.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS, keyword: "hi" }) })
    );
  });

  it("404 updating a rule in another workspace", async () => {
    prisma.autoReply.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "PATCH", url: "/auto-replies/x", headers: authHeader(owner), payload: { isActive: false } });
    expect(res.statusCode).toBe(404);
  });

  it("404 deleting a rule in another workspace", async () => {
    prisma.autoReply.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "DELETE", url: "/auto-replies/x", headers: authHeader(owner) });
    expect(res.statusCode).toBe(404);
    expect(prisma.autoReply.delete).not.toHaveBeenCalled();
  });
});
