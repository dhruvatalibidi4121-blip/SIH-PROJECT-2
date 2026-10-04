"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { TableSkeleton, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/badge";
import {
  formatCompact,
  formatNumber,
  formatPct,
  CATEGORY_COLORS,
  cn,
} from "@/lib/utils";
import type { InventoryItem } from "@/types";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  Clock,
  Layers,
  PackageCheck,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => endpoints.inventory(),
  });

  const { data: itemDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["inventory-detail", selectedItem?.id],
    queryFn: () => (selectedItem ? endpoints.inventoryItem(selectedItem.id) : null),
    enabled: !!selectedItem,
  });

  const items = data?.items ?? [];

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.item_code.toLowerCase().includes(search.toLowerCase()) ||
      item.location_name.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "ALL" || item.category === selectedCategory;

    const matchesStatus =
      selectedStatus === "ALL" || item.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Automatically select the first critical or first item if none selected
  const activeItem = selectedItem ?? filteredItems[0] ?? null;

  // KPI Calculations
  const totalStock = items.reduce((acc, i) => acc + i.current_stock, 0);
  const totalCapacity = items.reduce((acc, i) => acc + i.capacity, 0);
  const overallFill = totalCapacity > 0 ? (totalStock / totalCapacity) * 100 : 0;
  const criticalCount = items.filter((i) => i.status === "CRITICAL").length;
  const warningCount = items.filter((i) => i.status === "WARNING").length;
  const avgDaysRemaining =
    items.length > 0
      ? items.reduce((acc, i) => acc + i.days_remaining, 0) / items.length
      : 0;

  const categories = ["ALL", "Fuel", "Food", "Water", "Medical Supplies", "Spare Parts"];
  const statuses = ["ALL", "HEALTHY", "WARNING", "CRITICAL"];

  return (
    <>
      <PageHeader
        title="Inventory Intelligence"
        subtitle="Network Stock & Capacity Posture"
        description="Real-time multi-echelon stock levels, consumption burn rates, and predictive shortage thresholds across all sector nodes."
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="flex size-8 items-center justify-center rounded-sm border border-base-700 text-slate-400 hover:border-accent-500 hover:text-accent-300"
              title="Refresh inventory"
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-accent-400")} />
            </button>
          </div>
        }
      />

      {/* KPI Metric Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Stock Units */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-accent-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Total Network Items</span>
            <Boxes className="size-4 text-accent-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-slate-100">{items.length}</span>
            <span className="text-[11px] text-slate-400 font-medium">SKUs Monitored</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div className="h-full rounded-sm bg-accent-500" style={{ width: "100%" }} />
          </div>
          <p className="text-[10px] text-slate-500">Across 5 northern command hubs</p>
        </div>

        {/* Aggregate Fill Rate */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-ok-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Aggregate Fill Rate</span>
            <PackageCheck className="size-4 text-ok-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-ok-400">{overallFill.toFixed(1)}%</span>
            <span className="text-[11px] text-slate-400 font-medium">Target 80%</span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-ok-400 transition-all duration-500"
              style={{ width: `${Math.min(100, overallFill)}%` }}
            />
            <span className="absolute top-0 h-full w-px bg-slate-400/80" style={{ left: "80%" }} />
          </div>
          <p className="text-[10px] text-slate-500">
            {formatCompact(totalStock)} / {formatCompact(totalCapacity)} capacity
          </p>
        </div>

        {/* Critical Deficits */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-crit-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Critical Stockouts</span>
            <AlertTriangle className="size-4 text-crit-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-crit-400">{criticalCount}</span>
            <span className="text-[11px] text-warn-400 font-medium">{warningCount} Watchlist</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-crit-500"
              style={{ width: `${Math.min(100, ((criticalCount + warningCount) / (items.length || 1)) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">Below safety reorder point</p>
        </div>

        {/* Average Coverage Days */}
        <div className="glass rounded-sm p-4 space-y-2 border-l-2 border-warn-500">
          <div className="flex items-center justify-between">
            <span className="label-caps text-slate-400">Mean Network Cover</span>
            <Clock className="size-4 text-warn-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold text-warn-400">
              {avgDaysRemaining.toFixed(1)}
              <span className="text-xs font-normal text-slate-500"> days</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Safe &gt; 14d</span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
            <div
              className="h-full rounded-sm bg-warn-500"
              style={{ width: `${Math.min(100, (avgDaysRemaining / 30) * 100)}%` }}
            />
            <span className="absolute top-0 h-full w-px bg-slate-400/80" style={{ left: "46%" }} />
          </div>
          <p className="text-[10px] text-slate-500">Based on dynamic consumption burn</p>
        </div>
      </section>

      {/* Main Content: Table + Side Inspector Bar */}
      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Inventory Table (8 Cols) */}
        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Stock Manifest"
              subtitle={`${filteredItems.length} items matched filter`}
              icon={<Boxes size={14} />}
            />

            {/* Filter controls */}
            <div className="border-b border-base-800/80 p-3 bg-base-950/30 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item, SKU, or node..."
                  className="w-full rounded-sm border border-base-750 bg-base-900 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-accent-500/60 focus:outline-none"
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "rounded-xs px-2 py-1 text-[10px] font-medium transition-colors",
                      selectedCategory === cat
                        ? "bg-accent-500/20 text-accent-300 border border-accent-500/40"
                        : "text-slate-400 bg-base-850 hover:bg-base-800 hover:text-slate-200",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-1 border-l border-base-800 pl-2">
                {statuses.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStatus(st)}
                    className={cn(
                      "rounded-xs px-1.5 py-1 text-[9px] font-bold uppercase transition-colors",
                      selectedStatus === st
                        ? "bg-base-700 text-slate-100"
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
              <ErrorState title="Failed to load inventory" onRetry={refetch} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-base-700/80 text-[10px] text-slate-500 uppercase tracking-wider bg-base-950/20">
                      <th className="px-3.5 py-2.5">Item & Code</th>
                      <th className="px-3.5 py-2.5">Location</th>
                      <th className="px-3.5 py-2.5">Stock Capacity Bar</th>
                      <th className="px-3.5 py-2.5 text-right">Daily Burn</th>
                      <th className="px-3.5 py-2.5 text-right">Coverage</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-2 py-2.5 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-800">
                    {filteredItems.map((item) => {
                      const isSelected = activeItem?.id === item.id;
                      const fillPct = (item.current_stock / (item.capacity || 1)) * 100;
                      const safetyPct = (item.safety_threshold / (item.capacity || 1)) * 100;
                      const catColor = CATEGORY_COLORS[item.category] || "#22b8d6";

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-base-850/80",
                            isSelected && "bg-accent-500/10 border-l-2 border-l-accent-400",
                          )}
                        >
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ background: catColor }}
                              />
                              <div>
                                <span className="block font-medium text-slate-200">
                                  {item.name}
                                </span>
                                <span className="block font-mono text-[9px] text-slate-500">
                                  {item.item_code} · {item.category}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-slate-400">
                            <span className="block text-slate-300">{item.location_name}</span>
                            <span className="block text-[9px] text-slate-600">{item.location_id}</span>
                          </td>
                          <td className="px-3.5 py-3 min-w-[140px]">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="num font-semibold text-slate-200">
                                  {formatNumber(item.current_stock)} {item.unit}
                                </span>
                                <span className="num text-slate-500">
                                  {fillPct.toFixed(0)}% of {formatCompact(item.capacity)}
                                </span>
                              </div>
                              <div className="relative h-1.5 w-full overflow-hidden rounded-sm bg-base-800">
                                <div
                                  className="h-full rounded-sm transition-all"
                                  style={{
                                    width: `${Math.min(100, fillPct)}%`,
                                    background:
                                      item.status === "CRITICAL"
                                        ? "#e0483f"
                                        : item.status === "WARNING"
                                          ? "#e8a33d"
                                          : "#2fbf71",
                                  }}
                                />
                                {/* Safety threshold marker */}
                                <span
                                  className="absolute top-0 h-full w-0.5 bg-slate-400/80"
                                  style={{ left: `${Math.min(100, safetyPct)}%` }}
                                  title={`Safety threshold: ${item.safety_threshold}`}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="num px-3.5 py-3 text-right text-slate-300">
                            {formatNumber(item.daily_consumption, 1)} {item.unit}/d
                          </td>
                          <td className="num px-3.5 py-3 text-right font-medium">
                            <span
                              className={cn(
                                item.days_remaining <= 5
                                  ? "text-crit-400 font-bold"
                                  : item.days_remaining <= 12
                                    ? "text-warn-400 font-semibold"
                                    : "text-slate-300",
                              )}
                            >
                              {item.days_remaining} d
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-2 py-3 text-center text-slate-500">
                            <ChevronRight className={cn("size-3.5 transition-transform", isSelected && "text-accent-400 translate-x-0.5")} />
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

        {/* Item Value Inspector Sidebar (4 Cols) */}
        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              title="Item Value Inspector"
              subtitle={activeItem ? `${activeItem.name} (${activeItem.item_code})` : "Select an item"}
              icon={<Layers size={14} />}
            />
            {activeItem ? (
              <PanelBody className="space-y-4">
                {/* Stock Gauge & Status Header */}
                <div
                  className="rounded-sm border p-3 space-y-2"
                  style={{
                    borderColor:
                      activeItem.status === "CRITICAL"
                        ? "#e0483f55"
                        : activeItem.status === "WARNING"
                          ? "#e8a33d55"
                          : "#2fbf7155",
                    background:
                      activeItem.status === "CRITICAL"
                        ? "#e0483f12"
                        : activeItem.status === "WARNING"
                          ? "#e8a33d12"
                          : "#2fbf7112",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{activeItem.location_name}</span>
                    <StatusBadge status={activeItem.status} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="num text-2xl font-bold text-slate-100">
                        {formatNumber(activeItem.current_stock)}
                      </span>
                      <span className="ml-1 text-xs text-slate-400">{activeItem.unit}</span>
                    </div>
                    <span className="num text-sm font-semibold text-slate-300">
                      {((activeItem.current_stock / activeItem.capacity) * 100).toFixed(1)}% full
                    </span>
                  </div>

                  {/* Stock level bar vs Safety threshold */}
                  <div className="space-y-1">
                    <div className="relative h-2 w-full overflow-hidden rounded-sm bg-base-800">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${Math.min(100, (activeItem.current_stock / activeItem.capacity) * 100)}%`,
                          background:
                            activeItem.status === "CRITICAL"
                              ? "#e0483f"
                              : activeItem.status === "WARNING"
                                ? "#e8a33d"
                                : "#2fbf71",
                        }}
                      />
                      <span
                        className="absolute top-0 h-full w-1 bg-yellow-400"
                        style={{
                          left: `${Math.min(100, (activeItem.safety_threshold / activeItem.capacity) * 100)}%`,
                        }}
                        title="Safety Threshold Reorder Line"
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>0</span>
                      <span className="text-yellow-400">Threshold: {formatCompact(activeItem.safety_threshold)}</span>
                      <span>Max: {formatCompact(activeItem.capacity)}</span>
                    </div>
                  </div>
                </div>

                {/* Core Parameters Grid */}
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div className="glass rounded-sm p-2.5">
                    <span className="label-caps text-[9px] text-slate-500 block">Daily Consumption</span>
                    <span className="num mt-1 block font-semibold text-slate-200">
                      {formatNumber(activeItem.daily_consumption, 1)} {activeItem.unit}/day
                    </span>
                  </div>
                  <div className="glass rounded-sm p-2.5">
                    <span className="label-caps text-[9px] text-slate-500 block">Days to Stockout</span>
                    <span
                      className={cn(
                        "num mt-1 block font-semibold",
                        activeItem.days_remaining <= 5
                          ? "text-crit-400"
                          : activeItem.days_remaining <= 12
                            ? "text-warn-400"
                            : "text-ok-400",
                      )}
                    >
                      {activeItem.days_remaining} days remaining
                    </span>
                  </div>
                  <div className="glass rounded-sm p-2.5">
                    <span className="label-caps text-[9px] text-slate-500 block">Reorder Point</span>
                    <span className="num mt-1 block font-semibold text-slate-200">
                      {activeItem.reorder_point_days} days lead
                    </span>
                  </div>
                  <div className="glass rounded-sm p-2.5">
                    <span className="label-caps text-[9px] text-slate-500 block">Safety Level</span>
                    <span className="num mt-1 block font-semibold text-slate-200">
                      {formatNumber(activeItem.safety_threshold)} {activeItem.unit}
                    </span>
                  </div>
                </div>

                {/* Predictive Demand & Restock Value Bars (From Detail API) */}
                {isDetailLoading ? (
                  <div className="space-y-2 animate-pulse pt-2 border-t border-base-800">
                    <div className="h-3 w-32 bg-base-800 rounded" />
                    <div className="h-10 w-full bg-base-800 rounded" />
                  </div>
                ) : itemDetail ? (
                  <div className="space-y-3 pt-2 border-t border-base-800">
                    <div className="flex items-center justify-between">
                      <span className="label-caps text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="size-3 text-accent-400" />
                        AI Demand Forecast Horizon
                      </span>
                      <span className="num text-[10px] text-accent-400 font-semibold">
                        {formatPct(itemDetail.confidence * 100, 0)} Conf
                      </span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { label: "3-Day Demand", val: itemDetail.predicted_demand_3d },
                        { label: "7-Day Demand", val: itemDetail.predicted_demand_7d },
                        { label: "14-Day Demand", val: itemDetail.predicted_demand_14d },
                        { label: "30-Day Demand", val: itemDetail.predicted_demand_30d },
                      ].map((h) => {
                        const maxD = itemDetail.predicted_demand_30d || 1;
                        const pct = Math.min(100, (h.val / maxD) * 100);
                        return (
                          <div key={h.label} className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-400">{h.label}</span>
                              <span className="num font-semibold text-slate-200">
                                {formatNumber(h.val)} {itemDetail.unit}
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
                    </div>

                    {/* AI Restock Suggestion */}
                    <div className="rounded-sm bg-base-850 p-3 space-y-1.5 border border-base-750">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                        <span>Restock Recommendation</span>
                        <span className="text-ok-400 font-mono">
                          +{formatNumber(itemDetail.restock_suggestion_units)} {itemDetail.unit}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Recommended replenishment: {formatNumber(itemDetail.restock_suggestion_kg)} kg payload to maintain 21-day target buffer.
                      </p>
                    </div>
                  </div>
                ) : null}
              </PanelBody>
            ) : (
              <PanelBody>
                <p className="text-center text-xs text-slate-500 py-12">Select an item from the table to inspect values.</p>
              </PanelBody>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}
