import * as React from "react";
import { cn } from "@/lib/utils";

/** Glass surface panel -- the primary container treatment. */
export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass relative rounded-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
  dense,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-base-600/50",
        dense ? "px-3.5 py-2.5" : "px-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-accent-500/80">{icon}</span> : null}
        <div className="min-w-0">
          <h3
            className={cn(
              "label-caps truncate text-slate-300",
              dense ? "text-[10px]" : "text-[11px]",
            )}
          >
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PanelBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4", className)} {...props}>
      {children}
    </div>
  );
}

/** Section heading used above groups of panels. */
export function SectionTitle({
  children,
  hint,
  className,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <h2 className="text-sm font-semibold tracking-tight text-slate-100">{children}</h2>
      {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
    </div>
  );
}