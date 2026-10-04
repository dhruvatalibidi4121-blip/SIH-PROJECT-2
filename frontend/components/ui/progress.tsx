import { cn } from "@/lib/utils";

/** Horizontal progress bar with a threshold marker. */
export function Progress({
  value,
  max = 100,
  className,
  barClassName,
  showThreshold,
  threshold,
  height = "h-1.5",
  ariaLabel,
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  showThreshold?: boolean;
  threshold?: number;
  height?: string;
  ariaLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-sm bg-base-700/80", height, className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={cn("h-full rounded-sm transition-[width] duration-500", barClassName)}
        style={{ width: `${pct}%` }}
      />
      {showThreshold && threshold !== undefined ? (
        <span
          className="absolute top-0 h-full w-px bg-slate-400/70"
          style={{ left: `${Math.min(100, threshold)}%` }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function ProgressSkeleton({ className }: { className?: string }) {
  return <div className={cn("h-1.5 w-full animate-pulse rounded-sm bg-base-700", className)} />;
}