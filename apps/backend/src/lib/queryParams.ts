/**
 * Safely parse and cap pagination query parameters.
 * Prevents absurdly large offsets or page sizes from causing DB timeouts.
 */
export function parsePagination(
  query: Record<string, string | undefined>,
  opts: { defaultLimit?: number; maxLimit?: number; maxPage?: number } = {}
): { page: number; limit: number; skip: number } {
  const { defaultLimit = 20, maxLimit = 100, maxPage = 500 } = opts;

  const rawPage = parseInt(query.page ?? "1", 10);
  const rawLimit = parseInt(query.limit ?? String(defaultLimit), 10);

  const page = Math.max(1, Math.min(isNaN(rawPage) ? 1 : rawPage, maxPage));
  const limit = Math.max(1, Math.min(isNaN(rawLimit) ? defaultLimit : rawLimit, maxLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
