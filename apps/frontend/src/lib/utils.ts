/**
 * Utility helpers shared across the frontend.
 */

/**
 * Merge class names — drops falsy values.
 * Lightweight alternative to `clsx` for cases where both are imported.
 * For complex conditional logic, continue using `clsx` directly.
 *
 * @example cn("base", condition && "extra", undefined) → "base extra"
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format a number with compact notation (e.g. 1_234 → "1.2K").
 * Used in stat cards and badge counts.
 */
export function formatCount(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * Format a relative timestamp — returns a short human-readable string.
 * Falls back to a locale date if more than 7 days old.
 */
export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);

  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Truncate a string to `maxLen` characters, appending "…" if truncated.
 */
export function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen).trimEnd() + "…" : s;
}

/**
 * Generate initials from a name (up to 2 characters).
 * "Jane Doe" → "JD", "Alice" → "A", "" → "?"
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

/**
 * Deterministic avatar background color from a string.
 * Returns one of 7 distinct Tailwind color pairs (bg + text).
 */
const AVATAR_PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-amber-100 text-amber-700",
] as const;

export function avatarColor(seed: string): string {
  const code = seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}
