import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskLevel } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* --------------------------------- numbers -------------------------------- */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  if (abs >= 1000) return `${(value / 1000).toFixed(2)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value.toFixed(digits)}%`;
}

export function formatSigned(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  if (value < 1) return `${Math.round(value * 60)} min`;
  return `${value.toFixed(1)} h`;
}

/* ---------------------------------- dates --------------------------------- */
/**
 * Parse an API timestamp. The backend emits naive UTC strings (SQLite has no
 * timezone type), so a missing zone designator is interpreted as UTC rather
 * than the browser's local zone -- otherwise every timestamp renders as being
 * in the past.
 */
export function parseApiDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim());
  const normalized = hasZone ? iso : `${iso.trim()}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  const d = parseApiDate(iso);
  if (!d) return "--";
  return d.toLocaleDateString("en-GB", opts ?? { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = parseApiDate(iso);
  if (!d) return "--";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatClock(iso: string | null | undefined): string {
  const d = parseApiDate(iso);
  if (!d) return "--";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "--";
  const parsed = parseApiDate(iso);
  if (!parsed) return "--";
  const then = parsed.getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  const future = diffSec < 0;
  const abs = Math.abs(diffSec);
  const suffix = future ? "from now" : "ago";
  if (abs < 60) return future ? `in ${abs}s` : `${abs}s ${suffix}`;
  if (abs < 3600) return `${Math.round(abs / 60)}m ${suffix}`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h ${suffix}`;
  return `${Math.round(abs / 86400)}d ${suffix}`;
}

/* --------------------------------- risk ----------------------------------- */
export const RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** Tailwind class sets per risk band. */
export function riskColor(level: string | undefined | null): {
  text: string;
  bg: string;
  border: string;
  hex: string;
  stroke: string;
} {
  switch ((level ?? "LOW").toUpperCase()) {
    case "CRITICAL":
      return {
        text: "text-crit-400",
        bg: "bg-crit-900/60",
        border: "border-crit-500/45",
        hex: "#e0483f",
        stroke: "#f0655c",
      };
    case "HIGH":
      return {
        text: "text-warn-500",
        bg: "bg-warn-900/60",
        border: "border-warn-500/45",
        hex: "#e8a33d",
        stroke: "#f5bc63",
      };
    case "MEDIUM":
      return {
        text: "text-warn-500",
        bg: "bg-warn-900/40",
        border: "border-warn-500/30",
        hex: "#e8a33d",
        stroke: "#e8a33d",
      };
    default:
      return {
        text: "text-ok-400",
        bg: "bg-ok-900/50",
        border: "border-ok-500/40",
        hex: "#2fbf71",
        stroke: "#45d68c",
      };
  }
}

export function statusColor(status: string | undefined | null) {
  switch ((status ?? "").toUpperCase()) {
    case "CRITICAL":
      return riskColor("CRITICAL");
    case "WARNING":
    case "MEDIUM":
      return riskColor("MEDIUM");
    case "HEALTHY":
    case "LOW":
    case "RESOLVED":
    case "AVAILABLE":
      return riskColor("LOW");
    case "HIGH":
      return riskColor("HIGH");
    case "IN_TRANSIT":
    case "ACKNOWLEDGED":
    case "NEW":
    case "MAINTENANCE":
      return riskColor(status === "MAINTENANCE" ? "MEDIUM" : "HIGH");
    default:
      return riskColor("LOW");
  }
}

/** Chart palette, ordered for maximum separation. */
export const CHART_COLORS = [
  "#22b8d6",
  "#e8a33d",
  "#2fbf71",
  "#e0483f",
  "#4a86e8",
  "#a173e8",
  "#e879b8",
  "#5ad1c0",
];

export const AXIS_STYLE = {
  stroke: "#33415a",
  tick: { fill: "#6b7a94", fontSize: 11 },
} as const;

export const GRID_STYLE = {
  strokeDasharray: "3 3",
  stroke: "rgba(51,65,90,0.45)",
} as const;

export const TOOLTIP_STYLE = {
  backgroundColor: "rgba(11,17,28,0.97)",
  border: "1px solid #33415a",
  borderRadius: 4,
  fontSize: 12,
  color: "#e8edf5",
  boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Fuel: "#e8a33d",
  Food: "#2fbf71",
  Water: "#22b8d6",
  "Medical Supplies": "#e0483f",
  "Spare Parts": "#a173e8",
};

/** Clamp helper for gauges. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}