"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { TableSkeleton, ErrorState } from "@/components/ui/states";
import { AlertRow } from "@/components/dashboard/alert-row";
import { formatPct, cn } from "@/lib/utils";
import {
  Bell,
  CheckCircle2,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Siren,
  Sparkles,
} from "lucide-react";

export default function AlertsPage() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter] = useState("ALL");

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => endpoints.alerts(),
  });

  const alerts = data?.alerts ?? [];

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      !search ||
      alert.title.toLowerCase().includes(search.toLowerCase()) ||
      alert.description.toLowerCase().includes(search.toLowerCase()) ||
      alert.alert_code.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity =
      severityFilter === "ALL" || alert.severity === severityFilter;

    const matchesStatus =
      statusFilter === "ALL" || alert.status === statusFilter;

    const matchesCategory =
      categoryFilter === "ALL" || alert.category === categoryFilter;

    return matchesSearch && matchesSeverity && matchesStatus && matchesCategory;
  });

  // Calculate stats
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;
  const highCount = alerts.filter((a) => a.severity === "HIGH").length;
  const medCount = alerts.filter((a) => a.severity === "MEDIUM").length;
  const lowCount = alerts.filter((a) => a.severity === "LOW").length;
  const newCount = alerts.filter((a) => a.status === "NEW").length;
  const resolvedCount = alerts.filter((a) => a.status === "RESOLVED").length;

  const severities = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const statuses = ["ALL", "NEW", "ACKNOWLEDGED", "RESOLVED"];

  return (
    <>
      <PageHeader
        title="Predictive Alert Dispatch"
        subtitle="Autonomous Operational Early Warnings"
        description="Machine learning-generated real-time alerts across logistics corridors, stockout boundaries, meteorological hazards, and fleet constraints."
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined}
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="flex size-8 items-center justify-center rounded-sm border border-base-700 text-slate-400 hover:border-accent-500 hover:text-accent-300"
            title="Refresh alerts"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-accent-400")} />
          </button>
        }
      />

      {/* KPI Metric Summary Row */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total & Active Alerts */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-crit-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Critical & High Alerts</span>
            <ShieldAlert className="size-4 text-crit-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-crit-400">{criticalCount + highCount}</span>
            <span className="text-[11px] text-slate-400 font-medium">of {alerts.length} Total</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-crit-500"
              style={{ width: `${Math.min(100, ((criticalCount + highCount) / (alerts.length || 1)) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">{criticalCount} Critical urgent responses</p>
        </div>

        {/* Unacknowledged New Load */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-warn-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Pending Review</span>
            <Bell className="size-4 text-warn-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-warn-400">{newCount}</span>
            <span className="text-[11px] text-slate-400 font-medium">Unacknowledged</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-warn-500"
              style={{ width: `${Math.min(100, (newCount / (alerts.length || 1)) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">Awaiting commander acknowledgement</p>
        </div>

        {/* Resolution Rate */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-ok-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Resolution Velocity</span>
            <CheckCircle2 className="size-4 text-ok-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-ok-400">{resolvedCount}</span>
            <span className="text-[11px] text-slate-400 font-medium">
              {formatPct((resolvedCount / (alerts.length || 1)) * 100, 0)} Resolved
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-ok-400"
              style={{ width: `${Math.min(100, (resolvedCount / (alerts.length || 1)) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">Remediated within SLA target</p>
        </div>

        {/* AI Confidence Quality */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-accent-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Confidence Calibration</span>
            <Sparkles className="size-4 text-accent-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-accent-300">92.4%</span>
            <span className="text-[11px] text-slate-400 font-medium">True Positive</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div className="h-full rounded-sm bg-accent-500" style={{ width: "92.4%" }} />
          </div>
          <p className="text-[10px] text-slate-500">Model false positive rate &lt; 8%</p>
        </div>
      </section>

      {/* Main Content + Side Distribution Bars */}
      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Alerts Manifest (8 Cols) */}
        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Alert Event Manifest"
              subtitle={`${filteredAlerts.length} events logged`}
              icon={<Siren size={14} />}
            />

            {/* Filter Bar */}
            <div className="border-b border-base-800/80 p-3 bg-base-950/30 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search alert title, code, or description..."
                  className="w-full rounded-sm border border-base-750 bg-base-900 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-accent-500/60 focus:outline-none"
                />
              </div>

              {/* Severity filter pills */}
              <div className="flex items-center gap-1">
                {severities.map((sev) => {
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverityFilter(sev)}
                      className={cn(
                        "rounded-xs px-2 py-1 text-[10px] font-bold uppercase transition-colors",
                        severityFilter === sev
                          ? "bg-base-700 text-slate-100 border border-slate-500"
                          : "text-slate-400 bg-base-850 hover:bg-base-800 hover:text-slate-200",
                      )}
                    >
                      {sev}
                    </button>
                  );
                })}
              </div>

              {/* Status filter pills */}
              <div className="flex items-center gap-1 border-l border-base-800 pl-2">
                {statuses.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "rounded-xs px-1.5 py-1 text-[9px] font-medium uppercase transition-colors",
                      statusFilter === st
                        ? "bg-accent-500/20 text-accent-300 border border-accent-500/40"
                        : "text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <TableSkeleton rows={8} />
            ) : isError ? (
              <ErrorState title="Failed to load alerts" onRetry={refetch} />
            ) : (
              <div className="divide-y divide-base-800">
                {filteredAlerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} showActions />
                ))}
                {!filteredAlerts.length && (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No alerts match the selected search criteria.
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>

        {/* Alerts Telemetry & Breakdown Sidebar (4 Cols) */}
        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              title="Alert Severity Values"
              subtitle="Breakdown by risk class"
              icon={<ShieldAlert size={14} />}
            />
            <PanelBody className="space-y-3.5">
              {[
                { label: "CRITICAL", count: criticalCount, hex: "#e0483f" },
                { label: "HIGH", count: highCount, hex: "#e8a33d" },
                { label: "MEDIUM", count: medCount, hex: "#e8a33d" },
                { label: "LOW", count: lowCount, hex: "#2fbf71" },
              ].map((s) => {
                const pct = alerts.length > 0 ? (s.count / alerts.length) * 100 : 0;
                return (
                  <div key={s.label} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold" style={{ color: s.hex }}>
                        {s.label}
                      </span>
                      <span className="num text-slate-300 font-medium">
                        {s.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-sm bg-base-800">
                      <div
                        className="h-full rounded-sm transition-all duration-500"
                        style={{ width: `${pct}%`, background: s.hex }}
                      />
                    </div>
                  </div>
                );
              })}
            </PanelBody>
          </Panel>

          {/* Category Distribution Sidebars */}
          <Panel>
            <PanelHeader
              title="Category Distribution"
              subtitle="Alert density across domains"
              icon={<Filter size={14} />}
            />
            <PanelBody className="space-y-3">
              {Array.from(new Set(alerts.map((a) => a.category))).map((cat) => {
                const count = alerts.filter((a) => a.category === cat).length;
                const pct = alerts.length > 0 ? (count / alerts.length) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 capitalize">{cat}</span>
                      <span className="num text-slate-400 font-medium">
                        {count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
                      <div
                        className="h-full rounded-sm bg-accent-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </PanelBody>
          </Panel>

          {/* Standard Operating Procedure Guide */}
          <div className="rounded-sm border border-base-800 bg-base-900/60 p-3.5 space-y-2">
            <span className="label-caps text-[9px] text-slate-500 block">
              Remediation Protocols
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Critical alerts require manual confirmation and dispatch reassignment within 30 minutes. Acknowledged items initiate automated corridor resupply buffer holding.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
