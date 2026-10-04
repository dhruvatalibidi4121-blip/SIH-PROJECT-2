"use client";

import { Tooltip, InfoHint } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/states";
import { cn, formatSigned, riskColor } from "@/lib/utils";
import type { KpiCard } from "@/types";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";

/**
 * KPI card. Every value comes from /api/dashboard -- nothing is hard-coded.
 */
export function KpiCardView({ kpi, index = 0 }: { kpi: KpiCard; index?: number }) {
  const c = riskColor(kpi.status);
  const delta = kpi.delta ?? 0;
  const positive = delta > 0.05;
  const negative = delta < -0.05;
  const DeltaIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;

  // A fill-rate bar is only meaningful for the inventory card.
  const showBar = kpi.key === "total_inventory";

  return (
    <Link
      href={kpi.href}
      className="group glass edge-top relative block overflow-hidden rounded-sm p-4 transition-colors hover:border-accent-600/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500"
    >
      {/* Status accent rail */}
      <span
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ background: c.hex, opacity: 0.85 }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2">
        <span className="label-caps text-slate-400">{kpi.label}</span>
        <InfoHint>{kpi.hint}</InfoHint>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="num text-[26px] font-semibold leading-none tracking-tight"
          style={{ color: c.hex }}
        >
          {kpi.value}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-medium",
            positive ? "text-ok-400" : negative ? "text-slate-400" : "text-slate-500",
          )}
        >
          <DeltaIcon className="size-3" />
          {formatSigned(delta, Math.abs(delta) < 10 ? 1 : 0)}
        </span>
      </div>

      {showBar ? (
        <>
          <div className="relative mt-3.5 h-1.5 w-full overflow-hidden rounded-sm bg-base-700/80">
            <div
              className="h-full rounded-sm transition-[width] duration-700"
              style={{ width: `${Math.max(0, Math.min(100, kpi.raw_value))}%`, background: c.hex }}
            />
            {/* 80% planning target marker */}
            <span
              className="absolute top-0 h-full w-px bg-slate-400/70"
              style={{ left: "80%" }}
              aria-hidden
            />
          </div>
          <p className="mt-1 text-right text-[9px] text-slate-600">target 80%</p>
        </>
      ) : null}

      <p className={cn("truncate text-[10px] text-slate-500", showBar ? "mt-1.5" : "mt-3")}>
        {kpi.delta !== null
          ? `${formatSigned(delta, Math.abs(delta) < 10 ? 1 : 0)} ${kpi.delta_label}`
          : kpi.delta_label}
      </p>

      <span className="pointer-events-none absolute right-3 top-3 text-[9px] uppercase tracking-wider text-base-600 opacity-0 transition-opacity group-hover:opacity-100">
        View →
      </span>
    </Link>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="panel rounded-sm p-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="size-3.5 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-7 w-28" />
      <Skeleton className="mt-4 h-1.5 w-full" />
      <Skeleton className="mt-4 h-2.5 w-36" />
    </div>
  );
}

/** Compact stat used in page headers. */
export function MiniStat({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "crit" | "accent";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "text-slate-200",
    ok: "text-ok-400",
    warn: "text-warn-500",
    crit: "text-crit-400",
    accent: "text-accent-300",
  };
  const body = (
    <div className="min-w-0">
      <p className="label-caps truncate text-[9px] text-slate-500">{label}</p>
      <p className={cn("num mt-1 truncate text-sm font-semibold", tones[tone])}>{value}</p>
    </div>
  );
  return hint ? <Tooltip content={hint}>{body}</Tooltip> : body;
}