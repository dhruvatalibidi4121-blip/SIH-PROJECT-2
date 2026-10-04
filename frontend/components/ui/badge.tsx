import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, riskColor } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
  {
    variants: {
      tone: {
        neutral: "border-base-600 bg-base-800 text-slate-300",
        accent: "border-accent-500/40 bg-accent-900/50 text-accent-300",
        ok: "border-ok-500/40 bg-ok-900/50 text-ok-400",
        warn: "border-warn-500/40 bg-warn-900/50 text-warn-500",
        crit: "border-crit-500/40 bg-crit-900/50 text-crit-400",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/** Small status pill. Use `tone` for explicit control or pass `status` to derive it. */
export function Badge({ className, tone, status, children, ...props }: BadgeProps & { status?: string }) {
  const derived = React.useMemo(() => {
    if (tone) return undefined;
    if (!status) return undefined;
    const key = status.toUpperCase();
    if (key === "HEALTHY" || key === "LOW" || key === "RESOLVED" || key === "AVAILABLE") return "ok" as const;
    if (key === "WARNING" || key === "MEDIUM" || key === "MAINTENANCE") return "warn" as const;
    if (key === "CRITICAL" || key === "HIGH") return "crit" as const;
    return "neutral" as const;
  }, [tone, status]);

  return (
    <span className={cn(badgeVariants({ tone: derived }), className)} {...props}>
      {children ?? status}
    </span>
  );
}

/** Badge with a leading status dot. */
export function StatusBadge({
  status,
  className,
  label,
}: {
  status: string;
  className?: string;
  label?: string;
}) {
  const c = riskColor(
    status === "HEALTHY" || status === "RESOLVED" || status === "AVAILABLE"
      ? "LOW"
      : status === "WARNING" || status === "MEDIUM" || status === "MAINTENANCE"
        ? "MEDIUM"
        : status === "IN_TRANSIT" || status === "ACKNOWLEDGED" || status === "NEW"
          ? "HIGH"
          : status,
  );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        c.border,
        c.bg,
        c.text,
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{ background: c.hex }} />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

export { badgeVariants };