"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  formatCompact,
  formatPct,
  riskColor,
  CATEGORY_COLORS,
  cn,
} from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

type TabKey = "telemetry" | "categories" | "nodes" | "alerts";

export function DataSidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("telemetry");
  const [filterText, setFilterText] = useState("");
  const [localCollapsed, setLocalCollapsed] = useState(false);

  const isCollapsed = collapsed !== undefined ? collapsed : localCollapsed;
  const toggleCollapse = onToggleCollapse ?? (() => setLocalCollapsed((v) => !v));

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: endpoints.dashboard,
    refetchInterval: 30_000,
  });

  if (isCollapsed) {
    return (
      <aside className="hidden lg:flex flex-col items-center justify-between w-12 shrink-0 border-l border-base-800 bg-base-900/90 py-3 backdrop-blur-xl transition-all duration-200">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex size-8 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-base-800 hover:text-accent-300"
            title="Expand Operations Telemetry Sidebar"
            aria-label="Expand Telemetry Sidebar"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="h-px w-6 bg-base-800" />
          <Tooltip content="Health Posture">
            <div className="flex flex-col items-center">
              <span className="size-2 rounded-full bg-ok-400 animate-pulse" />
              <span className="mt-2 text-[9px] font-mono text-slate-500 [writing-mode:vertical-rl]">
                {data ? `${data.health_score}%` : "HEALTH"}
              </span>
            </div>
          </Tooltip>
          <Tooltip content="Network Risk">
            <div className="mt-3 flex flex-col items-center">
              <ShieldAlert className="size-3.5 text-warn-500" />
              <span className="mt-1 text-[9px] font-mono text-slate-500 [writing-mode:vertical-rl]">
                {data ? `RISK ${data.risk_total}` : "RISK"}
              </span>
            </div>
          </Tooltip>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Tooltip content="Active Alerts">
            <div className="relative">
              <span className="flex size-6 items-center justify-center rounded-sm bg-crit-500/20 text-[10px] font-bold text-crit-400">
                {data?.active_alert_count ?? 0}
              </span>
            </div>
          </Tooltip>
        </div>
      </aside>
    );
  }

  const healthColor =
    data?.health_label === "STABLE"
      ? "#2fbf71"
      : data?.health_label === "WATCH"
        ? "#e8a33d"
        : "#e0483f";

  const riskC = riskColor(data?.risk_level);

  return (
    <aside className="hidden lg:flex w-84 xl:w-92 shrink-0 flex-col border-l border-base-800 bg-base-900/95 backdrop-blur-xl shadow-2xl transition-all duration-200">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-base-800 px-4">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-accent-500" />
          </span>
          <span className="label-caps font-bold tracking-wider text-slate-200">
            System Telemetry
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => refetch()}
            className="flex size-7 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-base-800 hover:text-slate-200"
            title="Refresh values"
            aria-label="Refresh telemetry"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-accent-400")} />
          </button>
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex size-7 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-base-800 hover:text-slate-200"
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 border-b border-base-800 bg-base-950/40 p-1 text-[11px]">
        {[
          { id: "telemetry" as const, label: "Metrics", icon: Activity, badge: undefined },
          { id: "categories" as const, label: "Supply", icon: Boxes, badge: undefined },
          { id: "nodes" as const, label: "Nodes", icon: MapPin, badge: undefined },
          { id: "alerts" as const, label: "Alerts", icon: ShieldAlert, badge: data?.active_alert_count },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-xs py-2 font-medium transition-colors",
                active
                  ? "bg-base-800/90 text-accent-300 shadow-sm"
                  : "text-slate-400 hover:bg-base-800/40 hover:text-slate-200",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span className="size-4 rounded-full bg-crit-500/20 text-[9px] font-bold leading-4 text-crit-400">
                  {tab.badge}
                </span>
              ) : null}
              {active ? (
                <span className="absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-accent-400" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Search filter for nodes / categories / alerts */}
      {activeTab !== "telemetry" && (
        <div className="border-b border-base-800/70 p-2.5 bg-base-950/20">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-slate-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={`Filter ${activeTab}...`}
              className="w-full rounded-sm border border-base-750 bg-base-900 py-1.5 pl-8 pr-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-accent-500/60 focus:outline-none"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="absolute right-2 text-[10px] text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isLoading && !data ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass p-3 rounded-sm animate-pulse space-y-2">
                <div className="h-2 w-24 bg-base-750 rounded" />
                <div className="h-4 w-full bg-base-750 rounded" />
                <div className="h-2 w-16 bg-base-750 rounded" />
              </div>
            ))}
          </div>
        ) : isError || !data ? (
          <div className="rounded-sm border border-crit-500/30 bg-crit-950/20 p-4 text-center">
            <AlertTriangle className="mx-auto size-6 text-crit-400" />
            <p className="mt-2 text-xs font-medium text-crit-300">Telemetry Offline</p>
            <p className="mt-1 text-[10px] text-slate-400">Cannot connect to backend telemetry service.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-base-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-base-750"
            >
              <RefreshCw className="size-3" /> Retry Sync
            </button>
          </div>
        ) : (
          <>
            {/* ----------------- TAB 1: ALL TELEMETRY & METRIC BARS ----------------- */}
            {activeTab === "telemetry" && (
              <div className="space-y-4">
                {/* System Health Score Bar */}
                <div className="glass rounded-sm p-3.5 space-y-2.5 border-l-2" style={{ borderLeftColor: healthColor }}>
                  <div className="flex items-center justify-between">
                    <span className="label-caps text-slate-400 flex items-center gap-1.5">
                      <Activity className="size-3.5 text-accent-400" />
                      Health Posture
                    </span>
                    <Badge tone={data.health_label === "STABLE" ? "ok" : data.health_label === "WATCH" ? "warn" : "crit"}>
                      {data.health_label}
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="num text-2xl font-bold tracking-tight" style={{ color: healthColor }}>
                      {data.health_score}
                      <span className="text-xs font-normal text-slate-500"> / 100</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Target &gt; 80</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-sm bg-base-800">
                    <div
                      className="h-full rounded-sm transition-all duration-700"
                      style={{
                        width: `${Math.min(100, data.health_score)}%`,
                        background: `linear-gradient(90deg, #22b8d6 0%, ${healthColor} 100%)`,
                      }}
                    />
                    <span className="absolute top-0 h-full w-px bg-slate-400/80" style={{ left: "80%" }} />
                  </div>
                </div>

                {/* Composite Risk Score Bar */}
                <div className="glass rounded-sm p-3.5 space-y-2.5 border-l-2" style={{ borderLeftColor: riskC.hex }}>
                  <div className="flex items-center justify-between">
                    <span className="label-caps text-slate-400 flex items-center gap-1.5">
                      <ShieldAlert className="size-3.5" style={{ color: riskC.hex }} />
                      Network Risk Level
                    </span>
                    <Badge className="border-0 px-1.5 py-0" style={{ background: `${riskC.hex}22`, color: riskC.hex }}>
                      {data.risk_level}
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="num text-2xl font-bold tracking-tight" style={{ color: riskC.hex }}>
                      {data.risk_total}
                      <span className="text-xs font-normal text-slate-500"> / 100</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Safe &lt; 35</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-sm bg-base-800">
                    <div
                      className="h-full rounded-sm transition-all duration-700"
                      style={{
                        width: `${Math.min(100, data.risk_total)}%`,
                        background: riskC.hex,
                      }}
                    />
                    <span className="absolute top-0 h-full w-px bg-slate-400/80" style={{ left: "35%" }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Low (0-25)</span>
                    <span>Med (26-50)</span>
                    <span>High (51-75)</span>
                    <span>Crit (76+)</span>
                  </div>
                </div>

                {/* KPI Metrics Sidebars List */}
                <div className="space-y-2.5">
                  <span className="label-caps text-[9px] text-slate-500">Core Telemetry Metrics</span>
                  {data.kpis.map((kpi) => {
                    const c = riskColor(kpi.status);
                    const isPercentage = kpi.unit === "%" || kpi.value.includes("%");
                    const barValue = isPercentage
                      ? Math.min(100, Math.max(0, kpi.raw_value))
                      : Math.min(100, Math.max(10, (kpi.raw_value / 250000) * 100));

                    return (
                      <Link
                        key={kpi.key}
                        href={kpi.href}
                        className="group block rounded-sm border border-base-800/80 bg-base-850/50 p-2.5 transition-colors hover:border-accent-500/40 hover:bg-base-800/60"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-300 group-hover:text-slate-100">
                            {kpi.label}
                          </span>
                          <span className="num font-semibold" style={{ color: c.hex }}>
                            {kpi.value}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
                          <div
                            className="h-full rounded-sm transition-all duration-500"
                            style={{
                              width: `${barValue}%`,
                              background: c.hex,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500">
                          <span className="truncate">{kpi.delta_label}</span>
                          <span className="group-hover:text-accent-400 transition-colors">Inspect →</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Forecast Model Telemetry */}
                <div className="glass rounded-sm p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="label-caps text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="size-3 text-accent-400" />
                      AI Model Confidence
                    </span>
                    <span className="num text-xs font-semibold text-ok-400">
                      {formatPct(data.forecast_accuracy.accuracy_pct ?? 0, 1)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
                    <div
                      className="h-full rounded-sm bg-ok-400"
                      style={{ width: `${Math.min(100, data.forecast_accuracy.accuracy_pct ?? 0)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>RandomForest Regressor</span>
                    <span>MAPE {formatPct(data.forecast_accuracy.mape ?? 0, 1)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- TAB 2: SUPPLY CATEGORIES ----------------- */}
            {activeTab === "categories" && (
              <div className="space-y-3">
                <span className="label-caps text-[9px] text-slate-500">Supply Category Posture</span>
                {data.inventory_fill_by_category
                  .filter((cat) =>
                    filterText
                      ? String(cat.category).toLowerCase().includes(filterText.toLowerCase())
                      : true,
                  )
                  .map((cat) => {
                    const fillPct = Number(cat.fill_pct || 0);
                    const categoryName = String(cat.category);
                    const color = CATEGORY_COLORS[categoryName] || "#22b8d6";
                    const status =
                      fillPct < 30 ? "CRITICAL" : fillPct < 60 ? "WARNING" : "HEALTHY";

                    return (
                      <div key={categoryName} className="glass rounded-sm p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ background: color }}
                            />
                            <span className="text-xs font-medium text-slate-200">
                              {categoryName}
                            </span>
                          </div>
                          <StatusBadge status={status} />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Stock Capacity Fill</span>
                            <span className="num font-semibold text-slate-200">
                              {fillPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="relative h-2 w-full overflow-hidden rounded-sm bg-base-800">
                            <div
                              className="h-full rounded-sm transition-all duration-500"
                              style={{
                                width: `${Math.min(100, fillPct)}%`,
                                background: color,
                              }}
                            />
                            <span
                              className="absolute top-0 h-full w-px bg-slate-400/80"
                              style={{ left: "50%" }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-base-800/80 text-[10px]">
                          <div>
                            <span className="text-slate-500 block">Current Total</span>
                            <span className="num font-medium text-slate-300">
                              {formatCompact(Number(cat.current_stock))} {String(cat.unit || "")}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Total Capacity</span>
                            <span className="num font-medium text-slate-300">
                              {formatCompact(Number(cat.capacity))} {String(cat.unit || "")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ----------------- TAB 3: NODES / LOCATIONS ----------------- */}
            {activeTab === "nodes" && (
              <div className="space-y-3">
                <span className="label-caps text-[9px] text-slate-500">Logistics Node Telemetry</span>
                {data.nodes
                  .filter((node) =>
                    filterText
                      ? node.name.toLowerCase().includes(filterText.toLowerCase()) ||
                        node.region.toLowerCase().includes(filterText.toLowerCase())
                      : true,
                  )
                  .map((node) => {
                    const c = riskColor(node.risk_level);
                    return (
                      <div key={node.id} className="glass rounded-sm p-3 space-y-2.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="text-xs font-semibold text-slate-200">{node.name}</h5>
                            <span className="text-[10px] text-slate-500">{node.region} · {node.node_type}</span>
                          </div>
                          <Badge
                            className="border-0 px-1.5 py-0"
                            style={{ background: `${c.hex}22`, color: c.hex }}
                          >
                            {node.risk_level}
                          </Badge>
                        </div>

                        {/* Fill Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Warehouse Fill</span>
                            <span className="num font-semibold text-slate-200">
                              {node.fill_pct.toFixed(0)}%
                            </span>
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

                        {/* Key Values Grid */}
                        <div className="grid grid-cols-3 gap-1.5 rounded-sm bg-base-850/60 p-2 text-center text-[10px]">
                          <div>
                            <span className="text-slate-500 block">7d Demand</span>
                            <span className="num font-semibold text-slate-200">
                              {formatCompact(node.predicted_demand_7d)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Fleet Avail</span>
                            <span className="num font-semibold text-accent-400">
                              {node.transport_availability.toFixed(0)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Delivery ETA</span>
                            <span className="num font-semibold text-slate-200">
                              {node.estimated_delivery_hours ? `${node.estimated_delivery_hours.toFixed(1)}h` : "--"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ----------------- TAB 4: ACTIVE ALERTS ----------------- */}
            {activeTab === "alerts" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="label-caps text-[9px] text-slate-500">Live Prediction Alerts</span>
                  <Link href="/alerts" className="text-[10px] text-accent-400 hover:text-accent-300">
                    Manage all →
                  </Link>
                </div>
                {data.top_alerts
                  .filter((a) =>
                    filterText
                      ? a.title.toLowerCase().includes(filterText.toLowerCase()) ||
                        a.category.toLowerCase().includes(filterText.toLowerCase())
                      : true,
                  )
                  .map((alert) => {
                    const c = riskColor(alert.severity);
                    return (
                      <div
                        key={alert.id}
                        className="glass rounded-sm p-3 space-y-2 border-l-2"
                        style={{ borderLeftColor: c.hex }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: c.hex }}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">{alert.alert_code}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-200 leading-snug">{alert.title}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{alert.description}</p>
                        <div className="rounded-sm bg-base-850/80 p-2 text-[10px] text-accent-300">
                          <span className="font-semibold text-slate-400 block">Action:</span>
                          {alert.recommended_action}
                        </div>
                      </div>
                    );
                  })}
                {!data.top_alerts.length && (
                  <p className="py-8 text-center text-xs text-slate-500">No active alerts detected.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="border-t border-base-800 bg-base-950/60 p-3 text-[10px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Radio className="size-3 text-ok-400 animate-pulse" />
          Live Telemetry Stream
        </span>
        <span className="num font-mono">5 nodes active</span>
      </div>
    </aside>
  );
}
