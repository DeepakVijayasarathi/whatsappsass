import { describe, it, expect, vi } from "vitest";
import { sendInBatches } from "./batchSend";

describe("sendInBatches", () => {
  it("processes every item and preserves order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await sendInBatches(items, async (n) => n * 2, { delayMs: 0 });
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([2, 4, 6, 8, 10]);
  });

  it("returns an empty array for no items", async () => {
    const results = await sendInBatches([], async (n) => n, { delayMs: 0 });
    expect(results).toEqual([]);
  });

  it("never exceeds the concurrency cap of in-flight workers", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await sendInBatches(
      items,
      async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
      },
      { concurrency: 4, delayMs: 0 }
    );
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("captures rejections without aborting the rest (allSettled semantics)", async () => {
    const items = [1, 2, 3];
    const results = await sendInBatches(
      items,
      async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      },
      { delayMs: 0 }
    );
    expect(results[0]).toMatchObject({ status: "fulfilled", value: 1 });
    expect(results[1].status).toBe("rejected");
    expect(results[2]).toMatchObject({ status: "fulfilled", value: 3 });
  });

  it("passes the correct index to the worker", async () => {
    const seen: number[] = [];
    await sendInBatches(["a", "b", "c"], async (_item, i) => { seen.push(i); }, { concurrency: 1, delayMs: 0 });
    expect(seen).toEqual([0, 1, 2]);
  });

  it("treats concurrency < 1 as 1", async () => {
    const results = await sendInBatches([1, 2], async (n) => n, { concurrency: 0, delayMs: 0 });
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([1, 2]);
  });

  it("delays between batches but not after the final batch", async () => {
    vi.useFakeTimers();
    const items = [1, 2, 3, 4]; // 2 batches at concurrency 2
    const spy = vi.spyOn(global, "setTimeout");
    const promise = sendInBatches(items, async (n) => n, { concurrency: 2, delayMs: 100 });
    await vi.runAllTimersAsync();
    await promise;
    // Exactly one inter-batch delay (between batch 1 and 2), none after the last.
    const delayCalls = spy.mock.calls.filter((c) => c[1] === 100);
    expect(delayCalls.length).toBe(1);
    vi.useRealTimers();
  });
});
