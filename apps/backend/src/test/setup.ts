import { vi, beforeEach } from "vitest";

/**
 * Global test setup (referenced from vitest.config.ts `setupFiles`).
 *
 * Mocks the shared prisma singleton and the outbound side-effect libs once for
 * every test file, so individual tests don't repeat the hoisted-mock boilerplate.
 * The live mock object is exposed via getPrisma().
 */

const MODELS = [
  "workspace", "user", "passwordResetToken", "licenseKey",
  "contact", "contactNote", "contactSegment",
  "campaign", "emailCampaign", "messageLog", "emailLog",
  "auditLog", "inboundMessage", "cannedResponse", "autoReply",
  "webhookEndpoint", "webhookDeliveryLog",
  "campaignSequence", "sequenceStep", "sequenceEnrollment", "customTemplate",
];
const METHODS = [
  "findUnique", "findFirst", "findMany", "create", "createMany",
  "update", "updateMany", "upsert", "delete", "deleteMany",
  "count", "groupBy", "aggregate",
];

export type MockFn = ReturnType<typeof vi.fn>;
export type PrismaMock = Record<string, Record<string, MockFn>> & { $transaction: MockFn };

function build(): PrismaMock {
  const m = {} as PrismaMock;
  for (const model of MODELS) {
    m[model] = {};
    for (const method of METHODS) m[model][method] = vi.fn();
  }
  m.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: PrismaMock) => unknown)(m);
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg;
  });
  return m;
}

const prismaMock = build();

export function getPrisma(): PrismaMock {
  return prismaMock;
}

vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../lib/email", () => ({ sendEmail: vi.fn(async () => undefined), verifySmtp: vi.fn(async () => undefined) }));
// Mock only the outbound dispatch; keep the real isPrivateWebhookUrl SSRF guard
// and the VALID_EVENTS/type exports so webhook route validation is genuinely tested.
vi.mock("../lib/webhookDispatcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/webhookDispatcher")>();
  return { ...actual, fireWebhooks: vi.fn(async () => undefined) };
});

// Reset all mock state between tests and re-establish the default: an active
// workspace (so the authenticate middleware's status check passes unless a test
// overrides it).
beforeEach(() => {
  for (const model of MODELS) {
    for (const method of METHODS) prismaMock[model][method].mockReset();
  }
  prismaMock.$transaction.mockReset();
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: PrismaMock) => unknown)(prismaMock);
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg;
  });
  prismaMock.workspace.findUnique.mockResolvedValue({ status: "active" });
});
