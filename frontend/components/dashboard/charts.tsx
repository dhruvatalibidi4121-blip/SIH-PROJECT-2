"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CATEGORY_COLORS,
  GRID_STYLE,
  TOOLTIP_STYLE,
  cn,
  formatCompact,
  formatNumber,
  formatPct,
  riskColor,
} from "@/lib/utils";

type Row = Record<string, string | number>;

/* --------------------------- 30-day demand trend -------------------------- */
export function DemandTrendChart({ data, height = 228 }: { data: Row[]; height?: number }) {
  if (!data.length) {
    return (
      <div className="flex h-[228px] items-center justify-center text-xs text-slate-600">
        No consumption data in range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="demandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22b8d6" stopOpacity={0.34} />
            <stop offset="100%" stopColor="#22b8d6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_STYLE} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#6b7a94", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#243044" }}
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return Number.isNaN(d.getTime())
              ? v
              : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
          }}
          interval="preserveStartEnd"
          minTickGap={26}
        />
        <YAxis
          tick={{ fill: "#6b7a94", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatCompact(v)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#94a3b8", marginBottom: 4, fontSize: 11 }}
          formatter={(_value, name) => [
            formatNumber(Number(_value)),
            name === "demand" ? "Consumption" : "Baseline",
          ]}
        />
        <Area
          type="monotone"
          dataKey="baseline"
          stroke="#33415a"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="none"
          name="baseline"
        />
        <Area
          type="monotone"
          dataKey="demand"
          stroke="#22b8d6"
          strokeWidth={2}
          fill="url(#demandFill)"
          name="demand"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* -------------------------- Supply category mix ---------------------------- */
export function CategoryDistributionChart({ data, height = 228 }: { data: Row[]; height?: number }) {
  if (!data.length) {
    return (
      <div className="flex h-[228px] items-center justify-center text-xs text-slate-600">
        No forecast data.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: String(d.supply_type),
    predicted: Number(d.predicted) || 0,
    change: Number(d.change) || 0,
  }));

  const total = chartData.reduce((sum, d) => sum + d.predicted, 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          barCategoryGap={9}
        >
          <CartesianGrid {...GRID_STYLE} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#6b7a94", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 10.5 }}
            tickLine={false}
            axisLine={false}
            width={104}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "rgba(34,184,214,0.05)" }}
            formatter={(value) => {
              const v = Number(value) || 0;
              const share = total ? (v / total) * 100 : 0;
              return [`${formatNumber(v)} (${share.toFixed(0)}%)`, "7d demand"];
            }}
          />
          <Bar dataKey="predicted" radius={[0, 2, 2, 0]} maxBarSize={18}>
            {chartData.map((d) => (
              <Cell key={d.name} fill={CATEGORY_COLORS[d.name] ?? "#22b8d6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <ul className="mt-1 space-y-1 border-t border-base-800 px-4 pb-2 pt-2.5">
        {chartData.map((d) => {
          const up = d.change >= 0;
          return (
            <li key={d.name} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-1.5 shrink-0 rounded-sm"
                  style={{ background: CATEGORY_COLORS[d.name] ?? "#22b8d6" }}
                />
                <span className="truncate text-slate-400">{d.name}</span>
              </span>
              <span
                className={cn("num shrink-0 text-[10px]", up ? "text-ok-400" : "text-slate-500")}
              >
                {up ? "+" : ""}
                {d.change.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* --------------------------- Corridor risk bars ---------------------------- */
export function RouteRiskChart({ data, height = 210 }: { data: Row[]; height?: number }) {
  if (!data.length) {
    return (
      <div className="flex h-[210px] items-center justify-center text-xs text-slate-600">
        No corridors available.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    code: String(d.route_code),
    risk: Number(d.risk_score) || 0,
    level: String(d.risk_level),
    distance: Number(d.distance_km) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} vertical={false} />
        <XAxis
          dataKey="code"
          tick={{ fill: "#94a3b8", fontSize: 10.5 }}
          tickLine={false}
          axisLine={{ stroke: "#243044" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#6b7a94", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(34,184,214,0.05)" }}
          formatter={(value, _name, item) => {
            const payload = item?.payload as { level?: string; distance?: number } | undefined;
            return [
              `${Number(value).toFixed(0)} / 100 · ${payload?.level ?? ""}`,
              `${payload?.distance ?? 0} km`,
            ];
          }}
        />
        {/* 60/100 reference threshold */}
        <Bar dataKey="risk" radius={[2, 2, 0, 0]} maxBarSize={34}>
          {chartData.map((d) => (
            <Cell key={d.code} fill={riskColor(d.level).hex} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------- Inventory fill by category ---------------------- */
export function FillRateChart({ data, height = 210 }: { data?: Row[]; height?: number }) {
  if (!data || !data.length) {
    return (
      <div className="flex h-[210px] items-center justify-center text-xs text-slate-600">
        No inventory data.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: String(d.category),
    fill: Number(d.fill_pct) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#243044" }}
          interval={0}
          angle={-16}
          textAnchor="end"
          height={46}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#6b7a94", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={30}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(34,184,214,0.05)" }}
          formatter={(value) => [`${Number(value).toFixed(1)}%`, "Mean fill"]}
        />
        <Bar dataKey="fill" radius={[2, 2, 0, 0]} maxBarSize={40}>
          {chartData.map((d) => (
            <Cell
              key={d.name}
              fill={d.fill < 30 ? "#e0483f" : d.fill < 60 ? "#e8a33d" : "#2fbf71"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}