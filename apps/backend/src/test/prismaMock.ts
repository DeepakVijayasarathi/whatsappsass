import type { vi } from "vitest";

/**
 * Shared type for the deep Prisma mock used in route tests.
 *
 * Two construction styles exist in the suite:
 *  - Most files import getPrisma() from ./setup (the global mock).
 *  - A few early files build the mock inline inside their own vi.hoisted() block
 *    (needed when a test must reference the mock before the route module loads).
 * Both produce this shape.
 */
export type MockFn = ReturnType<typeof vi.fn>;
export type PrismaMock = Record<string, Record<string, MockFn>> & { $transaction: MockFn };
