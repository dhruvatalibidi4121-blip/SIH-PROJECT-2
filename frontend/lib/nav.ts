import {
  Boxes,
  ChartNoAxesCombined,
  CloudSun,
  LayoutDashboard,
  Map,
  Siren,
  TrendingUp,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  group?: "workspace" | "reference";
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Current logistics health across the network",
    group: "workspace",
  },
  {
    label: "Demand Forecast",
    href: "/forecast",
    icon: TrendingUp,
    description: "AI-projected consumption and shortage windows",
    group: "workspace",
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Boxes,
    description: "Stock levels, coverage and days remaining",
    group: "workspace",
  },
  {
    label: "Logistics Map",
    href: "/map",
    icon: Map,
    description: "GIS corridors, nodes and route risk",
    group: "workspace",
  },
  {
    label: "Transport",
    href: "/transport",
    icon: Truck,
    description: "Fleet availability and utilisation",
    group: "workspace",
  },
  {
    label: "Risk Intelligence",
    href: "/risk",
    icon: CloudSun,
    description: "Composite risk score and breakdown",
    group: "workspace",
  },
  {
    label: "Alerts",
    href: "/alerts",
    icon: Siren,
    description: "Automatically generated predictive alerts",
    group: "workspace",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: ChartNoAxesCombined,
    description: "Trends, benchmarks and model accuracy",
    group: "workspace",
  },
  {
    label: "Architecture",
    href: "/architecture",
    icon: Boxes,
    description: "System architecture and data flow",
    group: "reference",
  },
];

export const WORKSPACE_NAV = NAV_ITEMS.filter((i) => i.group === "workspace");