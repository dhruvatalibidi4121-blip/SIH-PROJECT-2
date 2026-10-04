"use client";

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  GRID_STYLE,
  TOOLTIP_STYLE,
  formatCompact,
  formatDate,
  formatNumber,
} from "@/lib/utils";
import type { Forecast } from "@/types";

type Row = Record<string, string | number | boolean | null | undefined>;

/**
 * Historical consumption + projected demand with confidence band.
 * The gap between the two series is the forecast boundary and is shaded.
 */
export function ForecastProjectionChart({
  forecast,
  height = 330,
}: {
  forecast: Forecast;
  height?: number;
}) {
  const history = forecast.history.slice(-21);
  const projection = forecast.series.filter((p) => p.is_projection);
  const historyTail = forecast.series.filter((p) => !p.is_projection);

  // Anchor the projection so the line connects to the last actual reading.
  const lastActual = historyTail[historyTail.length - 1];
  const anchor = lastActual
    ? {
        date: lastActual.date,
        lower: lastActual.lower,
        predicted: lastActual.predicted,
        upper: lastActual.upper,
        actual: lastActual.predicted,
        cumulative: 0,
        is_projection: false,
      }
    : null;

  const data: Row[] = [
    ...historyTail.map((p) => ({
      date: p.date,
      actual: p.predicted,
      lower: undefined,
      predicted: undefined,
      upper: undefined,
      cumulative: 0,
      is_projection: false,
    })),
    ...(anchor ? [anchor] : []),
    ...projection.map((p) => ({
      date: p.date,
      actual: undefined,
      lower: p.lower,
      predicted: p.predicted,
      upper: p.upper,
      cumulative: p.cumulative,
      is_projection: true,
    })),
  ];

  // Shade the projection window from the forecast boundary onward.
  const boundaryIndex = anchor ? historyTail.length : historyTail.length - 1;
  const bandStart = data[boundaryIndex]?.date;
  const bandEnd = (data[data.length - 1]?.date) ?? undefined;

  const stock = forecast.current_inventory;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22b8d6" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#22b8d6" stopOpacity={0.16} />
          </linearGradient>
        </defs>

        <CartesianGrid {...GRID_STYLE} vertical={false} />

        {/* Forecast window shading */}
        {typeof bandStart === 'string' && typeof bandEnd === 'string' ? (
          <ReferenceArea x1={bandStart} x2={bandEnd} fill="rgba(34,184,214,0.05)" />
        ) : null}

        {/* Forecast boundary line */}
        {typeof bandStart === 'string' ? (
          <ReferenceLine
            x={bandStart}
            stroke="#33415a"
            strokeDasharray="4 4"
            label={{
              value: "forecast",
              position: "insideTopLeft",
              fill: "#64748b",
              fontSize: 10,
            }}
          />
        ) : null}

        {/* Stock-on-hand ceiling */}
        {stock > 0 ? (
          <ReferenceLine
            y={stock}
            stroke="#e0483f"
            strokeDasharray="5 4"
            strokeOpacity={0.75}
            label={{
              value: `stock ${formatNumber(stock)}`,
              position: "insideTopRight",
              fill: "#e0483f",
              fontSize: 10,
            }}
          />
        ) : null}

        <XAxis
          dataKey="date"
          tick={{ fill: "#6b7a94", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#243044" }}
          tickFormatter={(v: string) => formatDate(v)}
          interval="preserveStartEnd"
          minTickGap={30}
        />
        <YAxis
          tick={{ fill: "#6b7a94", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={46}
          tickFormatter={(v: number) => formatCompact(v)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#94a3b8", marginBottom: 4, fontSize: 11 }}
          formatter={(value, name) => {
            if (value === undefined || value === null) return null;
            const v = Number(value);
            const label =
              name === "actual"
                ? "Recorded"
                : name === "predicted"
                  ? "Predicted"
                  : name === "lower"
                    ? "Band low"
                    : "Band high";
            return [`${formatNumber(v, 0)} ${forecast.unit}`, label];
          }}
        />

        {/* Confidence band bounds (hidden from tooltip) */}
        <Area
          type="monotone"
          dataKey="upper"
          stroke="none"
          fill="url(#bandFill)"
          connectNulls
          legendType="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="lower"
          stroke="none"
          fill="#080c14"
          fillOpacity={1}
          connectNulls
          legendType="none"
          isAnimationActive={false}
        />

        {/* Recorded consumption */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#64748b"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        {/* Modelled prediction */}
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="#22b8d6"
          strokeWidth={2.4}
          dot={{ r: 2, fill: "#22b8d6", strokeWidth: 0 }}
          activeDot={{ r: 4, fill: "#6fdcf0" }}
          connectNulls
          strokeDasharray="5 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Cumulative projected draw-down vs available stock. */
export function CumulativeDemandChart({
  forecast,
  height = 220,
}: {
  forecast: Forecast;
  height?: number;
}) {
  const history = forecast.history.slice(-14);
  const projection = forecast.series.filter((p) => p.is_projection);

  const data: Row[] = [
    ...history.map((h) => ({
      date: h.date,
      actual: h.consumption,
      actualCum: h.inventory,
    })),
    ...projection.map((p) => ({
      date: p.date,
      projected: p.cumulative,
      lower: p.lower,
      upper: p.upper,
      actualCum: undefined,
    })),
  ];

  const stock = forecast.current_inventory;
  const breach = projection.find((p) => p.cumulative >= stock);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid {...GRID_STYLE} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#6b7a94", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#243044" }}
          tickFormatter={(v: string) => formatDate(v)}
          interval="preserveStartEnd"
          minTickGap={34}
        />
        <YAxis
          tick={{ fill: "#6b7a94", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={46}
          tickFormatter={(v: number) => formatCompact(v)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#94a3b8", marginBottom: 4, fontSize: 11 }}
          formatter={(value, name) => {
            if (value === undefined || value === null) return null;
            const label =
              name === "actual"
                ? "Daily consumption"
                : name === "projected"
                  ? "Cumulative demand"
                  : "Inventory on hand";
            return [`${formatNumber(Number(value))} ${forecast.unit}`, label];
          }}
        />
        {stock > 0 ? (
          <ReferenceLine
            y={stock}
            stroke="#e0483f"
            strokeDasharray="5 4"
            label={{
              value: "stock level",
              position: "insideTopRight",
              fill: "#e0483f",
              fontSize: 10,
            }}
          />
        ) : null}
        {breach ? (
          <ReferenceLine
            x={breach.date}
            stroke="#e0483f"
            strokeDasharray="3 3"
            label={{
              value: `shortage d${forecast.projected_shortage_day}`,
              position: "top",
              fill: "#e0483f",
              fontSize: 10,
            }}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#64748b"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="projected"
          stroke="#e8a33d"
          strokeWidth={2.4}
          dot={{ r: 2, fill: "#e8a33d", strokeWidth: 0 }}
          connectNulls
          strokeDasharray="5 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}