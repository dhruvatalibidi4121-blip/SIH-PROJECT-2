"use client";

import { cn, formatNumber, riskColor } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import type { WeatherRecord } from "@/types";
import { Droplets, Eye, Snowflake, Thermometer, Wind } from "lucide-react";

/** Compact per-node weather rows for the dashboard panel. */
export function WeatherStrip({ records }: { records: WeatherRecord[] }) {
  if (!records.length) {
    return <p className="px-4 py-6 text-center text-xs text-slate-500">No weather observations.</p>;
  }

  return (
    <ul className="divide-y divide-base-800">
      {records.map((rec) => {
        const c = riskColor(rec.severity);
        return (
          <li key={rec.id} className="px-4 py-2.5 transition-colors hover:bg-base-850/40">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-slate-300">
                {rec.location_name}
              </span>
              <span
                className="num shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: `${c.hex}1f`, color: c.hex }}
              >
                {rec.weather_risk.toFixed(0)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
              <span className="num inline-flex items-center gap-1">
                <Thermometer className="size-2.5" />
                {rec.temperature.toFixed(0)}&deg;C
              </span>
              <span className="num inline-flex items-center gap-1">
                <Droplets className="size-2.5" />
                {rec.rainfall.toFixed(0)} mm
              </span>
              <span className="num inline-flex items-center gap-1">
                <Eye className="size-2.5" />
                {rec.visibility_km.toFixed(1)} km
              </span>
              {rec.snow_probability > 0.3 ? (
                <Tooltip content={`Snow probability ${(rec.snow_probability * 100).toFixed(0)}%`}>
                  <span className="num inline-flex items-center gap-1 text-accent-400/80">
                    <Snowflake className="size-2.5" />
                    {(rec.snow_probability * 100).toFixed(0)}%
                  </span>
                </Tooltip>
              ) : null}
              <span className="num inline-flex items-center gap-1">
                <Wind className="size-2.5" />
                {rec.wind_speed.toFixed(0)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Larger weather card used on the Risk page. */
export function WeatherCard({
  record,
  className,
}: {
  record: WeatherRecord;
  className?: string;
}) {
  const c = riskColor(record.severity);
  const metrics = [
    {
      icon: Thermometer,
      label: "Temperature",
      value: `${record.temperature.toFixed(1)}°C`,
      tone: record.temperature < 0 ? "text-accent-300" : "text-slate-200",
    },
    {
      icon: Droplets,
      label: "Rainfall",
      value: `${record.rainfall.toFixed(0)} mm`,
      tone: record.rainfall > 60 ? "text-accent-300" : "text-slate-200",
    },
    {
      icon: Eye,
      label: "Visibility",
      value: `${record.visibility_km.toFixed(1)} km`,
      tone: record.visibility_km < 2 ? "text-warn-500" : "text-slate-200",
    },
    {
      icon: Snowflake,
      label: "Snow Prob.",
      value: `${(record.snow_probability * 100).toFixed(0)}%`,
      tone: record.snow_probability > 0.5 ? "text-warn-500" : "text-slate-200",
    },
    {
      icon: Wind,
      label: "Wind Speed",
      value: `${record.wind_speed.toFixed(0)} km/h`,
      tone: record.wind_speed > 45 ? "text-warn-500" : "text-slate-200",
    },
  ];

  return (
    <div className={cn("panel relative overflow-hidden rounded-sm", className)}>
      <span
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: c.hex }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2 border-b border-base-800 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-slate-100">{record.location_name}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{record.condition}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-lg font-semibold leading-none" style={{ color: c.hex }}>
            {record.weather_risk.toFixed(0)}
          </p>
          <p className="label-caps mt-1 text-[9px]" style={{ color: c.hex }}>
            {record.severity}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-base-800">
        {metrics.map((m) => (
          <div key={m.label} className="bg-base-850 px-3.5 py-2">
            <dt className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
              <m.icon className="size-2.5" />
              {m.label}
            </dt>
            <dd className={cn("num mt-0.5 text-[13px] font-medium", m.tone)}>{m.value}</dd>
          </div>
        ))}
        <div className="col-span-2 bg-base-850 px-3.5 py-2">
          <dt className="text-[9px] uppercase tracking-wider text-slate-500">Data source</dt>
          <dd className="num mt-0.5 text-[13px] font-medium text-slate-200">
            {record.source === "SYNTHETIC" ? "Synthetic (demo)" : record.source}
          </dd>
        </div>
      </dl>
    </div>
  );
}