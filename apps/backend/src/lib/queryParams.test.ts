import { describe, it, expect } from "vitest";
import { parsePagination } from "./queryParams";

describe("parsePagination", () => {
  it("defaults to page 1, limit 20, skip 0 when empty", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("computes skip from page and limit", () => {
    expect(parsePagination({ page: "3", limit: "25" })).toEqual({ page: 3, limit: 25, skip: 50 });
  });

  it("clamps page to a minimum of 1", () => {
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-5" }).page).toBe(1);
  });

  it("clamps page to maxPage (default 500)", () => {
    expect(parsePagination({ page: "9999" }).page).toBe(500);
  });

  it("clamps limit to maxLimit (default 100)", () => {
    expect(parsePagination({ limit: "5000" }).limit).toBe(100);
  });

  it("honors a custom maxLimit", () => {
    expect(parsePagination({ limit: "5000" }, { maxLimit: 1000 }).limit).toBe(1000);
  });

  it("falls back to defaults on NaN input", () => {
    expect(parsePagination({ page: "abc", limit: "xyz" })).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("respects a custom defaultLimit", () => {
    expect(parsePagination({}, { defaultLimit: 50 }).limit).toBe(50);
  });
});
