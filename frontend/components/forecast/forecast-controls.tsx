"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints, ApiRequestError } from "@/lib/api";
import { cn, formatNumber, formatPct, formatSigned, riskColor } from "@/lib/utils";
import { SUPPLY_TYPES, type LocationNode } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, InfoHint } from "@/components/ui/tooltip";
import { CATEGORY_COLORS } from "@/lib/utils";

export interface ForecastControlsProps {
  supplyType: string;
  onSupplyTypeChange: (v: string) => void;
  horizon: number;
  onHorizonChange: (v: number) => void;
  locationId: string | null;
  onLocationChange: (v: string | null) => void;
  nodes: LocationNode[];
  loading?: boolean;
}

/** Supply type / horizon / node selector bar for the forecast workspace. */
export function ForecastControls({
  supplyType,
  onSupplyTypeChange,
  horizon,
  onHorizonChange,
  locationId,
  onLocationChange,
  nodes,
  loading,
}: ForecastControlsProps) {
  const horizons = [3, 7, 14, 30];

  return (
    <div className="panel rounded-sm p-3.5">
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end">
        {/* Supply type */}
        <div className="min-w-0 flex-1">
          <label className="label-caps mb-1.5 flex items-center gap-1.5 text-slate-500">
            Supply Type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SUPPLY_TYPES.map((supply) => {
              const active = supplyType === supply;
              const accent = CATEGORY_COLORS[supply] ?? "#22b8d6";
              return (
                <button
                  key={supply}
                  type="button"
                  onClick={() => onSupplyTypeChange(supply)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "text-slate-50"
                      : "border-base-700 bg-base-850 text-slate-400 hover:border-base-600 hover:text-slate-200",
                  )}
                  style={
                    active
                      ? {
                          borderColor: accent,
                          background: `${accent}1c`,
                          boxShadow: `inset 0 0 0 1px ${accent}30`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: active ? accent : "#33415a" }}
                  />
                  {supply}
                </button>
              );
            })}
          </div>
        </div>

        {/* Horizon */}
        <div className="shrink-0">
          <label className="label-caps mb-1.5 flex items-center gap-1.5 text-slate-500">
            Forecast Horizon
            <InfoHint>
              Number of days projected forward. Longer horizons widen the confidence band and
              reduce the model confidence score.
            </InfoHint>
          </label>
          <div className="flex rounded-sm border border-base-700 bg-base-850 p-0.5">
            {horizons.map((h) => {
              const active = horizon === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => onHorizonChange(h)}
                  aria-pressed={active}
                  className={cn(
                    "num rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    active
                      ? "bg-accent-500/15 text-accent-300 shadow-[inset_0_0_0_1px_rgba(34,184,214,0.4)]"
                      : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  {h}d
                </button>
              );
            })}
          </div>
        </div>

        {/* Node */}
        <div className="w-full shrink-0 lg:w-56">
          <label
            htmlFor="forecast-node"
            className="label-caps mb-1.5 flex items-center gap-1.5 text-slate-500"
          >
            Location / Zone
            <InfoHint>
              Leave on &ldquo;Auto&rdquo; to anchor the view on the node with the tightest stock
              cover for this category.
            </InfoHint>
          </label>
          <select
            id="forecast-node"
            value={locationId ?? "auto"}
            onChange={(e) => onLocationChange(e.target.value === "auto" ? null : e.target.value)}
            disabled={loading}
            className="h-9 w-full rounded-sm border border-base-700 bg-base-850 px-2.5 text-[12px] text-slate-200 transition-colors hover:border-base-600 focus:border-accent-600 focus:outline-none disabled:opacity-50"
          >
            <option value="auto">Auto (tightest cover)</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/** Headline numbers for the selected forecast. */
export function ForecastSummary({
  forecast,
}: {
  forecast: {
    supply_type: string;
    unit: string;
    location_name: string;
    horizon_days: number;
    predicted_demand: number;
    current_inventory: number;
    confidence: number;
    daily_average: number;
    projected_shortage_day: number | null;
    projected_shortage_date: string | null;
    risk_level: string;
    demand_change_pct: number;
  };
}) {
  const c = riskColor(forecast.risk_level);
  const unit = forecast.unit;
  const shortage =
    forecast.projected_shortage_day !== null &&
    forecast.projected_shortage_day <= forecast.horizon_days;

  const stats = [
    {
      label: "Current Stock",
      value: `${formatNumber(forecast.current_inventory)} ${unit}`,
      sub: `on hand at ${forecast.location_name}`,
      tone: "text-slate-100",
    },
    {
      label: `Predicted ${forecast.horizon_days}-Day Demand`,
      value: `${formatNumber(forecast.predicted_demand)} ${unit}`,
      sub: `${formatNumber(forecast.daily_average)} ${unit}/day average`,
      tone: shortage ? "text-crit-400" : "text-accent-300",
    },
    {
      label: "Projected Shortage",
      value:
        forecast.projected_shortage_day !== null
          ? `Day ${forecast.projected_shortage_day}`
          : "None in horizon",
      sub: forecast.projected_shortage_date
        ? `from ${new Date(forecast.projected_shortage_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          })}`
        : "demand stays within stock",
      tone: shortage ? "text-crit-400" : "text-ok-400",
    },
    {
      label: "Model Confidence",
      value: formatPct(forecast.confidence * 100, 0),
      sub: `confidence interval width ±${formatPct(
        (1 - forecast.confidence) * 45,
        0,
      )} at horizon`,
      tone: "text-slate-200",
    },
    {
      label: "Demand Trend",
      value: formatSigned(forecast.demand_change_pct),
      sub: "vs preceding equal window",
      tone: forecast.demand_change_pct >= 0 ? "text-warn-500" : "text-ok-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="panel rounded-sm p-3.5">
          <p className="label-caps text-[9px] text-slate-500">{s.label}</p>
          <p className={cn("num mt-1.5 text-lg font-semibold leading-none", s.tone)}>{s.value}</p>
          <p className="mt-1.5 truncate text-[10px] text-slate-600">{s.sub}</p>
        </div>
      ))}

      {/* Risk verdict */}
      <div
        className="relative overflow-hidden rounded-sm border p-3.5"
        style={{ borderColor: `${c.hex}55`, background: `${c.hex}12` }}
      >
        <div className="flex items-center justify-between">
          <p className="label-caps text-[9px] text-slate-400">Forecast Risk</p>
          <span className="size-1.5 rounded-full" style={{ background: c.hex }} />
        </div>
        <p className="mt-1.5 text-lg font-semibold leading-none" style={{ color: c.hex }}>
          {forecast.risk_level}
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
          {shortage
            ? "Projected demand exceeds available stock inside the planning horizon."
            : "Projected demand remains covered by current stock."}
        </p>
      </div>
    </div>
  );
}

/** Confidence-interval readout under the chart. */
export function ForecastConfidenceNote({ confidence, unit }: { confidence: number; unit: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-base-800 px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="inline-block h-0.5 w-5 border-t border-dashed border-slate-500" />
        Confidence band
      </span>
      <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="inline-block h-0.5 w-5 bg-accent-500" />
        Modelled prediction
      </span>
      <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="inline-block h-0.5 w-5 bg-slate-600" />
        Recorded consumption
      </span>
      <Badge tone="neutral" className="ml-auto">
        confidence {formatPct(confidence * 100, 0)} · {unit}
      </Badge>
    </div>
  );
}