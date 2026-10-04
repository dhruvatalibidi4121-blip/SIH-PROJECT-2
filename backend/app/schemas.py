"""Pydantic schemas exposed by the REST API."""

from __future__ import annotations

from datetime import date, datetime

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# Series payloads mix ISO date strings with numeric measures.
SeriesRow = dict[str, Any]


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    demo_mode: bool
    database: dict[str, str]
    server_time: datetime
    model_ready: bool
    model_version: str


# --------------------------------------------------------------------------
# Locations / Map
# --------------------------------------------------------------------------
class LocationOut(ORMModel):
    id: str
    name: str
    node_type: str
    latitude: float
    longitude: float
    elevation_m: int
    region: str
    terrain: str
    total_stock: float = 0.0
    total_capacity: float = 0.0
    fill_pct: float = 0.0
    critical_items: int = 0
    warning_items: int = 0
    predicted_demand_7d: float = 0.0
    risk_score: float = 0.0
    risk_level: str = "LOW"
    transport_availability: float = 0.0
    estimated_delivery_hours: float | None = None


class LocationSummary(LocationOut):
    items: list["InventoryItemOut"] = Field(default_factory=list)


class LocationListResponse(BaseModel):
    locations: list[LocationOut]
    count: int


# --------------------------------------------------------------------------
# Inventory
# --------------------------------------------------------------------------
class InventoryItemOut(ORMModel):
    id: int
    item_code: str
    name: str
    category: str
    unit: str
    location_id: str
    location_name: str
    current_stock: float
    capacity: float
    safety_threshold: float
    daily_consumption: float
    stock_pct: float
    days_remaining: float
    status: str
    reorder_point_days: float
    updated_at: datetime


class InventoryDetailOut(InventoryItemOut):
    unit_cost: float
    days_of_cover_ratio: float
    predicted_demand_3d: float
    predicted_demand_7d: float
    predicted_demand_14d: float
    predicted_demand_30d: float
    shortage_day: int | None
    shortage_date: date | None
    risk_level: str
    confidence: float
    model_version: str
    historical: list["SeriesPoint"]
    predicted: list["SeriesPoint"]
    restock_suggestion_kg: float
    restock_suggestion_units: int


class SeriesPoint(BaseModel):
    date: str
    value: float
    kind: str = "actual"  # actual | predicted | lower | upper


class InventoryListResponse(BaseModel):
    items: list[InventoryItemOut]
    total: int
    counts: dict[str, int]
    fill_rate_pct: float
    demo_mode: bool
    generated_at: datetime


# --------------------------------------------------------------------------
# Forecast
# --------------------------------------------------------------------------
class ForecastRequest(BaseModel):
    supply_type: str = "Fuel"
    horizon_days: int = Field(7, ge=1, le=90)
    location_id: str | None = None
    include_history: bool = True
    history_days: int = Field(30, ge=7, le=180)


class ForecastPoint(BaseModel):
    date: str
    predicted: float
    lower: float
    upper: float
    cumulative: float
    is_projection: bool = False


class HistoryPoint(BaseModel):
    date: str
    consumption: float
    inventory: float
    rolling_avg: float


class ForecastResponse(BaseModel):
    supply_type: str
    unit: str
    location_id: str | None
    location_name: str
    horizon_days: int
    predicted_demand: float
    current_inventory: float
    confidence: float
    daily_average: float
    projected_shortage_day: int | None
    projected_shortage_date: str | None
    risk_level: str
    demand_change_pct: float
    recommendation: str
    model: str
    model_version: str
    demo_mode: bool
    features_used: list[str]
    history: list[HistoryPoint]
    series: list[ForecastPoint]
    generated_at: datetime


# --------------------------------------------------------------------------
# Routes / logistics
# --------------------------------------------------------------------------
class RouteOut(BaseModel):
    id: int
    route_code: str
    origin: str
    origin_id: str
    destination: str
    destination_id: str
    distance_km: float
    estimated_time_hours: float
    risk_score: float
    weather_risk: float
    terrain_risk: float
    road_condition: str
    transport_capacity: float
    status: str
    route_score: float
    risk_level: str
    path: list[list[float]]
    rationale: str


class RouteListResponse(BaseModel):
    routes: list[RouteOut]
    count: int
    demo_mode: bool


class RouteRecommendation(BaseModel):
    recommended_route: RouteOut
    alternatives: list[RouteOut]
    score_explanation: str
    factors: dict[str, float]
    method: str
    computed_at: datetime
    demo_mode: bool


# --------------------------------------------------------------------------
# Weather
# --------------------------------------------------------------------------
class WeatherOut(ORMModel):
    id: int
    location_id: str
    location_name: str
    observed_at: datetime
    temperature: float
    rainfall: float
    visibility_km: float
    snow_probability: float
    wind_speed: float
    weather_risk: float
    severity: str
    condition: str
    source: str


class WeatherListResponse(BaseModel):
    records: list[WeatherOut]
    system_risk: float
    severity: str
    source: str
    demo_mode: bool
    fetched_at: datetime


# --------------------------------------------------------------------------
# Risk
# --------------------------------------------------------------------------
class RiskComponent(BaseModel):
    key: str
    label: str
    score: float
    max_score: float
    pct: float
    level: str
    detail: str


class RiskResponse(BaseModel):
    scope: str
    location_id: str | None
    location_name: str
    total_score: float
    level: str
    inventory_score: float
    demand_score: float
    weather_score: float
    route_score: float
    transport_score: float
    components: list[RiskComponent]
    drivers: list[str]
    trend: list[SeriesRow]
    computed_at: datetime
    demo_mode: bool


# --------------------------------------------------------------------------
# Alerts
# --------------------------------------------------------------------------
class AlertOut(ORMModel):
    id: int
    alert_code: str
    severity: str
    title: str
    description: str
    category: str
    location_id: str | None
    location_name: str | None
    recommended_action: str
    status: str
    confidence: float
    metric_value: float | None
    created_at: datetime
    updated_at: datetime


class AlertUpdate(BaseModel):
    status: str = Field(pattern="^(NEW|ACKNOWLEDGED|RESOLVED)$")


class AlertListResponse(BaseModel):
    alerts: list[AlertOut]
    total: int
    counts: dict[str, int]
    severity_counts: dict[str, int]
    demo_mode: bool


# --------------------------------------------------------------------------
# Transport
# --------------------------------------------------------------------------
class TransportAssetOut(ORMModel):
    id: int
    asset_id: str
    name: str
    asset_type: str
    capacity_kg: float
    status: str
    current_assignment: str | None
    origin_id: str | None
    origin: str | None
    destination_id: str | None
    destination: str | None
    eta_hours: float | None
    availability_pct: float
    utilization_pct: float
    last_maintenance: date | None
    updated_at: datetime


class TransportResponse(BaseModel):
    assets: list[TransportAssetOut]
    total: int
    available_count: int
    in_transit_count: int
    maintenance_count: int
    total_capacity_kg: float
    available_capacity_kg: float
    utilization_pct: float
    availability_pct: float
    by_type: list[SeriesRow]
    demo_mode: bool


# --------------------------------------------------------------------------
# Recommendations
# --------------------------------------------------------------------------
class RecommendationOut(BaseModel):
    id: str
    priority: str
    priority_score: int
    title: str
    reason: str
    expected_impact: str
    suggested_action: str
    category: str
    confidence: float
    location_id: str | None
    location_name: str | None
    metric_value: float | None
    horizon_days: int | None


class RecommendationResponse(BaseModel):
    recommendations: list[RecommendationOut]
    total: int
    generated_at: datetime
    engine: str
    demo_mode: bool
    disclaimer: str


# --------------------------------------------------------------------------
# Dashboard
# --------------------------------------------------------------------------
class KpiCard(BaseModel):
    key: str
    label: str
    value: str
    raw_value: float
    unit: str
    delta: float | None
    delta_label: str
    status: str
    hint: str
    href: str


class DashboardResponse(BaseModel):
    generated_at: datetime
    demo_mode: bool
    health_label: str
    health_score: float
    kpis: list[KpiCard]
    demand_trend: list[SeriesRow]
    category_distribution: list[SeriesRow]
    inventory_fill_by_category: list[SeriesRow]
    route_risk_summary: list[SeriesRow]
    transport_utilization: list[SeriesRow]
    top_alerts: list[AlertOut]
    recommendations: list[RecommendationOut]
    forecast_accuracy: dict[str, float]
    weather_snapshot: list[WeatherOut]
    nodes: list[LocationOut]
    risk_total: float
    risk_level: str
    active_alert_count: int
    recommended_route: str | None


# --------------------------------------------------------------------------
# Analytics
# --------------------------------------------------------------------------
class AnalyticsResponse(BaseModel):
    range_days: int
    generated_at: datetime
    demo_mode: bool
    demand_trend: list[SeriesRow]
    inventory_trend: list[SeriesRow]
    transport_utilization: list[SeriesRow]
    route_risk: list[SeriesRow]
    forecast_accuracy: list[SeriesRow]
    category_distribution: list[SeriesRow]
    weather_impact: list[SeriesRow]
    consumption_by_supply: dict[str, list[float]]
    kpis: dict[str, float]


InventoryItemOut.model_rebuild()
InventoryDetailOut.model_rebuild()
LocationSummary.model_rebuild()