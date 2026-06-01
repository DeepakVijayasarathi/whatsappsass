import { z } from "zod";

/** The shape of a saved segment filter — mirrors the query params the contacts
 *  list endpoint accepts. Stored as JSON on ContactSegment.filter. */
export const contactFilterSchema = z.object({
  tag: z.string().optional(),
  leadStatus: z.string().optional(),
  // optIn is tri-state: true / false / undefined (no filter)
  optIn: z.boolean().optional(),
  search: z.string().optional(),
});

export type ContactFilter = z.infer<typeof contactFilterSchema>;

/**
 * Build the Prisma `where` clause for a workspace's contacts from a filter.
 * Used by both GET /contacts and segment resolution so the two always agree
 * on what a given filter selects.
 */
export function buildContactWhere(workspaceId: string, filter: ContactFilter) {
  const { tag, leadStatus, optIn, search } = filter;
  return {
    workspaceId,
    ...(tag ? { tags: { has: tag } } : {}),
    ...(optIn === true ? { optIn: true } : optIn === false ? { optIn: false } : {}),
    ...(leadStatus ? { leadStatus } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}
