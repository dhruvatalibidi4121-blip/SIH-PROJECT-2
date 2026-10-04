"""SQLAlchemy ORM models for the LOGISENSE AI prototype.

All records are synthetic demo data representing fictional logistics nodes.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# --------------------------------------------------------------------------
# Shared enumerations kept as plain strings (portable across SQLite/Postgres)
# --------------------------------------------------------------------------
SUPPLY_TYPES = ("Fuel", "Food", "Water", "Medical Supplies", "Spare Parts")
UNIT_BY_SUPPLY = {
    "Fuel": "L",
    "Food": "kg",
    "Water": "L",
    "Medical Supplies": "kits",
    "Spare Parts": "units",
}
STATUS_GREEN = "HEALTHY"
STATUS_AMBER = "WARNING"
STATUS_RED = "CRITICAL"
SEVERITY_LOW = "LOW"
SEVERITY_MEDIUM = "MEDIUM"
SEVERITY_HIGH = "HIGH"
SEVERITY_CRITICAL = "CRITICAL"


class Location(Base):
    """A fictional logistics node (hub, distribution point, forward node)."""

    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    node_type: Mapped[str] = mapped_column(String(32))  # HUB | DISTRIBUTION | FORWARD
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    elevation_m: Mapped[int] = mapped_column(Integer, default=0)
    region: Mapped[str] = mapped_column(String(80), default="Northern Sector")
    terrain: Mapped[str] = mapped_column(String(48), default="Plains")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    inventory: Mapped[list["InventoryItem"]] = relationship(
        back_populates="location", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def coordinates(self) -> list[float]:
        return [self.latitude, self.longitude]


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(40), index=True)
    unit: Mapped[str] = mapped_column(String(12))
    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), index=True)
    current_stock: Mapped[float] = mapped_column(Float)
    capacity: Mapped[float] = mapped_column(Float)
    safety_threshold: Mapped[float] = mapped_column(Float)
    daily_consumption: Mapped[float] = mapped_column(Float)
    unit_cost: Mapped[float] = mapped_column(Float, default=1.0)
    reorder_point_days: Mapped[float] = mapped_column(Float, default=7.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    location: Mapped[Location] = relationship(back_populates="inventory", lazy="selectin")

    @property
    def days_remaining(self) -> float:
        if self.daily_consumption <= 0:
            return float("inf")
        return round(self.current_stock / self.daily_consumption, 2)

    @property
    def stock_pct(self) -> float:
        if self.capacity <= 0:
            return 0.0
        return round((self.current_stock / self.capacity) * 100, 2)

    @property
    def status(self) -> str:
        d = self.days_remaining
        if d < 3:
            return STATUS_RED
        if d <= 7:
            return STATUS_AMBER
        return STATUS_GREEN


class ConsumptionRecord(Base):
    """Daily historical consumption + environmental context (ML features)."""

    __tablename__ = "consumption_records"
    __table_args__ = (UniqueConstraint("day", "location_id", "supply_type", name="uq_consumption"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), index=True)
    supply_type: Mapped[str] = mapped_column(String(40), index=True)
    consumption: Mapped[float] = mapped_column(Float)
    inventory: Mapped[float] = mapped_column(Float)
    temperature: Mapped[float] = mapped_column(Float)
    rainfall: Mapped[float] = mapped_column(Float)
    road_condition: Mapped[float] = mapped_column(Float)
    transport_availability: Mapped[float] = mapped_column(Float)
    season_index: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TransportAsset(Base):
    __tablename__ = "transport_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(48))
    asset_type: Mapped[str] = mapped_column(String(40))
    capacity_kg: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), index=True)  # AVAILABLE | IN_TRANSIT | MAINTENANCE
    current_assignment: Mapped[str | None] = mapped_column(String(80), nullable=True)
    origin_id: Mapped[str | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    destination_id: Mapped[str | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    eta_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    availability_pct: Mapped[float] = mapped_column(Float, default=100.0)
    utilization_pct: Mapped[float] = mapped_column(Float, default=0.0)
    last_maintenance: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    origin: Mapped[Location | None] = relationship(foreign_keys=[origin_id], lazy="selectin")
    destination: Mapped[Location | None] = relationship(
        foreign_keys=[destination_id], lazy="selectin"
    )


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    route_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    origin_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), index=True)
    destination_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), index=True)
    distance_km: Mapped[float] = mapped_column(Float)
    estimated_time_hours: Mapped[float] = mapped_column(Float)
    base_risk_score: Mapped[float] = mapped_column(Float)
    weather_risk: Mapped[float] = mapped_column(Float)
    terrain_risk: Mapped[float] = mapped_column(Float)
    road_condition: Mapped[str] = mapped_column(String(32))
    transport_capacity_kg: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), default="OPEN")
    path: Mapped[list[Any]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    origin: Mapped[Location] = relationship(
        foreign_keys=[origin_id], lazy="selectin", primaryjoin="Route.origin_id==Location.id"
    )
    destination: Mapped[Location] = relationship(
        foreign_keys=[destination_id],
        lazy="selectin",
        primaryjoin="Route.destination_id==Location.id",
    )


class WeatherRecord(Base):
    __tablename__ = "weather_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), index=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    temperature: Mapped[float] = mapped_column(Float)
    rainfall: Mapped[float] = mapped_column(Float)
    visibility_km: Mapped[float] = mapped_column(Float)
    snow_probability: Mapped[float] = mapped_column(Float)
    wind_speed: Mapped[float] = mapped_column(Float)
    weather_risk: Mapped[float] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String(16), default=SEVERITY_MEDIUM)
    source: Mapped[str] = mapped_column(String(24), default="SYNTHETIC")
    condition: Mapped[str] = mapped_column(String(48), default="Overcast")

    location: Mapped[Location] = relationship(lazy="selectin")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    severity: Mapped[str] = mapped_column(String(16), index=True)
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32), default="General")
    location_id: Mapped[str | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    recommended_action: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="NEW", index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.75)
    metric_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    location: Mapped[Location | None] = relationship(lazy="selectin")


class Forecast(Base):
    """Persisted output of the ML forecasting engine."""

    __tablename__ = "forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supply_type: Mapped[str] = mapped_column(String(40), index=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), index=True)
    horizon_days: Mapped[int] = mapped_column(Integer, index=True)
    predicted_demand: Mapped[float] = mapped_column(Float)
    current_inventory: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    projected_shortage_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    projected_shortage_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(16), default=SEVERITY_MEDIUM)
    model_version: Mapped[str] = mapped_column(String(24), default="RF-1.0.0")
    daily_series: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    location: Mapped[Location] = relationship(lazy="selectin")


class RiskSnapshot(Base):
    """Composite risk breakdown produced by the risk engine."""

    __tablename__ = "risk_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scope: Mapped[str] = mapped_column(String(32), default="SYSTEM")
    location_id: Mapped[str | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    total_score: Mapped[float] = mapped_column(Float)
    level: Mapped[str] = mapped_column(String(16))
    inventory_score: Mapped[float] = mapped_column(Float)
    demand_score: Mapped[float] = mapped_column(Float)
    weather_score: Mapped[float] = mapped_column(Float)
    route_score: Mapped[float] = mapped_column(Float)
    transport_score: Mapped[float] = mapped_column(Float)
    drivers: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)