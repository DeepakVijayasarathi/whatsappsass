/**
 * Bounded-concurrency batch runner for bulk WhatsApp sends.
 *
 * Both the interactive /send-bulk route and the background campaign scheduler
 * previously had no concurrency control: /send-bulk fired every send at once
 * (Promise.allSettled over up to 1000 contacts), risking provider 429s and
 * blocking the HTTP request past the proxy timeout; the scheduler sent strictly
 * one-at-a-time (safe but slow). This helper gives both a single, tunable
 * middle ground — N in flight at a time, with an optional pause between batches
 * to stay under provider rate limits.
 */

export interface BatchOptions {
  /** Max sends in flight at once. */
  concurrency?: number;
  /** Milliseconds to wait between batches (lets provider rate windows recover). */
  delayMs?: number;
}

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_DELAY_MS = 250;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run `worker` over every item with at most `concurrency` running concurrently.
 * Never rejects — each item's outcome is captured as fulfilled/rejected, mirroring
 * Promise.allSettled, so one failure can't abort the rest of the campaign.
 */
export async function sendInBatches<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: BatchOptions = {}
): Promise<PromiseSettledResult<R>[]> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;

  const results: PromiseSettledResult<R>[] = new Array(items.length);

  for (let start = 0; start < items.length; start += concurrency) {
    const slice = items.slice(start, start + concurrency);
    const settled = await Promise.allSettled(
      slice.map((item, i) => worker(item, start + i))
    );
    for (let i = 0; i < settled.length; i++) {
      results[start + i] = settled[i];
    }
    // Pause between batches, but not after the final one.
    if (delayMs > 0 && start + concurrency < items.length) {
      await sleep(delayMs);
    }
  }

  return results;
}
