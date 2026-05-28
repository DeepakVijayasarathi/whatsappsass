import { cn } from "@/lib/utils";

/** Base skeleton block — inherits className for size/shape. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse bg-gray-100 rounded-lg", className)}
      aria-hidden="true"
    />
  );
}

/** Stat card skeleton — matches the .card layout used on Dashboard and Analytics. */
export function SkeletonStatCard() {
  return (
    <div className="card flex items-center gap-4" aria-hidden="true">
      <div className="animate-pulse bg-gray-100 rounded-2xl w-12 h-12 shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="animate-pulse bg-gray-100 rounded-lg h-6 w-20" />
        <div className="animate-pulse bg-gray-100 rounded-lg h-3.5 w-28" />
        <div className="animate-pulse bg-gray-100 rounded-lg h-3 w-20" />
      </div>
    </div>
  );
}

/** Table row skeleton — use `cols` to match the real column count. */
export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  const widths = ["w-full", "w-4/5", "w-2/3", "w-3/4", "w-1/2", "w-full", "w-5/6"];
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="tbl-td">
          <div
            className={`animate-pulse bg-gray-100 rounded-lg h-4 ${widths[i % widths.length]}`}
          />
        </td>
      ))}
    </tr>
  );
}

/** Multi-line text skeleton — good for paragraphs, descriptions. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-4/5", "w-2/3", "w-3/4", "w-1/2"];
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-gray-100 rounded-lg h-4 ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

/** Full page / section loading state — centered spinner alternative. */
export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-fade-in" aria-hidden="true" aria-label="Loading…">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="animate-pulse bg-gray-100 rounded-lg h-7 w-48" />
          <div className="animate-pulse bg-gray-100 rounded-lg h-4 w-32" />
        </div>
        <div className="animate-pulse bg-gray-100 rounded-xl h-9 w-28" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      {/* Content card */}
      <div className="card space-y-4">
        <div className="animate-pulse bg-gray-100 rounded-lg h-5 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-4" style={{ width: `${70 + (i * 7) % 30}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Kanban card skeleton — for CRM/sequence loading states. */
export function SkeletonKanbanCard() {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100" aria-hidden="true">
      <div className="flex items-start gap-2 mb-2">
        <div className="animate-pulse bg-gray-100 rounded-full w-7 h-7 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="animate-pulse bg-gray-100 rounded h-3.5 w-3/4" />
          <div className="animate-pulse bg-gray-100 rounded h-3 w-1/2" />
        </div>
      </div>
      <div className="animate-pulse bg-gray-100 rounded h-6 w-full mt-2" />
    </div>
  );
}
