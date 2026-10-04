"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints, ApiRequestError } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { ChartSkeleton, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ForecastConfidenceNote,
  ForecastControls,
  ForecastSummary,
} from "@/components/forecast/forecast-controls";
import {
  CumulativeDemandChart,
  ForecastProjectionChart,
} from "@/components/forecast/charts";
import { CrossCategoryForecastTable } from "@/components/forecast/cross-category-table";
import { cn, formatNumber, formatPct, riskColor } from "@/lib/utils";
import type { LocationNode } from "@/types";
import { AlertTriangle, Cpu, Info } from "lucide-react";

export default function ForecastPage() {
  const [supplyType, setSupplyType] = useState("Fuel");
  const [horizon, setHorizon] = useState(7);
  const [locationId, setLocationId] = useState<string | null>(null);

  const { data: nodesData } = useQuery({
    queryKey: ["nodes"],
    queryFn: endpoints.nodes,
  });
  const nodes: LocationNode[] = nodesData?.nodes ?? [];

  const {
    data: forecast,
    isLoading,
    isError,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["forecast", supplyType, horizon, locationId],
    queryFn: () =>
      endpoints.forecast({
        supply_type: supplyType,
        horizon_days: horizon,
        location_id: locationId,
        history_days: 45,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: meta } = useQuery({ queryKey: ["forecast-meta"], queryFn: endpoints.forecastMeta });

  const riskC = riskColor(forecast?.risk_level);

  return (
    <>
      <PageHeader
        title="Demand Forecast"
        subtitle="AI Consumption Projection"
        description="RandomForestRegressor demand projection driven by historical consumption, temperature, rainfall, road condition, transport availability and seasonal index."
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined}
        badge="Demo prediction using synthetic data"
        badgeTone="accent"
      />

      {/* Controls */}
      <ForecastControls
        supplyType={supplyType}
        onSupplyTypeChange={setSupplyType}
        horizon={horizon}
        onHorizonChange={setHorizon}
        locationId={locationId}
        onLocationChange={setLocationId}
        nodes={nodes}
        loading={isLoading}
      />

      {isError ? (
        <div className="mt-4">
          <ErrorState
            title="Forecast unavailable"
            message={(error as ApiRequestError)?.message}
            hint={(error as ApiRequestError)?.hint}
            onRetry={() => refetch()}
          />
        </div>
      ) : null}

      {/* Summary */}
      <div className="mt-4">
        {isLoading && !forecast ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass rounded-sm p-3.5">
                <div className="h-2 w-24 animate-pulse rounded-sm bg-base-750" />
                <div className="mt-3 h-5 w-28 animate-pulse rounded-sm bg-base-750" />
                <div className="mt-3 h-2 w-32 animate-pulse rounded-sm bg-base-750" />
              </div>
            ))}
          </div>
        ) : forecast ? (
          <ForecastSummary forecast={forecast} />
        ) : null}
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader
            title={`Historical Consumption + Predicted Demand`}
            subtitle={`${forecast?.supply_type ?? supplyType} · ${horizon}-day horizon · ${forecast?.location_name ?? "..."}`}
            icon={<TrendingIcon size={13} />}
            actions={
              forecast ? (
                <Tooltip
                  content={`Lower/upper bounds widen with horizon. Model: ${forecast.model} ${forecast.model_version}`}
                >
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Cpu className="size-3 text-accent-500/80" />
                    {forecast.model_version}
                  </span>
                </Tooltip>
              ) : null
            }
          />

          {isLoading && !forecast ? (
            <div className="p-4">
              <ChartSkeleton height={330} />
            </div>
          ) : forecast ? (
            <>
              <div className="px-1 py-4">
                <ForecastProjectionChart forecast={forecast} />
              </div>
              <ForecastConfidenceNote confidence={forecast.confidence} unit={forecast.unit} />
            </>
          ) : null}
        </Panel>

        <div className="space-y-3 xl:col-span-4">
          {/* Verdict */}
          <Panel>
            <PanelHeader
              title="Forecast Verdict"
              subtitle="Model output and recommended action"
              icon={<Info size={13} />}
            />
            {forecast ? (
              <PanelBody className="space-y-3.5">
                <div
                  className="rounded-sm border p-3"
                  style={{
                    borderColor: `${riskC.hex}44`,
                    background: `${riskC.hex}0f`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5" style={{ color: riskC.hex }} />
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: riskC.hex }}
                    >
                      {forecast.risk_level} RISK
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-300">
                    {forecast.recommendation}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="label-caps text-[9px] text-slate-500">Node</dt>
                    <dd className="mt-0.5 truncate text-[12px] text-slate-200">
                      {forecast.location_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps text-[9px] text-slate-500">Horizon</dt>
                    <dd className="num mt-0.5 text-[12px] text-slate-200">
                      {forecast.horizon_days} days
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps text-[9px] text-slate-500">Daily average</dt>
                    <dd className="num mt-0.5 text-[12px] text-slate-200">
                      {formatNumber(forecast.daily_average)} {forecast.unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps text-[9px] text-slate-500">Confidence</dt>
                    <dd className="num mt-0.5 text-[12px] text-slate-200">
                      {formatPct(forecast.confidence * 100, 0)}
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-base-800 pt-3">
                  <p className="label-caps mb-1.5 text-[9px] text-slate-500">Model features</p>
                  <div className="flex flex-wrap gap-1">
                    {(forecast.features_used ?? []).slice(0, 10).map((f) => (
                      <span
                        key={f}
                        className="rounded-sm border border-base-700 bg-base-850 px-1.5 py-0.5 font-mono text-[9px] text-slate-500"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {meta?.model?.metrics ? (
                  <div className="border-t border-base-800 pt-3">
                    <p className="label-caps mb-1.5 text-[9px] text-slate-500">
                      Backtest performance (synthetic)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <MetricChip
                        label="MAPE"
                        value={`${meta.model.metrics.mape?.toFixed(2)}%`}
                      />
                      <MetricChip label="R²" value={meta.model.metrics.r2?.toFixed(3) ?? "--"} />
                      <MetricChip
                        label="Train rows"
                        value={formatNumber(meta.model.metrics.train_rows ?? 0)}
                      />
                    </div>
                  </div>
                ) : null}

                <p className="border-t border-base-800 pt-3 text-[10px] leading-relaxed text-slate-600">
                  {meta?.disclaimer ??
                    "Demo prediction using synthetic data. Not operationally accurate."}
                </p>
              </PanelBody>
            ) : null}
          </Panel>
        </div>
      </div>

      {/* Cumulative drawdown */}
      <Panel className="mt-3">
        <PanelHeader
          title="Cumulative Demand vs Available Stock"
          subtitle="Projected draw-down across the horizon with the breach point"
          icon={<TrendingIcon size={13} />}
        />
        {isLoading && !forecast ? (
          <div className="p-4">
            <ChartSkeleton height={220} />
          </div>
        ) : forecast ? (
          <div className="px-1 py-4">
            <CumulativeDemandChart forecast={forecast} />
          </div>
        ) : null}
      </Panel>

      {/* Cross-category comparison */}
      <div className="mt-3">
        <CrossCategoryForecastTable horizon={horizon} nodes={nodes} />
      </div>
    </>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-base-700 bg-base-850 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="num mt-0.5 text-[12px] font-medium text-slate-200">{value}</p>
    </div>
  );
}

function TrendingIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}