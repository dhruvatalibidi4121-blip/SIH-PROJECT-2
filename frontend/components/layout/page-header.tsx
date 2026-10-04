"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { formatClock } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Consistent page header: title, subtitle (the "what am I looking at" line),
 * optional status badge and generation timestamp.
 */
export function PageHeader({
  title,
  subtitle,
  description,
  badge,
  badgeTone,
  updatedAt,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  badgeTone?: BadgeProps["tone"];
  updatedAt?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-semibold tracking-tight text-slate-50">{title}</h1>
          {subtitle ? (
            <span className="text-slate-700" aria-hidden>
              /
            </span>
          ) : null}
          {subtitle ? (
            <span className="text-sm font-medium text-accent-300">{subtitle}</span>
          ) : null}
          {badge ? <Badge tone={badgeTone ?? "neutral"}>{badge}</Badge> : null}
        </div>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {actions}
        {updatedAt ? (
          <span className="num hidden text-[10px] text-slate-600 sm:block">
            Updated {formatClock(updatedAt)}
          </span>
        ) : null}
      </div>
    </header>
  );
}