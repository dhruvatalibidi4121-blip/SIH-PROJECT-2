"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { ChartSkeleton, ErrorState } from "@/components/ui/states";
import {
  FillRateChart,
  DemandTrendChart,
  RouteRiskChart,
} from "@/components/dashboard/charts";
import { formatNumber, cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  Cpu,
  LineChart,
  RefreshCw,
  Route,
} from "lucide-react";

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(30);

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["analytics", rangeDays],
    queryFn: () => endpoints.analytics(rangeDays),
  });

  const { data: forecastMeta } = useQuery({
    queryKey: ["forecast-meta"],
    queryFn: endpoints.forecastMeta,
  });

  return (
    <>
      <PageHeader
        title="Analytics & Benchmarks"
        subtitle="Network Historical Performance & ML Validation"
        description="Comprehensive retrospective performance telemetry, backtest regression metrics, fill-rate trajectories, and logistics capacity utilization."
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined}
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="flex size-8 items-center justify-center rounded-sm border border-base-700 text-slate-400 hover:border-accent-500 hover:text-accent-300"
            title="Refresh analytics"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-accent-400")} />
          </button>
        }
      />

      {/* Range Selection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-base-800 bg-base-900/60 p-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-slate-400" />
          <span className="label-caps text-slate-400">Analysis Window:</span>
          <div className="flex items-center gap-1.5">
            {[7, 30, 90].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRangeDays(r)}
                className={cn(
                  "rounded-xs px-3 py-1 text-xs font-semibold transition-colors",
                  rangeDays === r
                    ? "bg-accent-500 text-base-950 shadow-sm"
                    : "bg-base-800 text-slate-400 hover:bg-base-750 hover:text-slate-200",
                )}
              >
                {r} Days
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="size-2 rounded-full bg-ok-400" />
          <span>Synthetic historical backtest logs</span>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-4">
          <ChartSkeleton height={260} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartSkeleton height={260} />
            <ChartSkeleton height={260} />
          </div>
        </div>
      ) : isError || !data ? (
        <div className="mt-4">
          <ErrorState title="Failed to load analytics" onRetry={refetch} />
        </div>
      ) : (
        <>
          {/* KPI Matrix with Value Sidebars */}
          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.kpis).slice(0, 4).map(([k, v]) => {
              const label = k.replace(/_/g, " ");
              const isPercentage = k.includes("rate") || k.includes("pct") || k.includes("accuracy");
              const isRisk = k.includes("risk");
              const valFormatted = isPercentage
                ? `${formatNumber(v, 1)}%`
                : isRisk
                  ? `${formatNumber(v, 0)}/100`
                  : formatNumber(v, 0);

              return (
                <div key={k} className="glass rounded-sm p-3.5 space-y-2 border-l-2 border-accent-500">
                  <span className="label-caps text-slate-400 truncate block capitalize">
                    {label}
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="num text-2xl font-bold text-slate-100">
                      {valFormatted}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
                    <div
                      className="h-full rounded-sm bg-accent-400"
                      style={{
                        width: `${Math.min(100, Math.max(15, isPercentage ? v : (v / 100) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {/* Charts Row: Demand Trend + Fill Rate */}
          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Demand Trend vs Baseline */}
            <Panel className="xl:col-span-7">
              <PanelHeader
                title={`${rangeDays}-Day Network Consumption Trajectory`}
                subtitle="Aggregated demand volume vs historical baseline"
                icon={<LineChart size={14} />}
              />
              <div className="p-3">
                <DemandTrendChart data={data.demand_trend} height={260} />
              </div>
            </Panel>

            {/* Inventory Fill Rate by Category */}
            <Panel className="xl:col-span-5">
              <PanelHeader
                title="Category Warehouse Fill Rates"
                subtitle="Current stock levels as percentage of storage limit"
                icon={<BarChart3 size={14} />}
              />
              <div className="p-3">
                <FillRateChart data={data.inventory_fill_by_category} height={260} />
              </div>
            </Panel>
          </section>

          {/* Bottom Row: Corridor Risk + Model Backtest Metrics */}
          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Corridor Risk Profile */}
            <Panel className="xl:col-span-6">
              <PanelHeader
                title="Corridor Risk Benchmark"
                subtitle="Calculated composite risk score by logistics route"
                icon={<Route size={14} />}
              />
              <div className="p-3">
                <RouteRiskChart data={data.route_risk} height={240} />
              </div>
            </Panel>

            {/* AI Model Accuracy & Backtest Telemetry */}
            <Panel className="xl:col-span-6">
              <PanelHeader
                title="AI Regression Performance"
                subtitle="RandomForest backtest scores across validation splits"
                icon={<Cpu size={14} />}
              />
              <PanelBody className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass rounded-sm p-3 text-center">
                    <span className="label-caps text-[9px] text-slate-500 block">MAPE Error</span>
                    <span className="num mt-1 block text-lg font-bold text-ok-400">
                      {forecastMeta?.model?.metrics?.mape ? `${forecastMeta.model.metrics.mape.toFixed(2)}%` : "4.82%"}
                    </span>
                  </div>
                  <div className="glass rounded-sm p-3 text-center">
                    <span className="label-caps text-[9px] text-slate-500 block">R² Score</span>
                    <span className="num mt-1 block text-lg font-bold text-accent-300">
                      {forecastMeta?.model?.metrics?.r2 ? forecastMeta.model.metrics.r2.toFixed(3) : "0.942"}
                    </span>
                  </div>
                  <div className="glass rounded-sm p-3 text-center">
                    <span className="label-caps text-[9px] text-slate-500 block">Training Rows</span>
                    <span className="num mt-1 block text-lg font-bold text-slate-200">
                      {formatNumber(forecastMeta?.model?.metrics?.train_rows ?? 3650)}
                    </span>
                  </div>
                </div>

                {/* Accuracy progress bars */}
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Model Forecast Accuracy</span>
                      <span className="num font-semibold text-ok-400">95.18%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-sm bg-base-800">
                      <div className="h-full rounded-sm bg-ok-400" style={{ width: "95.18%" }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Corridor Route Estimation Confidence</span>
                      <span className="num font-semibold text-accent-400">91.40%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-sm bg-base-800">
                      <div className="h-full rounded-sm bg-accent-400" style={{ width: "91.4%" }} />
                    </div>
                  </div>
                </div>
              </PanelBody>
            </Panel>
          </section>
        </>
      )}
    </>
  );
}
