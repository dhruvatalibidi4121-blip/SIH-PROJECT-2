import { cn } from "@/lib/utils";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

/* ------------------------------- skeletons -------------------------------- */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("animate-pulse rounded-sm bg-base-750/80", className)} style={style} />
  );
}

export function KpiSkeleton() {
  return (
    <div className="panel rounded-sm p-4">
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-1.5 w-full" />
      <Skeleton className="mt-4 h-2.5 w-40" />
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("panel rounded-sm p-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="size-3.5 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-7 w-24" />
      <Skeleton className="mt-2 h-2.5 w-36" />
      <Skeleton className="mt-5 h-1.5 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="panel rounded-sm">
      <div className="border-b border-base-700 px-4 py-3">
        <Skeleton className="h-2.5 w-32" />
      </div>
      <div className="divide-y divide-base-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="panel rounded-sm p-4">
      <Skeleton className="h-2.5 w-36" />
      <Skeleton className="mt-6 w-full" style={{ height }} />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel rounded-sm p-4">
      <Skeleton className="h-2.5 w-28" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-sm" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="panel map-grid-bg flex h-full min-h-[420px] items-center justify-center rounded-sm">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-5 animate-spin text-accent-500" />
        <span className="text-xs text-slate-500">Loading GIS layers...</span>
      </div>
    </div>
  );
}

/* --------------------------------- states --------------------------------- */
export function ErrorState({
  title = "Unable to load data",
  message,
  hint,
  onRetry,
  compact,
}: {
  title?: string;
  message?: string;
  hint?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-sm border border-crit-500/25 bg-crit-900/25 text-center",
        compact ? "px-4 py-6" : "px-6 py-12",
      )}
      role="alert"
    >
      <div className="flex size-9 items-center justify-center rounded-sm border border-crit-500/40 bg-crit-900/60">
        <AlertTriangle className="size-4 text-crit-400" />
      </div>
      <p className="mt-3 text-sm font-semibold text-crit-400">{title}</p>
      {message ? (
        <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-slate-400">{message}</p>
      ) : null}
      {hint ? (
        <p className="mt-2 max-w-lg rounded-sm border border-base-700 bg-base-850 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-400">
          {hint}
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-8 items-center gap-2 rounded-sm border border-base-600 bg-base-800 px-3 text-xs font-medium text-slate-200 transition-colors hover:border-accent-600 hover:text-accent-300"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title = "No data available",
  message,
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex size-9 items-center justify-center rounded-sm border border-base-700 bg-base-850">
        <Inbox className="size-4 text-slate-500" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-300">{title}</p>
      {message ? <p className="mt-1.5 max-w-sm text-xs text-slate-500">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
      <Loader2 className="size-3.5 animate-spin text-accent-500" />
      {label ?? "Loading..."}
    </span>
  );
}