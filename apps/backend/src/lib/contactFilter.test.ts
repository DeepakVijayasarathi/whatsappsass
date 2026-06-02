import { describe, it, expect } from "vitest";
import { buildContactWhere, contactFilterSchema } from "./contactFilter";

const WS = "ws-123";

describe("buildContactWhere", () => {
  it("scopes to the workspace with no filters", () => {
    expect(buildContactWhere(WS, {})).toEqual({ workspaceId: WS });
  });

  it("filters by tag", () => {
    expect(buildContactWhere(WS, { tag: "vip" })).toMatchObject({
      workspaceId: WS,
      tags: { has: "vip" },
    });
  });

  it("filters by leadStatus", () => {
    expect(buildContactWhere(WS, { leadStatus: "customer" })).toMatchObject({ leadStatus: "customer" });
  });

  it("filters optIn=true", () => {
    expect(buildContactWhere(WS, { optIn: true })).toMatchObject({ optIn: true });
  });

  it("filters optIn=false", () => {
    expect(buildContactWhere(WS, { optIn: false })).toMatchObject({ optIn: false });
  });

  it("omits optIn when undefined", () => {
    expect(buildContactWhere(WS, {})).not.toHaveProperty("optIn");
  });

  it("builds an OR across name/phone/email for search", () => {
    const where = buildContactWhere(WS, { search: "john" }) as { OR?: unknown[] };
    expect(where.OR).toEqual([
      { name: { contains: "john", mode: "insensitive" } },
      { phone: { contains: "john" } },
      { email: { contains: "john", mode: "insensitive" } },
    ]);
  });

  it("combines multiple filters", () => {
    const where = buildContactWhere(WS, { tag: "vip", leadStatus: "customer", optIn: true });
    expect(where).toMatchObject({
      workspaceId: WS,
      tags: { has: "vip" },
      leadStatus: "customer",
      optIn: true,
    });
  });
});

describe("contactFilterSchema", () => {
  it("accepts a fully-populated filter", () => {
    const r = contactFilterSchema.safeParse({ tag: "a", leadStatus: "new", optIn: true, search: "x" });
    expect(r.success).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(contactFilterSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a non-boolean optIn", () => {
    expect(contactFilterSchema.safeParse({ optIn: "yes" }).success).toBe(false);
  });

  it("rejects a non-string tag", () => {
    expect(contactFilterSchema.safeParse({ tag: 123 }).success).toBe(false);
  });
});
