/**
 * Shared API types mirroring the FastAPI Pydantic schemas.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ItemStatus = "HEALTHY" | "WARNING" | "CRITICAL";
export type AlertStatus = "NEW" | "ACKNOWLEDGED" | "RESOLVED";
export type AssetStatus = "AVAILABLE" | "IN_TRANSIT" | "MAINTENANCE";

export const SUPPLY_TYPES = [
  "Fuel",
  "Food",
  "Water",
  "Medical Supplies",
  "Spare Parts",
] as const;

export type SupplyType = (typeof SUPPLY_TYPES)[number];

export const HORIZONS = [3, 7, 14, 30] as const;
export type Horizon = (typeof HORIZONS)[number];

export const UNIT_BY_SUPPLY: Record<string, string> = {
  Fuel: "L",
  Food: "kg",
  Water: "L",
"Medical Supplies": "kits",
  "Spare Parts": "units",
};

/* ---------------------------------------------------------------- health */
export interface Health {
  status: string;
  app: string;
  version: string;
  demo_mode: boolean;
  database: { status: string; dialect: string; detail?: string };
  server_time: string;
  model_ready: boolean;
  model_version: string;
}

/* -------------------------------------------------------------- location */
export interface LocationNode {
  id: string;
  name: string;
  node_type: "HUB" | "DISTRIBUTION" | "FORWARD";
  latitude: number;
  longitude: number;
  elevation_m: number;
  region: string;
  terrain: string;
  total_stock: number;
  total_capacity: number;
  fill_pct: number;
  critical_items: number;
  warning_items: number;
  predicted_demand_7d: number;
  risk_score: number;
  risk_level: RiskLevel;
  transport_availability: number;
  estimated_delivery_hours: number | null;
}

/* ------------------------------------------------------------- inventory */
export interface InventoryItem {
  id: number;
  item_code: string;
  name: string;
  category: string;
  unit: string;
  location_id: string;
  location_name: string;
  current_stock: number;
  capacity: number;
  safety_threshold: number;
  daily_consumption: number;
  stock_pct: number;
  days_remaining: number;
  status: ItemStatus;
  reorder_point_days: number;
  updated_at: string;
}

export interface SeriesPoint {
  date: string;
  value: number;
  kind: string;
}

export interface InventoryDetail extends InventoryItem {
  unit_cost: number;
  days_of_cover_ratio: number;
  predicted_demand_3d: number;
  predicted_demand_7d: number;
  predicted_demand_14d: number;
  predicted_demand_30d: number;
  shortage_day: number | null;
  shortage_date: string | null;
  risk_level: RiskLevel;
  confidence: number;
  model_version: string;
  historical: SeriesPoint[];
  predicted: SeriesPoint[];
  restock_suggestion_kg: number;
  restock_suggestion_units: number;
}

export interface InventoryResponse {
  items: InventoryItem[];
  total: number;
  counts: Record<string, number>;
  fill_rate_pct: number;
  demo_mode: boolean;
  generated_at: string;
}

/* -------------------------------------------------------------- forecast */
export interface HistoryPoint {
  date: string;
  consumption: number;
  inventory: number;
  rolling_avg: number;
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
  cumulative: number;
  is_projection: boolean;
}

export interface Forecast {
  supply_type: string;
  unit: string;
  location_id: string | null;
  location_name: string;
  horizon_days: number;
  predicted_demand: number;
  current_inventory: number;
  confidence: number;
  daily_average: number;
  projected_shortage_day: number | null;
  projected_shortage_date: string | null;
  risk_level: RiskLevel;
  demand_change_pct: number;
  recommendation: string;
  model: string;
  model_version: string;
  demo_mode: boolean;
  features_used: string[];
  history: HistoryPoint[];
  series: ForecastPoint[];
  generated_at: string;
}

export interface ForecastMeta {
  supply_types: string[];
  horizons: number[];
  units: Record<string, string>;
  model: {
    ready?: boolean;
    version?: string;
    type?: string;
    metrics?: { mape?: number; r2?: number; train_rows?: number; accuracy_pct?: number };
    features?: string[];
  };
  demo_mode: boolean;
  disclaimer: string;
}

/* ---------------------------------------------------------------- routes */
export interface Route {
  id: number;
  route_code: string;
  origin: string;
  origin_id: string;
  destination: string;
  destination_id: string;
  distance_km: number;
  estimated_time_hours: number;
  risk_score: number;
  weather_risk: number;
  terrain_risk: number;
  road_condition: string;
  transport_capacity: number;
  status: string;
  route_score: number;
  risk_level: RiskLevel;
  path: number[][];
  rationale: string;
  capacity_headroom_pct?: number;
  capacity_sufficient?: boolean;
  origin_coords?: number[];
  destination_coords?: number[];
}

export interface RouteRecommendation {
  recommended_route: Route;
  alternatives: Route[];
  score_explanation: string;
  factors: Record<string, number>;
  method: string;
  computed_at: string;
  demo_mode: boolean;
}

/* --------------------------------------------------------------- weather */
export interface WeatherRecord {
  id: number;
  location_id: string;
  location_name: string;
  observed_at: string;
  temperature: number;
  rainfall: number;
  visibility_km: number;
  snow_probability: number;
  wind_speed: number;
  weather_risk: number;
  severity: RiskLevel;
  condition: string;
  source: string;
}

export interface WeatherResponse {
  records: WeatherRecord[];
  system_risk: number;
  severity: RiskLevel;
  source: string;
  demo_mode: boolean;
  fetched_at: string;
}

/* ------------------------------------------------------------------ risk */
export interface RiskComponent {
  key: string;
  label: string;
  score: number;
  max_score: number;
  pct: number;
  level: RiskLevel;
  detail: string;
}

export interface RiskResponse {
  scope: string;
  location_id: string | null;
  location_name: string;
  total_score: number;
  level: RiskLevel;
  inventory_score: number;
  demand_score: number;
  weather_score: number;
  route_score: number;
  transport_score: number;
  components: RiskComponent[];
  drivers: string[];
  trend: Record<string, string | number>[];
  computed_at: string;
  demo_mode: boolean;
}

/* ---------------------------------------------------------------- alerts */
export interface Alert {
  id: number;
  alert_code: string;
  severity: RiskLevel;
  title: string;
  description: string;
  category: string;
  location_id: string | null;
  location_name: string | null;
  recommended_action: string;
  status: AlertStatus;
  confidence: number;
  metric_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  counts: Record<string, number>;
  severity_counts: Record<string, number>;
  demo_mode: boolean;
}

/* ------------------------------------------------------------- transport */
export interface TransportAsset {
  id: number;
  asset_id: string;
  name: string;
  asset_type: string;
  capacity_kg: number;
  status: AssetStatus;
  current_assignment: string | null;
  origin_id: string | null;
  origin: string | null;
  destination_id: string | null;
  destination: string | null;
  eta_hours: number | null;
  availability_pct: number;
  utilization_pct: number;
  last_maintenance: string | null;
  updated_at: string;
}

export interface TransportResponse {
  assets: TransportAsset[];
  total: number;
  available_count: number;
  in_transit_count: number;
  maintenance_count: number;
  total_capacity_kg: number;
  available_capacity_kg: number;
  utilization_pct: number;
  availability_pct: number;
  by_type: Record<string, number | string>[];
  demo_mode: boolean;
}

/* -------------------------------------------------------- recommendations */
export interface Recommendation {
  id: string;
  priority: RiskLevel;
  priority_score: number;
  title: string;
  reason: string;
  expected_impact: string;
  suggested_action: string;
  category: string;
  confidence: number;
  location_id: string | null;
  location_name: string | null;
  metric_value: number | null;
  horizon_days: number | null;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  total: number;
  generated_at: string;
  engine: string;
  demo_mode: boolean;
  disclaimer: string;
}

/* ------------------------------------------------------------- dashboard */
export interface KpiCard {
  key: string;
  label: string;
  value: string;
  raw_value: number;
  unit: string;
  delta: number | null;
  delta_label: string;
  status: ItemStatus | RiskLevel;
  hint: string;
  href: string;
}

export interface Dashboard {
  generated_at: string;
  demo_mode: boolean;
  health_label: string;
  health_score: number;
  kpis: KpiCard[];
  demand_trend: Record<string, string | number>[];
  category_distribution: Record<string, string | number>[];
  inventory_fill_by_category: Record<string, string | number>[];
  route_risk_summary: Record<string, string | number>[];
  transport_utilization: Record<string, string | number>[];
  top_alerts: Alert[];
  recommendations: Recommendation[];
  forecast_accuracy: Record<string, number>;
  weather_snapshot: WeatherRecord[];
  nodes: LocationNode[];
  risk_total: number;
  risk_level: RiskLevel;
  active_alert_count: number;
  recommended_route: string | null;
}

/* ------------------------------------------------------------- analytics */
export interface Analytics {
  range_days: number;
  generated_at: string;
  demo_mode: boolean;
  demand_trend: Record<string, string | number>[];
  inventory_trend: Record<string, string | number>[];
  transport_utilization: Record<string, string | number>[];
  route_risk: Record<string, string | number>[];
  forecast_accuracy: Record<string, string | number>[];
  category_distribution: Record<string, string | number>[];
  weather_impact: Record<string, string | number>[];
  consumption_by_supply: Record<string, number[]>;
  inventory_fill_by_category: Record<string, string | number>[];
  kpis: Record<string, number>;
}

export interface ApiError {
  detail: string;
  path?: string;
  errors?: { field: string; message: string }[];
  error?: string;
}