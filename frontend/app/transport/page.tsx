"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { TableSkeleton, ErrorState } from "@/components/ui/states";
import { StatusBadge, Badge } from "@/components/ui/badge";
import {
  formatHours,
  formatNumber,
  formatPct,
  formatCompact,
  cn,
} from "@/lib/utils";
import type { TransportAsset } from "@/types";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Gauge,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Truck,
  Wrench,
} from "lucide-react";

export default function TransportPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedAsset, setSelectedAsset] = useState<TransportAsset | null>(null);

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["transport"],
    queryFn: () => endpoints.transport(),
  });

  const assets = data?.assets ?? [];

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      !search ||
      asset.asset_id.toLowerCase().includes(search.toLowerCase()) ||
      asset.name.toLowerCase().includes(search.toLowerCase()) ||
      (asset.current_assignment &&
        asset.current_assignment.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" || asset.status === statusFilter;

    const matchesType =
      typeFilter === "ALL" || asset.asset_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const activeAsset = selectedAsset ?? filteredAssets[0] ?? null;

  const assetTypes = ["ALL", ...Array.from(new Set(assets.map((a) => a.asset_type)))];
  const statuses = ["ALL", "AVAILABLE", "IN_TRANSIT", "MAINTENANCE"];

  return (
    <>
      <PageHeader
        title="Transport Fleet"
        subtitle="Logistics Asset Management & Deployment"
        description="Heavy-lift, medium cargo, and tactical all-terrain transport units with real-time assignment tracking, payload capacity, and corridor utilization."
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined}
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="flex size-8 items-center justify-center rounded-sm border border-base-700 text-slate-400 hover:border-accent-500 hover:text-accent-300"
            title="Refresh fleet telemetry"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-accent-400")} />
          </button>
        }
      />

      {/* KPI Metric Summary Row */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Assets & Availability */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-accent-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Total Fleet Assets</span>
            <Truck className="size-4 text-accent-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-slate-100">{data?.total ?? assets.length}</span>
            <span className="text-[11px] text-ok-400 font-semibold">{data?.available_count ?? 0} Available</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-accent-500"
              style={{ width: `${data?.availability_pct ?? 70}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">
            {formatPct(data?.availability_pct ?? 0, 0)} fleet readiness rate
          </p>
        </div>

        {/* Active In-Transit */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-warn-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Active In-Transit</span>
            <Navigation className="size-4 text-warn-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-warn-400">{data?.in_transit_count ?? 0}</span>
            <span className="text-[11px] text-slate-400 font-medium">Under Dispatch</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-warn-500"
              style={{ width: `${((data?.in_transit_count ?? 0) / (data?.total || 1)) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">Executing corridor resupply</p>
        </div>

        {/* Maintenance Bay */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-crit-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Maintenance Bay</span>
            <Wrench className="size-4 text-crit-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-crit-400">{data?.maintenance_count ?? 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">Off-line</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-crit-500"
              style={{ width: `${((data?.maintenance_count ?? 0) / (data?.total || 1)) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">Scheduled maintenance / overhaul</p>
        </div>

        {/* Fleet Payload Capacity */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-ok-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Total Lift Capacity</span>
            <Gauge className="size-4 text-ok-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-ok-400">
              {formatCompact(data?.total_capacity_kg ?? 0)}
              <span className="text-xs font-normal text-slate-500"> kg</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {formatPct(data?.utilization_pct ?? 0, 0)} Utilized
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-ok-400"
              style={{ width: `${Math.min(100, data?.utilization_pct ?? 0)}%` }}
            />
            <span className="absolute top-0 h-full w-px bg-slate-400/80" style={{ left: "75%" }} />
          </div>
          <p className="text-[10px] text-slate-500">
            {formatCompact(data?.available_capacity_kg ?? 0)} kg available headroom
          </p>
        </div>
      </section>

      {/* Fleet Table + Asset Inspector Sidebar */}
      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Fleet List (8 Cols) */}
        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Fleet Roster & Assignments"
              subtitle={`${filteredAssets.length} transport assets registered`}
              icon={<Truck size={14} />}
            />

            {/* Filter Bar */}
            <div className="border-b border-base-800/80 p-3 bg-base-950/30 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search asset ID, name, or route..."
                  className="w-full rounded-sm border border-base-750 bg-base-900 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-accent-500/60 focus:outline-none"
                />
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1">
                {statuses.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "rounded-xs px-2 py-1 text-[10px] font-bold uppercase transition-colors",
                      statusFilter === st
                        ? "bg-accent-500/20 text-accent-300 border border-accent-500/40"
                        : "text-slate-400 bg-base-850 hover:bg-base-800 hover:text-slate-200",
                    )}
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              {/* Type pills */}
              <div className="flex items-center gap-1 border-l border-base-800 pl-2">
                {assetTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      "rounded-xs px-2 py-1 text-[10px] font-medium transition-colors",
                      typeFilter === type
                        ? "bg-base-700 text-slate-100"
                        : "text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <TableSkeleton rows={8} />
            ) : isError ? (
              <ErrorState title="Failed to load transport data" onRetry={refetch} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-base-700/80 text-[10px] text-slate-500 uppercase tracking-wider bg-base-950/20">
                      <th className="px-3.5 py-2.5">Asset ID & Model</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5">Payload Capacity</th>
                      <th className="px-3.5 py-2.5">Corridor Assignment</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5">Utilization Bar</th>
                      <th className="px-2 py-2.5 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-800">
                    {filteredAssets.map((asset) => {
                      const isSelected = activeAsset?.id === asset.id;
                      return (
                        <tr
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-base-850/80",
                            isSelected && "bg-accent-500/10 border-l-2 border-l-accent-400",
                          )}
                        >
                          <td className="px-3.5 py-3">
                            <span className="block font-semibold text-slate-100">
                              {asset.asset_id}
                            </span>
                            <span className="block text-[10px] text-slate-500">{asset.name}</span>
                          </td>
                          <td className="px-3.5 py-3 text-slate-300">{asset.asset_type}</td>
                          <td className="num px-3.5 py-3 font-medium text-slate-200">
                            {formatNumber(asset.capacity_kg)} kg
                          </td>
                          <td className="px-3.5 py-3">
                            {asset.current_assignment ? (
                              <div className="flex items-center gap-1.5 text-slate-300">
                                <span className="font-medium">{asset.current_assignment}</span>
                                {asset.eta_hours ? (
                                  <span className="text-[10px] text-accent-400">
                                    (ETA {formatHours(asset.eta_hours)})
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Standby in Depot</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3">
                            <StatusBadge status={asset.status} />
                          </td>
                          <td className="px-3.5 py-3 min-w-[120px]">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Load</span>
                                <span className="num font-semibold text-slate-200">
                                  {formatPct(asset.utilization_pct, 0)}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
                                <div
                                  className="h-full rounded-sm transition-all"
                                  style={{
                                    width: `${Math.min(100, asset.utilization_pct)}%`,
                                    background:
                                      asset.utilization_pct > 85
                                        ? "#e0483f"
                                        : asset.utilization_pct > 50
                                          ? "#22b8d6"
                                          : "#2fbf71",
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center text-slate-500">
                            <ChevronRight
                              className={cn(
                                "size-3.5 transition-transform",
                                isSelected && "text-accent-400 translate-x-0.5",
                              )}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Asset Value Inspector Sidebar (4 Cols) */}
        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              title="Asset Value Inspector"
              subtitle={activeAsset ? `${activeAsset.asset_id} · ${activeAsset.name}` : "Select an asset"}
              icon={<Truck size={14} />}
            />
            {activeAsset ? (
              <PanelBody className="space-y-4">
                {/* Asset Identity Card */}
                <div className="glass rounded-sm p-3.5 space-y-2 border-l-2 border-accent-500">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{activeAsset.name}</span>
                    <StatusBadge status={activeAsset.status} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="num text-2xl font-bold text-accent-300 font-mono">
                      {activeAsset.asset_id}
                    </span>
                    <span className="text-xs text-slate-400">{activeAsset.asset_type}</span>
                  </div>

                  {/* Utilization Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Current Payload Utilization</span>
                      <span className="num font-semibold text-slate-200">
                        {formatPct(activeAsset.utilization_pct, 1)}
                      </span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-sm bg-base-800">
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{
                          width: `${Math.min(100, activeAsset.utilization_pct)}%`,
                          background:
                            activeAsset.utilization_pct > 85
                              ? "#e0483f"
                              : activeAsset.utilization_pct > 50
                                ? "#22b8d6"
                                : "#2fbf71",
                        }}
                      />
                      <span className="absolute top-0 h-full w-px bg-slate-400/80" style={{ left: "80%" }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>0 kg</span>
                      <span>Target &lt; 85%</span>
                      <span>Max: {formatNumber(activeAsset.capacity_kg)} kg</span>
                    </div>
                  </div>
                </div>

                {/* Dispatch & Route Corridor Details */}
                <div className="rounded-sm bg-base-850 p-3 space-y-2 border border-base-750">
                  <span className="label-caps text-[9px] text-slate-500 block">Mission Assignment</span>
                  {activeAsset.current_assignment ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                        <MapPin className="size-3.5 text-accent-400" />
                        <span>{activeAsset.origin || "Origin Hub"}</span>
                        <ArrowRight className="size-3 text-slate-500" />
                        <span>{activeAsset.destination || "Forward Node"}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-base-750">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-slate-500" />
                          Estimated Time of Arrival:
                        </span>
                        <span className="num font-semibold text-accent-300">
                          {activeAsset.eta_hours ? formatHours(activeAsset.eta_hours) : "--"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Unit currently idle at central depot in ready reserve.</p>
                  )}
                </div>

                {/* Telemetry Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="glass rounded-sm p-2.5">
                    <span className="label-caps text-[9px] text-slate-500 block">Maximum Payload</span>
                    <span className="num mt-1 block font-semibold text-slate-200">
                      {formatNumber(activeAsset.capacity_kg)} kg
                    </span>
                  </div>
                  <div className="glass rounded-sm p-2.5">
                    <span className="label-caps text-[9px] text-slate-500 block">Asset Availability</span>
                    <span className="num mt-1 block font-semibold text-ok-400">
                      {formatPct(activeAsset.availability_pct, 0)} score
                    </span>
                  </div>
                  <div className="glass rounded-sm p-2.5 col-span-2">
                    <span className="label-caps text-[9px] text-slate-500 block">Maintenance Status</span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-slate-300">
                        {activeAsset.last_maintenance ? `Last service: ${activeAsset.last_maintenance}` : "Inspection nominal"}
                      </span>
                      <Badge tone={activeAsset.status === "MAINTENANCE" ? "crit" : "ok"}>
                        {activeAsset.status === "MAINTENANCE" ? "Service Required" : "Certified"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </PanelBody>
            ) : (
              <PanelBody>
                <p className="text-center text-xs text-slate-500 py-12">Select a transport asset to inspect telemetry.</p>
              </PanelBody>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}
