import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../test/setup";
import { cannedResponseRoutes } from "./canned-responses";
import { buildTestApp, signToken, authHeader } from "../test/harness";

const prisma = getPrisma();
const WS = "ws-1";
let app: FastifyInstance;
let token: string;

beforeEach(async () => {
  app = await buildTestApp(cannedResponseRoutes, "/canned-responses");
  token = signToken(app, { userId: "u1", workspaceId: WS, role: "marketer" });
});

describe("canned-responses", () => {
  it("401 without a token", async () => {
    expect((await app.inject({ method: "GET", url: "/canned-responses" })).statusCode).toBe(401);
  });

  it("lists scoped to the workspace, supports search", async () => {
    prisma.cannedResponse.findMany.mockResolvedValue([{ id: "r1", title: "Hi" }]);
    const res = await app.inject({ method: "GET", url: "/canned-responses?search=hi", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    expect(prisma.cannedResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS }) })
    );
  });

  it("400 on invalid create body", async () => {
    const res = await app.inject({ method: "POST", url: "/canned-responses", headers: authHeader(token), payload: { title: "" } });
    expect(res.statusCode).toBe(400);
  });

  it("201 creates for the workspace", async () => {
    prisma.cannedResponse.create.mockResolvedValue({ id: "r1" });
    const res = await app.inject({ method: "POST", url: "/canned-responses", headers: authHeader(token), payload: { title: "Greeting", body: "Hello there" } });
    expect(res.statusCode).toBe(201);
    expect(prisma.cannedResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: WS }) })
    );
  });

  it("404 updating another workspace's response", async () => {
    prisma.cannedResponse.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "PATCH", url: "/canned-responses/x", headers: authHeader(token), payload: { title: "New" } });
    expect(res.statusCode).toBe(404);
  });

  it("404 deleting another workspace's response", async () => {
    prisma.cannedResponse.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: "DELETE", url: "/canned-responses/x", headers: authHeader(token) });
    expect(res.statusCode).toBe(404);
    expect(prisma.cannedResponse.delete).not.toHaveBeenCalled();
  });
});
