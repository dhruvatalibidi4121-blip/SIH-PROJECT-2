"use client";

import { clamp, riskColor } from "@/lib/utils";
import { Skeleton } from "@/components/ui/states";
import { Tooltip } from "@/components/ui/tooltip";

const SIZE = 210;
const STROKE = 13;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular risk gauge for the 0-100 composite risk score.
 * Bands: 0-30 LOW, 31-60 MEDIUM, 61-80 HIGH, 81-100 CRITICAL.
 */
export function RiskGauge({
  score,
  level,
  size = SIZE,
  label = "Composite Risk",
  sublabel,
}: {
  score: number;
  level: string;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const clamped = clamp(score, 0, 100);
  const c = riskColor(level);
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
        role="img"
        aria-label={`${label}: ${clamped.toFixed(0)} out of 100, ${level}`}
      >
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#1a2434"
          strokeWidth={STROKE}
        />
        {/* Band ticks at 30 / 60 / 80 */}
        {[30, 60, 80].map((mark) => {
          const angle = (mark / 100) * 2 * Math.PI - Math.PI / 2;
          const r1 = RADIUS - STROKE / 2 - 1;
          const r2 = RADIUS + STROKE / 2 + 1;
          return (
            <line
              key={mark}
              x1={SIZE / 2 + r1 * Math.cos(angle)}
              y1={SIZE / 2 + r1 * Math.sin(angle)}
              x2={SIZE / 2 + r2 * Math.cos(angle)}
              y2={SIZE / 2 + r2 * Math.sin(angle)}
              stroke="#33415a"
              strokeWidth={1.5}
            />
          );
        })}
        {/* Value arc */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={c.hex}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1), stroke 400ms" }}
        />
      </svg>

      {/* Centre readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="label-caps text-[9px] text-slate-500">{label}</span>
        <div className="flex items-baseline gap-0.5">
          <span
            className="num text-[40px] font-semibold leading-none tracking-tight"
            style={{ color: c.hex }}
          >
            {clamped.toFixed(0)}
          </span>
          <span className="num text-sm text-slate-500">/100</span>
        </div>
        <span
          className="mt-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ borderColor: c.hex, color: c.hex, background: `${c.hex}14` }}
        >
          {level}
        </span>
        {sublabel ? <span className="mt-1 text-[9px] text-slate-600">{sublabel}</span> : null}
      </div>
    </div>
  );
}

/** Compact horizontal variant used in list rows. */
export function RiskBar({
  score,
  max = 100,
  level,
  className,
}: {
  score: number;
  max?: number;
  level: string;
  className?: string;
}) {
  const c = riskColor(level);
  const pct = clamp((score / (max || 1)) * 100, 0, 100);
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-sm bg-base-700/80">
        <div
          className="h-full rounded-sm transition-[width] duration-500"
          style={{ width: `${pct}%`, background: c.hex }}
        />
      </div>
      <span className="num shrink-0 text-[11px] text-slate-400">
        {score.toFixed(1)}
        <span className="text-slate-600">/{max}</span>
      </span>
    </div>
  );
}

export function RiskGaugeSkeleton({ size = SIZE }: { size?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <Skeleton className="rounded-full" style={{ width: size, height: size }} />
      <div className="-mt-24 flex flex-col items-center gap-2">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/** Legend explaining the four risk bands. */
export function RiskLegend() {
  const bands = [
    { range: "0-30", level: "LOW", hex: "#2fbf71" },
    { range: "31-60", level: "MEDIUM", hex: "#e8a33d" },
    { range: "61-80", level: "HIGH", hex: "#e8a33d" },
    { range: "81-100", level: "CRITICAL", hex: "#e0483f" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {bands.map((b) => (
        <Tooltip key={b.level} content={`${b.level} risk band: ${b.range}`}>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: b.hex }} />
            <span className="num text-[10px] text-slate-500">{b.range}</span>
            <span className="text-[10px] font-medium text-slate-400">{b.level}</span>
          </span>
        </Tooltip>
      ))}
    </div>
  );
}