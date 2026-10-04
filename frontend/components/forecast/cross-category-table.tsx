"use client";

import { useQueries } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { TableSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { SUPPLY_TYPES, type Forecast, type LocationNode } from "@/types";
import { CATEGORY_COLORS, cn, formatNumber, formatSigned, riskColor } from "@/lib/utils";

/**
 * Side-by-side 7/14/30-day projections for every supply category.
 * Each cell is an independent API call so the table stays honest about
 * per-category risk.
 */
export function CrossCategoryForecastTable({
  horizon,
  nodes,
  limit,
}: {
  horizon: number;
  nodes: LocationNode[];
  limit?: number;
}) {
  const categories = limit ? SUPPLY_TYPES.slice(0, limit) : SUPPLY_TYPES;

  const results = useQueries({
    queries: categories.map((supply) => ({
      queryKey: ["forecast", supply, horizon, null],
      queryFn: () =>
        endpoints.forecast({ supply_type: supply, horizon_days: horizon, history_days: 30 }),
    })),
  });

  const loading = results.some((r) => r.isLoading);

  if (loading && !results.some((r) => r.data)) {
    return <TableSkeleton rows={5} cols={5} />;
  }

  const rows = results.map((r, i) => ({ supply: categories[i], data: r.data as Forecast | undefined }));

  return (
    <Panel>
      <PanelHeader
        title="Cross-Category Forecast Summary"
        subtitle={`Projected demand at the tightest-covered node per category · ${horizon}-day horizon`}
        icon={<GridIcon size={13} />}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-base-700">
              {["Category", "Focus Node", "Current Stock", `${horizon}d Demand`, "Coverage", "Shortage", "Risk", "Trend"].map(
                (h) => (
                  <th
                    key={h}
                    className="label-caps whitespace-nowrap px-4 py-2.5 text-[9px] font-semibold text-slate-500"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-800">
            {rows.map(({ supply, data }) => {
              if (!data) {
                return (
                  <tr key={supply}>
                    <td colSpan={8} className="px-4 py-3 text-center text-[11px] text-slate-600">
                      {supply}: unavailable
                    </td>
                  </tr>
                );
              }
              const c = riskColor(data.risk_level);
              const coverage =
                data.predicted_demand > 0
                  ? (data.current_inventory / data.predicted_demand) * 100
                  : 100;
              const shortage = data.projected_shortage_day;
              const breach = shortage !== null && shortage <= data.horizon_days;
              const accent = CATEGORY_COLORS[supply] ?? "#22b8d6";

              return (
                <tr key={supply} className="transition-colors hover:bg-base-850/50">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-slate-200">
                      <span
                        className="size-1.5 rounded-sm"
                        style={{ background: accent }}
                        aria-hidden
                      />
                      {supply}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-400">
                    {data.location_name}
                  </td>
                  <td className="num px-4 py-2.5 text-[11px] text-slate-300">
                    {formatNumber(data.current_inventory)}{" "}
                    <span className="text-slate-600">{data.unit}</span>
                  </td>
                  <td className="num px-4 py-2.5 text-[11px] text-accent-300">
                    {formatNumber(data.predicted_demand)}{" "}
                    <span className="text-slate-600">{data.unit}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Tooltip
                      content={`Stock covers ${coverage.toFixed(0)}% of the ${data.horizon_days}-day projected demand.`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-sm bg-base-700">
                          <div
                            className="h-full rounded-sm transition-[width] duration-500"
                            style={{
                              width: `${Math.min(100, coverage)}%`,
                              background: coverage < 100 ? "#e0483f" : coverage < 140 ? "#e8a33d" : "#2fbf71",
                            }}
                          />
                        </div>
                        <span className="num text-[10px] text-slate-400">
                          {coverage.toFixed(0)}%
                        </span>
                      </div>
                    </Tooltip>
                  </td>
                  <td className="num px-4 py-2.5">
                    {shortage !== null ? (
                      <span className={breach ? "text-crit-400" : "text-warn-500"}>
                        Day {shortage}
                      </span>
                    ) : (
                      <span className="text-slate-600">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className="border-0 px-1.5 py-0" style={{ background: `${c.hex}1f`, color: c.hex }}>
                      {data.risk_level}
                    </Badge>
                  </td>
                  <td
                    className={cn(
                      "num px-4 py-2.5 text-[11px]",
                      data.demand_change_pct >= 0 ? "text-warn-500" : "text-ok-400",
                    )}
                  >
                    {formatSigned(data.demand_change_pct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PanelBody className="py-2.5">
        <p className="text-[10px] leading-relaxed text-slate-600">
          Coverage = current stock as a percentage of projected demand over the selected horizon.
          Values at or below 100% indicate a projected shortfall inside the planning window.
        </p>
      </PanelBody>
    </Panel>
  );
}

function GridIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}