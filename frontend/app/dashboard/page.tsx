"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { endpoints, ApiRequestError } from "@/lib/api";
import { CardSkeleton, ChartSkeleton, ErrorState, KpiSkeleton, ListSkeleton } from "@/components/ui/states";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { KpiCardView, MiniStat } from "@/components/dashboard/kpi-card";
import { RiskGauge } from "@/components/risk/risk-gauge";
import { RecommendationDigest } from "@/components/dashboard/recommendations";
import { AlertRow } from "@/components/dashboard/alert-row";
import { WeatherStrip } from "@/components/dashboard/weather-strip";
import { DemandTrendChart, CategoryDistributionChart, RouteRiskChart } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { MapPin, Target, TrendingUp } from "lucide-react";
import {
  CATEGORY_COLORS,
  cn,
  formatClock,
  formatNumber,
  formatPct,
  riskColor,
} from "@/lib/utils";

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard"],
    queryFn: endpoints.dashboard,
  });

  if (isError) {
    const err = error as ApiRequestError;
    return (
      <>
        <PageHeader
          title="Overview"
          subtitle="Current Logistics Health"
          description="Network-wide inventory, demand, routing and risk posture."
        />
        <ErrorState
          title="Dashboard data unavailable"
          message={err?.message ?? "The backend did not return dashboard data."}
          hint={err?.hint}
          onRetry={() => refetch()}
        />
      </>
    );
  }

  const healthColor =
    data?.health_label === "STABLE"
      ? riskColor("LOW")
      : data?.health_label === "WATCH"
        ? riskColor("MEDIUM")
        : riskColor("HIGH");

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Current Logistics Health"
        description="Network-wide inventory, demand, routing and risk posture across five demo nodes."
        badge={data?.health_label ? `${data.health_label} · ${data.health_score}/100` : undefined}
        badgeTone={
          data?.health_label === "STABLE" ? "ok" : data?.health_label === "WATCH" ? "warn" : "crit"
        }
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined}
        actions={
          <Link
            href="/analytics"
            className="hidden text-[11px] text-slate-500 transition-colors hover:text-accent-400 sm:block"
          >
            Full analytics →
          </Link>
        }
      />

      {/* ------------------------------------------------------- KPI grid */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
            : data?.kpis.map((kpi, i) => <KpiCardView key={kpi.key} kpi={kpi} index={i} />)}
        </div>
      </section>

      {/* ------------------------------------- Health / risk / weather row */}
      <section className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
        {/* Composite risk gauge */}
        <Panel className="xl:col-span-4">
          <PanelHeader
            title="Composite Risk Score"
            subtitle="Weighted across five components"
            icon={<Target size={13} />}
          />
          <div className="flex flex-col items-center gap-4 px-4 py-5 lg:flex-row lg:items-start lg:gap-6">
            {data ? (
              <>
                <div className="shrink-0">
                  <RiskGauge
                    score={data.risk_total}
                    level={data.risk_level}
                    label="Network Risk"
                    sublabel="higher = more exposure"
                  />
                </div>
                <div className="w-full min-w-0 flex-1 space-y-2.5">
                  <MiniStat
                    label="Health Status"
                    value={data.health_label}
                    tone={
                      data.health_label === "STABLE"
                        ? "ok"
                        : data.health_label === "WATCH"
                          ? "warn"
                          : "crit"
                    }
                    hint={`Derived health score ${data.health_score}/100 from composite risk and open alert load.`}
                  />
                  <MiniStat
                    label="Active Alerts"
                    value={`${data.active_alert_count} open`}
                    tone={data.active_alert_count > 5 ? "crit" : "warn"}
                    hint="Alerts not yet marked resolved."
                  />
                  <MiniStat
                    label="Recommended Corridor"
                    value={data.recommended_route ?? "--"}
                    tone="accent"
                    hint="Highest weighted route score across the current candidate corridors."
                  />
                  <MiniStat
                    label="Model Accuracy"
                    value={formatPct(data.forecast_accuracy.accuracy_pct ?? 0, 1)}
                    tone="ok"
                    hint={`RandomForestRegressor backtest MAPE ${formatPct(data.forecast_accuracy.mape ?? 0, 1)} on synthetic data.`}
                  />
                  <Link
                    href="/risk"
                    className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-accent-400 transition-colors hover:text-accent-300"
                  >
                    Open Risk Intelligence →
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex w-full flex-col items-center gap-4 lg:flex-row">
                <div className="animate-pulse rounded-full bg-base-800" style={{ width: 210, height: 210 }} />
                <div className="w-full space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-2 w-20 bg-base-800" />
                      <div className="mt-2 h-3.5 w-28 bg-base-800" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Demand trend */}
        <Panel className="xl:col-span-5">
          <PanelHeader
            title="30-Day Demand Trend"
            subtitle="Total network consumption vs baseline"
            icon={<TrendingUp size={13} />}
            actions={
              <Link href="/analytics" className="text-[10px] text-slate-500 hover:text-accent-400">
                Details →
              </Link>
            }
          />
          {isLoading ? (
            <div className="p-4">
              <ChartSkeleton height={228} />
            </div>
          ) : (
            <div className="px-1 py-3">
              <DemandTrendChart data={data?.demand_trend ?? []} />
            </div>
          )}
        </Panel>

        {/* Category distribution */}
        <Panel className="xl:col-span-3">
          <PanelHeader
            title="Supply Mix"
            subtitle="Projected 7-day demand by category"
            icon={<LayersIcon size={13} />}
          />
          {isLoading ? (
            <div className="p-4">
              <ChartSkeleton height={228} />
            </div>
          ) : (
            <div className="px-1 py-3">
              <CategoryDistributionChart data={data?.category_distribution ?? []} />
            </div>
          )}
        </Panel>
      </section>

      {/* ------------------------------------- Alerts / recommendations row */}
      <section className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Panel className="xl:col-span-5">
          <PanelHeader
            title="Priority Alerts"
            subtitle="Automatically generated by the prediction engine"
            icon={<SirenIcon size={13} />}
            actions={
              <Link href="/alerts" className="text-[10px] text-slate-500 hover:text-accent-400">
                All alerts →
              </Link>
            }
          />
          {isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={4} />
            </div>
          ) : (
            <div className="divide-y divide-base-800">
              {(data?.top_alerts ?? []).slice(0, 5).map((alert) => (
                <AlertRow key={alert.id} alert={alert} compact />
              ))}
              {!data?.top_alerts.length ? (
                <p className="px-4 py-6 text-center text-xs text-slate-500">
                  No active alerts. All clear.
                </p>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader
            title="AI Recommendations"
            subtitle="Highest-priority suggested actions"
            icon={<SparklesIcon size={13} />}
            actions={
              <Link href="/risk#recommendations" className="text-[10px] text-slate-500 hover:text-accent-400">
                All →
              </Link>
            }
          />
          {isLoading ? <ListSkeleton rows={4} /> : <RecommendationDigest recommendations={data?.recommendations ?? []} />}
        </Panel>

        <Panel className="xl:col-span-3">
          <PanelHeader
            title="Weather Risk"
            subtitle="Synthetic observations per node"
            icon={<CloudIcon size={13} />}
            actions={
              <Link href="/risk" className="text-[10px] text-slate-500 hover:text-accent-400">
                Risk →
              </Link>
            }
          />
          {isLoading ? <ListSkeleton rows={4} /> : <WeatherStrip records={data?.weather_snapshot ?? []} />}
        </Panel>
      </section>

      {/* ------------------------------------------- Route risk + node table */}
      <section className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Panel className="xl:col-span-5">
          <PanelHeader
            title="Corridor Risk Profile"
            subtitle="Composite risk by corridor"
            icon={<RouteIcon size={13} />}
            actions={
              <Link href="/map" className="text-[10px] text-slate-500 hover:text-accent-400">
                Map →
              </Link>
            }
          />
          {isLoading ? (
            <div className="p-4">
              <ChartSkeleton height={210} />
            </div>
          ) : (
            <div className="px-1 py-3">
              <RouteRiskChart data={data?.route_risk_summary ?? []} />
            </div>
          )}
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader
            title="Network Nodes"
            subtitle="Fill rate, forecast demand and risk by location"
            icon={<MapPin size={13} />}
            actions={
              <Link href="/map" className="text-[10px] text-slate-500 hover:text-accent-400">
                Open GIS map →
              </Link>
            }
          />
          {isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={5} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-base-700">
                    {["Node", "Type", "Fill", "7d Demand", "Risk", "ETA"].map((h) => (
                      <th
                        key={h}
                        className="label-caps whitespace-nowrap px-4 py-2 text-[9px] font-semibold text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-800">
                  {(data?.nodes ?? []).map((node) => {
                    const c = riskColor(node.risk_level);
                    return (
                      <tr key={node.id} className="transition-colors hover:bg-base-850/50">
                        <td className="px-4 py-2.5">
                          <span className="block truncate text-[12px] font-medium text-slate-200">
                            {node.name}
                          </span>
                          <span className="block truncate text-[10px] text-slate-600">
                            {node.region}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] text-slate-400">
                            {node.node_type === "HUB"
                              ? "Hub"
                              : node.node_type === "DISTRIBUTION"
                                ? "Distribution"
                                : "Forward"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-sm bg-base-700">
                              <div
                                className="h-full rounded-sm"
                                style={{
                                  width: `${Math.min(100, node.fill_pct)}%`,
                                  background: node.fill_pct < 30 ? "#e0483f" : node.fill_pct < 60 ? "#e8a33d" : "#2fbf71",
                                }}
                              />
                            </div>
                            <span className="num text-[11px] text-slate-400">
                              {node.fill_pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="num px-4 py-2.5 text-[11px] text-slate-400">
                          {formatNumber(node.predicted_demand_7d)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            className="border-0 px-1.5 py-0"
                            style={{ background: `${c.hex}1f`, color: c.hex }}
                          >
                            {node.risk_level}
                          </Badge>
                        </td>
                        <td className="num px-4 py-2.5 text-[11px] text-slate-400">
                          {node.estimated_delivery_hours
                            ? `${node.estimated_delivery_hours.toFixed(1)} h`
                            : "--"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>

      <DemoNotice updatedAt={data?.generated_at} />
    </>
  );
}

/* ---------------------------------------------------------------- icons --- */
function LayersIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}
function SirenIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
      <path d="M5 21h14" />
      <path d="M12 2v2M4.9 4.9l1.4 1.4M19.1 4.9l-1.4 1.4" />
    </svg>
  );
}
function SparklesIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
    </svg>
  );
}
function CloudIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9h-1.8A7 7 0 0 0 2 12a4 4 0 0 0 0 8h15.5Z" />
    </svg>
  );
}
function RouteIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h6.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H18" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  );
}

function DemoNotice({ updatedAt }: { updatedAt?: string }) {
  return (
    <div className="mt-5 flex flex-col gap-1.5 rounded-sm border border-base-800 bg-base-900/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[10px] leading-relaxed text-slate-600">
        Prototype for demonstration and decision-support research using synthetic data. Predictions
        are illustrative and not operationally accurate.
      </p>
      {updatedAt ? (
        <p className="num shrink-0 text-[10px] text-slate-600">
          Snapshot generated {formatClock(updatedAt)}
        </p>
      ) : null}
    </div>
  );
}