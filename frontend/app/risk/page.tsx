"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";
import { RiskGauge, RiskLegend } from "@/components/risk/risk-gauge";
import { WeatherCard } from "@/components/dashboard/weather-strip";
import { RecommendationDigest } from "@/components/dashboard/recommendations";
import { Badge } from "@/components/ui/badge";
import { riskColor, cn } from "@/lib/utils";
import {
  CloudSun,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export default function RiskPage() {
  const [horizon, setHorizon] = useState(7);

  const {
    data: riskData,
    isLoading: isRiskLoading,
    isError: isRiskError,
    refetch: refetchRisk,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["risk", horizon],
    queryFn: () => endpoints.risk(horizon),
  });

  const { data: weather, isLoading: isWeatherLoading } = useQuery({
    queryKey: ["weather"],
    queryFn: () => endpoints.weather(),
  });

  const { data: recsData } = useQuery({
    queryKey: ["recommendations", horizon],
    queryFn: () => endpoints.recommendations(horizon),
  });

  const { data: nodesData } = useQuery({
    queryKey: ["nodes"],
    queryFn: endpoints.nodes,
  });

  const nodes = nodesData?.nodes ?? [];

  return (
    <>
      <PageHeader
        title="Risk Intelligence Engine"
        subtitle="Composite Tactical Exposure Posture"
        description="Multi-factor algorithmic risk assessment combining inventory deficits, forecast volatility, severe weather patterns, corridor terrain disruption, and fleet bottlenecks."
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetchRisk()}
              className="flex size-8 items-center justify-center rounded-sm border border-base-700 text-slate-400 hover:border-accent-500 hover:text-accent-300"
              title="Refresh risk calculations"
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-accent-400")} />
            </button>
          </div>
        }
      />

      {/* Horizon Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-base-800 bg-base-900/60 p-3">
        <div className="flex items-center gap-2">
          <span className="label-caps text-slate-400">Projection Horizon:</span>
          <div className="flex items-center gap-1.5">
            {[3, 7, 14, 30].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={cn(
                  "rounded-xs px-3 py-1 text-xs font-semibold transition-colors",
                  horizon === h
                    ? "bg-accent-500 text-base-950 shadow-sm"
                    : "bg-base-800 text-slate-400 hover:bg-base-750 hover:text-slate-200",
                )}
              >
                {h} Days
              </button>
            ))}
          </div>
        </div>

        <RiskLegend />
      </div>

      {isRiskError ? (
        <div className="mt-4">
          <ErrorState title="Failed to load risk data" onRetry={refetchRisk} />
        </div>
      ) : (
        <>
          {/* Top Row: Gauge + 5 Component Score Sidebars */}
          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Composite Gauge Card */}
            <Panel className="xl:col-span-4 p-5 flex flex-col items-center justify-center space-y-4">
              {isRiskLoading || !riskData ? (
                <div className="animate-pulse flex flex-col items-center gap-3">
                  <div className="size-48 rounded-full bg-base-800" />
                  <div className="h-4 w-32 bg-base-800 rounded" />
                </div>
              ) : (
                <>
                  <RiskGauge
                    score={riskData.total_score}
                    level={riskData.level}
                    label="Network Composite Risk"
                    sublabel={`Evaluated for ${horizon}-day horizon`}
                  />
                  <div className="w-full text-center">
                    <p className="text-xs text-slate-400">
                      Evaluated across {riskData.scope || "Northern Sector"} with 5 weighted vectors.
                    </p>
                  </div>
                </>
              )}
            </Panel>

            {/* 5-Component Risk Drivers Breakdown */}
            <Panel className="xl:col-span-8">
              <PanelHeader
                title="Risk Component Breakdown"
                subtitle="Calculated weight and contribution to composite exposure"
                icon={<ShieldAlert size={14} />}
              />
              <PanelBody className="space-y-4">
                {isRiskLoading || !riskData ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-10 w-full animate-pulse rounded bg-base-800" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {riskData.components.map((c) => {
                      const cColor = riskColor(c.level);
                      return (
                        <div
                          key={c.key}
                          className="glass rounded-sm p-3 space-y-2 border-l-2"
                          style={{ borderLeftColor: cColor.hex }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-200">{c.label}</span>
                              <span className="text-[10px] text-slate-500">
                                (Max {c.max_score} pts)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="num text-xs font-bold" style={{ color: cColor.hex }}>
                                {c.score.toFixed(1)} pts
                              </span>
                              <Badge
                                className="border-0 px-1.5 py-0"
                                style={{ background: `${cColor.hex}22`, color: cColor.hex }}
                              >
                                {c.level}
                              </Badge>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="h-2 w-full overflow-hidden rounded-sm bg-base-800">
                            <div
                              className="h-full rounded-sm transition-all duration-700"
                              style={{
                                width: `${Math.min(100, (c.score / c.max_score) * 100)}%`,
                                background: cColor.hex,
                              }}
                            />
                          </div>

                          <p className="text-[11px] text-slate-400 leading-snug">{c.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </PanelBody>
            </Panel>
          </section>

          {/* Node Risk Matrix & Recommendations Row */}
          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Node Risk Ranking (6 Cols) */}
            <Panel className="xl:col-span-6">
              <PanelHeader
                title="Node Risk Posture Matrix"
                subtitle="Location-level vulnerability score & warehouse fill"
                icon={<MapPin size={14} />}
              />
              <div className="divide-y divide-base-800">
                {nodes.map((node) => {
                  const c = riskColor(node.risk_level);
                  return (
                    <div key={node.id} className="p-3.5 space-y-2 hover:bg-base-850/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-200">{node.name}</span>
                          <span className="ml-2 text-[10px] text-slate-500">{node.region} · {node.node_type}</span>
                        </div>
                        <Badge
                          className="border-0 px-1.5 py-0"
                          style={{ background: `${c.hex}22`, color: c.hex }}
                        >
                          {node.risk_level} ({node.risk_score.toFixed(0)})
                        </Badge>
                      </div>

                      {/* Sidebars for Node Values */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-400">Warehouse Fill</span>
                            <span className="num font-semibold text-slate-200">{node.fill_pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
                            <div
                              className="h-full rounded-sm"
                              style={{
                                width: `${Math.min(100, node.fill_pct)}%`,
                                background: node.fill_pct < 30 ? "#e0483f" : node.fill_pct < 60 ? "#e8a33d" : "#2fbf71",
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-400">Risk Exposure</span>
                            <span className="num font-semibold" style={{ color: c.hex }}>{node.risk_score.toFixed(0)}/100</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
                            <div
                              className="h-full rounded-sm"
                              style={{
                                width: `${Math.min(100, node.risk_score)}%`,
                                background: c.hex,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* AI Risk Mitigation Recommendations (6 Cols) */}
            <Panel className="xl:col-span-6" id="recommendations">
              <PanelHeader
                title="AI Mitigation Playbook"
                subtitle="Prioritized recommendations generated by risk engine"
                icon={<Sparkles size={14} />}
              />
              <PanelBody className="space-y-3">
                <RecommendationDigest recommendations={recsData?.recommendations ?? []} />
              </PanelBody>
            </Panel>
          </section>

          {/* Weather Stations Grid */}
          <section className="mt-4">
            <Panel>
              <PanelHeader
                title="Meteorological Threat Grid"
                subtitle="Live weather feeds affecting high-altitude pass logistics"
                icon={<CloudSun size={14} />}
              />
              <div className="p-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {isWeatherLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-44 rounded-sm bg-base-800 animate-pulse" />
                  ))
                ) : (
                  weather?.records.map((w) => <WeatherCard key={w.id} record={w} />)
                )}
              </div>
            </Panel>
          </section>
        </>
      )}
    </>
  );
}
