export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function SkeletonStatCard() {
  return (
    <div className="card flex items-center gap-4">
      <div className="animate-pulse bg-gray-200 rounded-xl w-12 h-12 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="animate-pulse bg-gray-200 rounded h-7 w-16" />
        <div className="animate-pulse bg-gray-200 rounded h-4 w-28" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <div className="animate-pulse bg-gray-100 rounded h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  const widths = ["w-full", "w-4/5", "w-2/3", "w-3/4", "w-1/2"];
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`animate-pulse bg-gray-200 rounded h-4 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}
