"use client";

import { cn, riskColor, formatPct } from "@/lib/utils";
import { EmptyState, ListSkeleton } from "@/components/ui/states";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { Recommendation } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Boxes,
  Gauge,
  Lightbulb,
  MapPinned,
  Sparkles,
  Target,
  TrendingUp,
  Truck,
} from "lucide-react";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Inventory: Boxes,
  Demand: TrendingUp,
  Routing: MapPinned,
  Weather: Gauge,
  Transport: Truck,
  Risk: Target,
};

function RecommendationRow({ rec }: { rec: Recommendation }) {
  const c = riskColor(rec.priority);
  const Icon = CATEGORY_ICON[rec.category] ?? Lightbulb;

  return (
    <article className="group relative border-b border-base-800 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-base-850/50">
      {/* Priority rail */}
      <span
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ background: c.hex, opacity: 0.8 }}
        aria-hidden
      />

      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm border"
          style={{ borderColor: `${c.hex}44`, background: `${c.hex}12`, color: c.hex }}
        >
          <Icon className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="border-0 px-1.5 py-0"
              style={{ background: `${c.hex}1f`, color: c.hex }}
            >
              {rec.priority}
            </Badge>
            <span className="label-caps text-[9px] text-slate-500">{rec.category}</span>
            {rec.location_name ? (
              <span className="truncate text-[10px] text-slate-600">{rec.location_name}</span>
            ) : null}
            <Tooltip content={`Model confidence ${formatPct(rec.confidence * 100, 0)}`}>
              <span className="num ml-auto shrink-0 text-[9px] text-slate-600">
                {formatPct(rec.confidence * 100, 0)} conf
              </span>
            </Tooltip>
          </div>

          <h4 className="mt-1.5 text-[13px] font-medium leading-snug text-slate-100">
            {rec.title}
          </h4>

          <dl className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed">
            <div className="flex gap-2">
              <dt className="label-caps w-[68px] shrink-0 pt-[1px] text-[9px] text-slate-600">
                Reason
              </dt>
              <dd className="min-w-0 text-slate-400">{rec.reason}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="label-caps w-[68px] shrink-0 pt-[1px] text-[9px] text-slate-600">
                Impact
              </dt>
              <dd className="min-w-0 text-slate-400">{rec.expected_impact}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="label-caps w-[68px] shrink-0 pt-[1px] text-[9px] text-slate-600">
                Action
              </dt>
              <dd className="min-w-0 text-accent-300/90">{rec.suggested_action}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

export function RecommendationList({
  recommendations,
  loading,
  emptyMessage,
  max,
}: {
  recommendations: Recommendation[];
  loading?: boolean;
  emptyMessage?: string;
  max?: number;
}) {
  if (loading) return <ListSkeleton rows={4} />;
  if (!recommendations.length) {
    return (
      <EmptyState
        title="No recommendations"
        message={emptyMessage ?? "The engine found no actionable items in the current dataset."}
      />
    );
  }

  const items = max ? recommendations.slice(0, max) : recommendations;
  return (
    <div>
      {items.map((rec) => (
        <RecommendationRow key={rec.id} rec={rec} />
      ))}
    </div>
  );
}

/** Compact single-line recommendation for dashboard side panels. */
export function RecommendationDigest({
  recommendations,
  max = 4,
}: {
  recommendations: Recommendation[];
  max?: number;
}) {
  if (!recommendations.length) {
    return <EmptyState title="No recommendations" message="Nothing requires attention." />;
  }
  return (
    <ul className="divide-y divide-base-800">
      {recommendations.slice(0, max).map((rec) => {
        const c = riskColor(rec.priority);
        return (
          <li key={rec.id}>
            <Tooltip
              side="left"
              content={
                <div className="max-w-sm space-y-1.5">
                  <p className="font-semibold text-slate-100">{rec.title}</p>
                  <p>{rec.reason}</p>
                  <p className="text-accent-300">Action: {rec.suggested_action}</p>
                </div>
              }
            >
              <div className="flex cursor-help items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-base-850/60">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: c.hex }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[12px] text-slate-300">
                  {rec.title}
                </span>
                <ArrowRight className="size-3 shrink-0 text-slate-600" />
              </div>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

export function RecommendationEngineBadge({ engine }: { engine?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
      <Sparkles className="size-3 text-accent-500/80" />
      <span className="truncate">{engine ?? "LOGISENSE Rule + Forecast Ensemble v1.0"}</span>
    </span>
  );
}

export function RecommendationDisclaimer({ text }: { text?: string }) {
  return (
    <p className={cn("px-4 py-2.5 text-[10px] leading-relaxed text-slate-600")}>
      {text ??
        "Decision-support suggestions generated from synthetic demonstration data. Not operational instructions."}
    </p>
  );
}