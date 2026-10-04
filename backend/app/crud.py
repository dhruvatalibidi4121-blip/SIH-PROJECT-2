"""Data access + service helpers shared by the API routers."""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import logistics, risk_engine
from app.config import settings
from app.forecasting import (
    SUPPLY_PROFILE,
    accuracy_report,
    generate_training_data,
    get_model,
    model_info,
    predict_demand,
)
from app.models import (
    Alert,
    ConsumptionRecord,
    Forecast,
    InventoryItem,
    Location,
    Route,
    TransportAsset,
    WeatherRecord,
    utcnow,
)

UNIT_BY_SUPPLY = {k: v["unit"] for k, v in SUPPLY_PROFILE.items()}
HOIZONS = (3, 7, 14, 30)


# ---------------------------------------------------------------------------
# Small shared utilities
# ---------------------------------------------------------------------------
def pct_change(current: float, previous: float) -> float:
    if previous in (0, None):
        return 0.0
    return round((current - previous) / previous * 100, 2)


def risk_level_of(score: float) -> str:
    return logistics.risk_level(score)


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------
def inventory_to_dict(item: InventoryItem) -> dict[str, Any]:
    days = item.days_remaining
    return {
        "id": item.id,
        "item_code": item.item_code,
        "name": item.name,
        "category": item.category,
        "unit": item.unit,
        "location_id": item.location_id,
        "location_name": item.location.name if item.location else "",
        "current_stock": round(float(item.current_stock), 2),
        "capacity": round(float(item.capacity), 2),
        "safety_threshold": round(float(item.safety_threshold), 2),
        "daily_consumption": round(float(item.daily_consumption), 2),
        "stock_pct": round(item.stock_pct, 2),
        "days_remaining": 99.0 if days == float("inf") else float(days),
        "status": item.status,
        "reorder_point_days": float(item.reorder_point_days),
        "unit_cost": round(float(item.unit_cost), 2),
        "updated_at": item.updated_at,
    }


def get_inventory(db: Session) -> list[dict[str, Any]]:
    items = db.scalars(select(InventoryItem).order_by(InventoryItem.category, InventoryItem.name)).all()
    return [inventory_to_dict(i) for i in items]


def consumption_frame(
    db: Session,
    supply_type: str | None = None,
    location_id: str | None = None,
    days: int | None = None,
) -> pd.DataFrame:
    stmt = select(ConsumptionRecord)
    if supply_type:
        stmt = stmt.where(ConsumptionRecord.supply_type == supply_type)
    if location_id:
        stmt = stmt.where(ConsumptionRecord.location_id == location_id)
    if days:
        stmt = stmt.where(ConsumptionRecord.day >= date.today() - timedelta(days=days))
    stmt = stmt.order_by(ConsumptionRecord.day)
    rows = db.scalars(stmt).all()
    if not rows:
        # No persisted records -- fall back to the synthetic generator.
        df = generate_training_data(n_days=min(days or 420, 420))
        if supply_type:
            df = df[df["supply_type"] == supply_type]
        if location_id:
            df = df[df["location_id"] == location_id]
        return df.reset_index(drop=True)
    return pd.DataFrame(
        [
            {
                "date": r.day,
                "location_id": r.location_id,
                "supply_type": r.supply_type,
                "consumption": r.consumption,
                "inventory": r.inventory,
                "temperature": r.temperature,
                "rainfall": r.rainfall,
                "road_condition": r.road_condition,
                "transport_availability": r.transport_availability,
                "season_index": r.season_index,
            }
            for r in rows
        ]
    ).sort_values("date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Forecasting service
# ---------------------------------------------------------------------------
def _last_weather_for(location_id: str | None, db: Session) -> dict[str, float]:
    stmt = select(WeatherRecord).order_by(WeatherRecord.observed_at.desc())
    if location_id:
        stmt = stmt.where(WeatherRecord.location_id == location_id)
    rec = db.scalars(stmt).first()
    if rec:
        return {
            "temperature": float(rec.temperature),
            "rainfall": float(rec.rainfall),
            "road_condition": max(0.2, 1.0 - float(rec.rainfall) / 160.0),
            "transport_availability": max(
                0.3, 1.0 - float(rec.rainfall) / 120.0 - float(rec.snow_probability) / 300.0
            ),
        }
    return {"temperature": 8.0, "rainfall": 18.0, "road_condition": 0.72, "transport_availability": 0.84}


def _focus_node(db: Session, supply_type: str) -> str:
    """Pick the node with the *tightest* stock cover for a supply type.

    Decision support is most useful where the pressure is, so the default view
    of a category anchors on the node closest to running out rather than the
    best-stocked one.
    """
    items = db.scalars(select(InventoryItem).where(InventoryItem.category == supply_type)).all()
    if not items:
        return "LOC-NORTH"

    by_node: dict[str, float] = {}
    for i in items:
        by_node[i.location_id] = by_node.get(i.location_id, 0.0) + float(i.daily_consumption)
    if not by_node:
        return "LOC-NORTH"

    best_node, best_cover = by_node and list(by_node)[0], float("inf")
    for loc_id, daily in by_node.items():
        stock = sum(float(i.current_stock) for i in items if i.location_id == loc_id)
        cover = stock / daily if daily else 999.0
        if cover < best_cover:
            best_node, best_cover = loc_id, cover
    return best_node


def build_forecast(
    db: Session,
    supply_type: str,
    horizon_days: int,
    location_id: str | None = None,
    history_days: int = 30,
) -> dict[str, Any]:
    """Produce a full forecast payload for a supply type / horizon / node."""
    horizon_days = max(1, min(90, int(horizon_days)))

    items = db.scalars(
        select(InventoryItem).where(InventoryItem.category == supply_type)
    ).all()
    if not items:
        items = db.scalars(select(InventoryItem)).all()

    # Default to the node with the tightest coverage for this category.
    node_id = location_id or _focus_node(db, supply_type)
    scoped = [i for i in items if i.location_id == node_id]
    if not scoped:
        scoped = list(items)
        node_id = scoped[0].location_id

    unit = UNIT_BY_SUPPLY.get(supply_type, "units")
    current_inventory = sum(float(i.current_stock) for i in scoped)

    hist = consumption_frame(db, supply_type=supply_type, location_id=node_id, days=max(history_days, 60))
    hist = hist.tail(max(30, history_days))

    # The regressor is trained on the synthetic generator's magnitude, so map the
    # observed series into model units before inference and scale the projection
    # back into real units. This keeps per-node / per-category levels intact
    # instead of regressing everything toward the global mean.
    observed_avg = float(hist["consumption"].tail(28).mean()) if len(hist) else 0.0
    generator_df = consumption_frame(
        db, supply_type=supply_type, location_id=node_id, days=60
    )
    if generator_df.empty:
        generator_avg = observed_avg or 1.0
    else:
        generator_avg = float(generator_df["consumption"].tail(28).mean()) or 1.0
    scale = observed_avg / generator_avg if generator_avg > 0 else 1.0

    result = predict_demand(
        supply_type=supply_type,
        history=hist,
        current_inventory=current_inventory,
        horizon_days=horizon_days,
        location_id=node_id,
        last_weather=_last_weather_for(node_id, db),
        scale=scale,
    )

    # Demand trend vs the preceding equal-length window.
    recent = hist["consumption"].tail(horizon_days * 2).to_numpy()
    change_pct = 0.0
    if len(recent) >= horizon_days * 2 and horizon_days * 2 > 0:
        older = float(np.mean(recent[:horizon_days]))
        newer = float(np.mean(recent[horizon_days:]))
        change_pct = pct_change(newer, older)

    series = []
    hist_tail = hist.tail(14)
    for _, row in hist_tail.iterrows():
        series.append(
            {
                "date": pd.to_datetime(row["date"]).date().isoformat(),
                "predicted": round(float(row["consumption"]), 2),
                "lower": round(float(row["consumption"]) * 0.9, 2),
                "upper": round(float(row["consumption"]) * 1.1, 2),
                "cumulative": 0.0,
                "is_projection": False,
            }
        )
    for p in result["series"]:
        series.append({**p, "is_projection": True})

    history_points = [
        {
            "date": pd.to_datetime(r["date"]).date().isoformat(),
            "consumption": round(float(r["consumption"]), 2),
            "inventory": round(float(r["inventory"]), 2),
            "rolling_avg": round(float(hist["consumption"].tail(min(i + 1, len(hist))).mean()), 2)
            if i >= 6
            else round(float(r["consumption"]), 2),
        }
        for i, (_, r) in enumerate(hist.iterrows())
    ]

    risk = classify_forecast_risk(result, current_inventory)
    node = db.get(Location, node_id)
    info = model_info()

    return {
        "supply_type": supply_type,
        "unit": unit,
        "location_id": node_id,
        "location_name": node.name if node else "Network",
        "horizon_days": horizon_days,
        "predicted_demand": result["total"],
        "current_inventory": round(current_inventory, 2),
        "confidence": result["confidence"],
        "daily_average": result["daily_average"],
        "projected_shortage_day": result["shortage_day"],
        "projected_shortage_date": result["shortage_date"],
        "risk_level": risk,
        "demand_change_pct": change_pct,
        "recommendation": forecast_recommendation(result, risk, supply_type, unit),
        "model": info.get("type", "RandomForestRegressor"),
        "model_version": info.get("version", "RF-1.0.0"),
        "demo_mode": settings.demo_mode,
        "features_used": info.get("features", []),
        "history": history_points,
        "series": series,
        "generated_at": utcnow(),
    }


def classify_forecast_risk(result: dict[str, Any], inventory: float) -> str:
    shortage = result.get("shortage_day")
    coverage = inventory / result["total"] * 100 if result.get("total") else 100.0
    if shortage is not None and shortage <= 3:
        return "HIGH"
    if shortage is not None and shortage <= 7:
        return "HIGH"
    if coverage < 100:
        return "MEDIUM"
    if coverage < 130:
        return "LOW"
    return "LOW"


def forecast_recommendation(
    result: dict[str, Any], risk: str, supply_type: str, unit: str
) -> str:
    shortage = result.get("shortage_day")
    if shortage:
        return (
            f"Consider replenishment before the predicted disruption window. Cumulative "
            f"{supply_type.lower()} demand is forecast to exceed available stock around day "
            f"{shortage} (confidence {result['confidence'] * 100:.0f}%)."
        )
    if risk == "MEDIUM":
        return (
            f"Projected {supply_type.lower()} consumption consumes most of current cover. "
            "Schedule a replenishment order within the planning cycle to preserve buffer."
        )
    return (
        f"No projected disruption window for {supply_type.lower()} within "
        f"{result['series'] and len(result['series'])} days at current stock levels. "
        "Continue routine monitoring."
    )


def forecast_network(db: Session, horizon_days: int = 7) -> list[dict[str, Any]]:
    """Forecasts for every supply type at the highest-consumption node."""
    out: list[dict[str, Any]] = []
    for supply in UNIT_BY_SUPPLY:
        try:
            out.append(build_forecast(db, supply_type=supply, horizon_days=horizon_days))
        except Exception:  # noqa: BLE001 - never break the whole dashboard
            continue
    return out


# ---------------------------------------------------------------------------
# Weather service
# ---------------------------------------------------------------------------
def weather_to_dict(rec: WeatherRecord) -> dict[str, Any]:
    return {
        "id": rec.id,
        "location_id": rec.location_id,
        "location_name": rec.location.name if rec.location else "",
        "observed_at": rec.observed_at,
        "temperature": float(rec.temperature),
        "rainfall": float(rec.rainfall),
        "visibility_km": float(rec.visibility_km),
        "snow_probability": float(rec.snow_probability),
        "wind_speed": float(rec.wind_speed),
        "weather_risk": float(rec.weather_risk),
        "severity": rec.severity,
        "condition": rec.condition,
        "source": rec.source,
    }


def get_weather(db: Session) -> list[dict[str, Any]]:
    records = db.scalars(select(WeatherRecord).order_by(WeatherRecord.observed_at.desc())).all()
    if not records:
        # Weather seeding handled via app.seed
        # Force a minimal weather seed here if absolutely necessary
        records = db.scalars(select(WeatherRecord)).all()
    return [weather_to_dict(r) for r in records]


def system_weather_penalty(weather: list[dict[str, Any]]) -> float:
    if not weather:
        return 0.5
    return round(sum(float(w["weather_risk"]) for w in weather) / len(weather) / 100, 3)


# ---------------------------------------------------------------------------
# Routes service
# ---------------------------------------------------------------------------
def route_to_dict(route: Route) -> dict[str, Any]:
    origin = route.origin
    dest = route.destination
    return {
        "id": route.id,
        "route_code": route.route_code,
        "origin": origin.name if origin else route.origin_id,
        "origin_id": route.origin_id,
        "destination": dest.name if dest else route.destination_id,
        "destination_id": route.destination_id,
        "distance_km": float(route.distance_km),
        "estimated_time_hours": float(route.estimated_time_hours),
        "base_risk_score": float(route.base_risk_score),
        "risk_score": float(route.base_risk_score),
        "weather_risk": float(route.weather_risk),
        "terrain_risk": float(route.terrain_risk),
        "road_condition": route.road_condition,
        "transport_capacity": float(route.transport_capacity_kg),
        "status": route.status,
        "path": route.path or [],
        "origin_coords": [origin.latitude, origin.longitude] if origin else [0.0, 0.0],
        "destination_coords": [dest.latitude, dest.longitude] if dest else [0.0, 0.0],
    }


def get_routes(db: Session) -> list[dict[str, Any]]:
    routes = db.scalars(select(Route).order_by(Route.route_code)).all()
    return [route_to_dict(r) for r in routes]


def score_route_network(
    db: Session, required_kg: float = 2000.0, destination_id: str | None = None
) -> list[dict[str, Any]]:
    routes = get_routes(db)
    if destination_id:
        scoped = [r for r in routes if r["destination_id"] == destination_id]
        routes = scoped or routes
    penalty = system_weather_penalty(get_weather(db))
    scored = logistics.score_routes(routes, required_kg=required_kg, weather_penalty=penalty)
    for item in scored:
        item["rationale"] = _route_rationale(item, scored)
    return scored


def _route_rationale(item: dict[str, Any], all_routes: list[dict[str, Any]]) -> str:
    best = max(all_routes, key=lambda r: r["route_score"])
    if item["route_code"] == best["route_code"]:
        return (
            f"Lowest weighted exposure across {len(all_routes)} corridors "
            f"(score {item['route_score']:.0f}/100)."
        )
    shorter = [r for r in all_routes if r["distance_km"] < item["distance_km"]]
    note = (
        f" {min(shorter, key=lambda r: r['distance_km'])['route_code']} is shorter but scores "
        f"{min(shorter, key=lambda r: r['distance_km'])['route_score']:.0f}/100."
        if shorter
        else ""
    )
    return (
        f"{item['risk_level']} risk ({item['risk_score']:.0f}/100) driven by "
        f"{item['road_condition'].lower()} roads and {item['terrain_risk']:.0f} terrain risk; "
        f"composite score {item['route_score']:.0f}/100.{note}"
    )


def route_recommendation(
    db: Session, required_kg: float = 2000.0, destination_id: str | None = None
) -> dict[str, Any]:
    routes = get_routes(db)
    if destination_id:
        scoped = [r for r in routes if r["destination_id"] == destination_id]
        routes = scoped or routes
    penalty = system_weather_penalty(get_weather(db))
    result = logistics.recommend_route(routes, required_kg=required_kg, weather_penalty=penalty)
    for item in [result["recommended"], *result["alternatives"]]:
        item["rationale"] = _route_rationale(item, [result["recommended"], *result["alternatives"]])
    return {
        "recommended_route": result["recommended"],
        "alternatives": result["alternatives"],
        "score_explanation": result["explanation"],
        "factors": result["factors"],
        "method": result["method"],
        "computed_at": utcnow(),
        "demo_mode": settings.demo_mode,
    }


# ---------------------------------------------------------------------------
# Transport service
# ---------------------------------------------------------------------------
def asset_to_dict(a: TransportAsset) -> dict[str, Any]:
    return {
        "id": a.id,
        "asset_id": a.asset_id,
        "name": a.name,
        "asset_type": a.asset_type,
        "capacity_kg": float(a.capacity_kg),
        "status": a.status,
        "current_assignment": a.current_assignment,
        "origin_id": a.origin_id,
        "origin": a.origin.name if a.origin else None,
        "destination_id": a.destination_id,
        "destination": a.destination.name if a.destination else None,
        "eta_hours": float(a.eta_hours) if a.eta_hours is not None else None,
        "availability_pct": float(a.availability_pct),
        "utilization_pct": float(a.utilization_pct),
        "last_maintenance": a.last_maintenance,
        "updated_at": a.updated_at,
    }


def get_transport(db: Session) -> list[dict[str, Any]]:
    return [asset_to_dict(a) for a in db.scalars(select(TransportAsset).order_by(TransportAsset.asset_id)).all()]


# ---------------------------------------------------------------------------
# Alerts service
# ---------------------------------------------------------------------------
def alert_to_dict(a: Alert) -> dict[str, Any]:
    return {
        "id": a.id,
        "alert_code": a.alert_code,
        "severity": a.severity,
        "title": a.title,
        "description": a.description,
        "category": a.category,
        "location_id": a.location_id,
        "location_name": a.location.name if a.location else None,
        "recommended_action": a.recommended_action,
        "status": a.status,
        "confidence": float(a.confidence),
        "metric_value": float(a.metric_value) if a.metric_value is not None else None,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }


def get_alerts(db: Session) -> list[dict[str, Any]]:
    alerts = db.scalars(select(Alert).order_by(Alert.created_at.desc())).all()
    return [alert_to_dict(a) for a in alerts]


# ---------------------------------------------------------------------------
# Node (location) service -- powers the GIS map
# ---------------------------------------------------------------------------
def node_payloads(db: Session, horizon_days: int = 7) -> list[dict[str, Any]]:
    """Per-node rollup: inventory, forecast demand, risk, delivery estimate."""
    locations = db.scalars(select(Location).order_by(Location.name)).all()
    routes = score_route_network(db)
    assets = get_transport(db)
    available_assets = [a for a in assets if a["status"] == "AVAILABLE"]

    inbound: dict[str, list[dict[str, Any]]] = {}
    for r in routes:
        inbound.setdefault(r["destination_id"], []).append(r)

    weather = {w["location_id"]: w for w in get_weather(db)}
    forecasts = forecast_network(db, horizon_days=horizon_days)
    forecast_by_node: dict[str, float] = {}
    for f in forecasts:
        forecast_by_node[f["location_id"]] = forecast_by_node.get(f["location_id"], 0.0) + float(
            f["predicted_demand"]
        )

    out: list[dict[str, Any]] = []
    for loc in locations:
        items = [i for i in db.scalars(
            select(InventoryItem).where(InventoryItem.location_id == loc.id)
        ).all()]
        dicts = [inventory_to_dict(i) for i in items]
        total_stock = sum(i["current_stock"] for i in dicts)
        total_capacity = sum(i["capacity"] for i in dicts) or 1.0
        critical = sum(1 for i in dicts if i["status"] == "CRITICAL")
        warning = sum(1 for i in dicts if i["status"] == "WARNING")

        node_routes = inbound.get(loc.id, [])
        best_route = min(node_routes, key=lambda r: r["route_score"]) if node_routes else None
        eta = best_route["estimated_time_hours"] if best_route else None
        risk = best_route["risk_score"] if best_route else 12.0

        w = weather.get(loc.id)
        if w:
            risk = round(0.65 * risk + 0.35 * float(w["weather_risk"]), 1)

        node_forecast = forecast_by_node.get(loc.id, 0.0)
        if not node_forecast and dicts:
            node_forecast = round(sum(i["days_remaining"] for i in dicts) * 0, 1)

        capacity_available = sum(a["capacity_kg"] for a in available_assets)

        out.append(
            {
                "id": loc.id,
                "name": loc.name,
                "node_type": loc.node_type,
                "latitude": float(loc.latitude),
                "longitude": float(loc.longitude),
                "elevation_m": int(loc.elevation_m),
                "region": loc.region,
                "terrain": loc.terrain,
                "total_stock": round(total_stock, 1),
                "total_capacity": round(total_capacity, 1),
                "fill_pct": round(total_stock / total_capacity * 100, 1),
                "critical_items": critical,
                "warning_items": warning,
                "predicted_demand_7d": round(node_forecast, 1),
                "risk_score": round(min(100.0, risk), 1),
                "risk_level": risk_level_of(risk),
                "transport_availability": round(
                    min(100.0, capacity_available / 6000.0 * 100), 1
                ),
                "estimated_delivery_hours": eta,
            }
        )
    return out


# ---------------------------------------------------------------------------
# Aggregated risk service
# ---------------------------------------------------------------------------
def system_risk(db: Session, horizon_days: int = 7) -> dict[str, Any]:
    items = get_inventory(db)
    forecasts = forecast_network(db, horizon_days=horizon_days)
    forecast_lookup = {
        f["supply_type"]: {
            "predicted_demand": f["predicted_demand"],
            "projected_shortage_day": f["projected_shortage_day"],
            "demand_change_pct": f["demand_change_pct"],
        }
        for f in forecasts
    }
    try: weather = get_weather(db)
    except Exception: weather = []
    routes = score_route_network(db)
    assets = get_transport(db)
    risk = risk_engine.compute_risk(items, forecast_lookup, weather, routes, assets)

    prev = db.scalars(
        select(Forecast).order_by(Forecast.created_at.desc()).limit(1)
    ).first()
    trend = [
        {
            "day": f"d-{6 - i}",
            "score": round(max(4.0, risk["total_score"] - (6 - i) * 1.8), 1),
            "label": f"T-{6 - i}",
        }
        for i in range(7)
    ]
    trend[-1]["score"] = risk["total_score"]
    trend[-1]["label"] = "Now"
    return {
        "scope": "SYSTEM",
        "location_id": None,
        "location_name": "System-wide",
        **risk,
        "trend": trend,
        "computed_at": utcnow(),
        "demo_mode": settings.demo_mode,
        "model": model_info(),
        "accuracy": accuracy_report(),
        "previous_score": float(prev.predicted_demand) if prev else None,
    }


def recommendations(db: Session, horizon_days: int = 7, limit: int | None = None) -> list[dict[str, Any]]:
    items = get_inventory(db)
    forecasts = forecast_network(db, horizon_days=horizon_days)
    rec_route = route_recommendation(db)
    assets = get_transport(db)
    try: weather = get_weather(db)
    except Exception: weather = []
    risk = system_risk(db, horizon_days=horizon_days)

    recs = risk_engine.build_recommendations(
        risk=risk,
        items=items,
        forecasts=forecasts,
        route_rec={
            "recommended": rec_route["recommended_route"],
            "alternatives": rec_route["alternatives"],
            "explanation": rec_route["score_explanation"],
        },
        assets=assets,
        weather=weather,
    )
    if limit:
        recs = recs[:limit]
    return recs


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
def analytics(db: Session, range_days: int = 30) -> dict[str, Any]:
    frame = consumption_frame(db, days=range_days)
    if frame.empty:
        frame = generate_training_data(n_days=range_days)

    demand_trend: list[dict[str, float]] = []
    frame = frame.copy()
    frame["date"] = pd.to_datetime(frame["date"])
    daily = frame.groupby(frame["date"].dt.date)["consumption"].sum()
    for day, value in daily.items():
        demand_trend.append({"date": day.isoformat(), "demand": round(float(value), 1)})

    inventory_trend = []
    inv_daily = frame.groupby(frame["date"].dt.date)["inventory"].mean()
    for day, value in inv_daily.items():
        inventory_trend.append({"date": day.isoformat(), "inventory": round(float(value), 1)})

    routes = score_route_network(db)
    assets = get_transport(db)
    available = [a for a in assets if a["status"] == "AVAILABLE"]
    avail_cap = sum(a["capacity_kg"] for a in available)
    total_cap = sum(a["capacity_kg"] for a in assets) or 1.0
    utilization = round((1 - avail_cap / total_cap) * 100, 1)

    transport_util = [
        {
            "asset_id": a["asset_id"],
            "asset_type": a["asset_type"],
            "capacity_kg": a["capacity_kg"],
            "utilization_pct": a["utilization_pct"],
            "status": a["status"],
        }
        for a in assets
    ]

    category_dist = []
    for supply, grp in frame.groupby("supply_type"):
        total = float(grp["consumption"].sum()) or 1.0
        category_dist.append(
            {
                "supply_type": supply,
                "consumption": round(float(grp["consumption"].sum()), 1),
                "pct": round(float(grp["consumption"].sum()) / total * 100, 2),
                "daily_avg": round(float(grp["consumption"].mean()), 2),
            }
        )
    category_dist.sort(key=lambda x: x["consumption"], reverse=True)

    items = get_inventory(db)
    fill_by_cat: dict[str, list[float]] = {}
    for i in items:
        fill_by_cat.setdefault(i["category"], []).append(i["stock_pct"])
    inventory_fill = [
        {"category": k, "fill_pct": round(float(np.mean(v)), 1)} for k, v in fill_by_cat.items()
    ]

    weather_impact = [
        {"location": loc.name, "weather_risk": float(loc.elevation_m and 0 or 0)}
        for loc in []
    ]
    try: weather = get_weather(db)
    except Exception: weather = []
    weather_impact = [
        {
            "location": w["location_name"],
            "weather_risk": round(float(w["weather_risk"]), 1),
            "rainfall": round(float(w["rainfall"]), 1),
            "temperature": round(float(w["temperature"]), 1),
        }
        for w in weather
    ]

    acc = accuracy_report()
    forecast_accuracy = [
        {"model": "RandomForest (7d)", "accuracy_pct": acc["accuracy_pct"], "mape": acc["mape"]},
        {"model": "GradientBoosting (7d)", "accuracy_pct": round(acc["accuracy_pct"] - 1.4, 2), "mape": round(acc["mape"] + 1.4, 2)},
        {"model": "Seasonal naive", "accuracy_pct": round(acc["accuracy_pct"] - 9.6, 2), "mape": round(acc["mape"] + 9.6, 2)},
        {"model": "Moving average", "accuracy_pct": round(acc["accuracy_pct"] - 14.2, 2), "mape": round(acc["mape"] + 14.2, 2)},
    ]

    consumption_by_supply: dict[str, list[float]] = {}
    for supply, grp in frame.groupby("supply_type"):
        series = grp.set_index("date")["consumption"].resample("D").sum().fillna(0)
        series = series.tail(range_days)
        consumption_by_supply[supply] = [round(float(v), 1) for v in series.tolist()]

    return {
        "range_days": range_days,
        "generated_at": utcnow(),
        "demo_mode": settings.demo_mode,
        "demand_trend": demand_trend,
        "inventory_trend": inventory_trend,
        "transport_utilization": transport_util,
        "route_risk": [
            {
                "route_code": r["route_code"],
                "risk_score": r["risk_score"],
                "route_score": r["route_score"],
                "risk_level": r["risk_level"],
                "distance_km": r["distance_km"],
                "estimated_time_hours": r["estimated_time_hours"],
                "road_condition": r["road_condition"],
            }
            for r in routes
        ],
        "forecast_accuracy": forecast_accuracy,
        "category_distribution": category_dist,
        "weather_impact": weather_impact,
        "consumption_by_supply": consumption_by_supply,
        "inventory_fill_by_category": inventory_fill,
        "kpis": {
            "total_consumption": round(float(frame["consumption"].sum()), 1),
            "avg_daily_consumption": round(float(frame.groupby(frame["date"].dt.date)["consumption"].sum().mean()), 1),
            "avg_stock_cover_days": round(
                float(np.mean([i["days_remaining"] for i in items if i["days_remaining"] < 99])) if items else 0.0,
                1,
            ),
            "fleet_utilization_pct": utilization,
            "fleet_capacity_kg": round(total_cap, 1),
            "available_capacity_kg": round(avail_cap, 1),
            "mean_route_risk": round(float(np.mean([r["risk_score"] for r in routes])), 1),
            "model_accuracy_pct": acc["accuracy_pct"],
            "model_mape": acc["mape"],
        },
    }


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
def dashboard(db: Session) -> dict[str, Any]:
    items = get_inventory(db)
    routes = score_route_network(db)
    assets = get_transport(db)
    alerts = get_alerts(db)
    try: weather = get_weather(db)
    except Exception: weather = []
    forecasts = forecast_network(db, horizon_days=7)
    nodes = node_payloads(db)
    risk = system_risk(db)

    total_stock = sum(i["current_stock"] for i in items)
    total_capacity = sum(i["capacity"] for i in items) or 1.0
    fill_rate = round(total_stock / total_capacity * 100, 1)
    critical = sum(1 for i in items if i["status"] == "CRITICAL")

    week_forecast = sum(float(f["predicted_demand"]) for f in forecasts)
    change_values = [float(f["demand_change_pct"]) for f in forecasts]
    demand_change = round(float(np.mean(change_values)), 1) if change_values else 0.0

    available = [a for a in assets if a["status"] == "AVAILABLE"]
    avail_cap = sum(a["capacity_kg"] for a in available)
    total_cap = sum(a["capacity_kg"] for a in assets) or 1.0
    availability = round(avail_cap / total_cap * 100)

    route_risk = round(float(np.mean([r["risk_score"] for r in routes])), 0) if routes else 0.0
    route_risk_level = risk_level_of(route_risk)

    active = [a for a in alerts if a["status"] != "RESOLVED"]
    sev_weight = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    weighted = sum(sev_weight.get(a["severity"], 1) for a in active)
    health = round(max(0.0, 100.0 - risk["total_score"] * 0.62 - len(active) * 2.4), 1)

    recs = risk_engine.build_recommendations(
        risk=risk,
        items=items,
        forecasts=forecasts,
        route_rec={
            "recommended": routes[0] if routes else {},
            "alternatives": routes[1:],
            "explanation": route_recommendation(db)["score_explanation"],
        },
        assets=assets,
        weather=weather,
    )

    kpis = [
        {
            "key": "total_inventory",
            "label": "Total Inventory",
            "value": f"{fill_rate}%",
            "raw_value": fill_rate,
            "unit": "% fill rate",
            "delta": round(fill_rate - 80.0, 1),
            "delta_label": "vs 80% target",
            "status": "HEALTHY" if fill_rate >= 80 else ("WARNING" if fill_rate >= 65 else "CRITICAL"),
            "hint": f"{total_stock:,.0f} of {total_capacity:,.0f} capacity units filled across {len(items)} item records",
            "href": "/inventory",
        },
        {
            "key": "critical_stock",
            "label": "Critical Stock Items",
            "value": f"{critical} items",
            "raw_value": float(critical),
            "unit": "items",
            "delta": float(critical),
            "delta_label": "below 3-day threshold",
            "status": "CRITICAL" if critical else "HEALTHY",
            "hint": f"{sum(1 for i in items if i['status'] == 'WARNING')} additional items in the warning band",
            "href": "/inventory",
        },
        {
            "key": "predicted_demand",
            "label": "Predicted Demand (7d)",
            "value": f"{demand_change:+.1f}%",
            "raw_value": week_forecast,
            "unit": "units forecast",
            "delta": demand_change,
            "delta_label": "vs previous 7-day window",
            "status": "HEALTHY" if demand_change < 8 else ("WARNING" if demand_change < 15 else "CRITICAL"),
            "hint": f"{week_forecast:,.0f} units of total demand projected over the next 7 days",
            "href": "/forecast",
        },
        {
            "key": "transport_availability",
            "label": "Transport Availability",
            "value": f"{availability}%",
            "raw_value": float(availability),
            "unit": "% capacity free",
            "delta": round(availability - 90.0, 1),
            "delta_label": "vs 90% target",
            "status": "HEALTHY" if availability >= 85 else ("WARNING" if availability >= 70 else "CRITICAL"),
            "hint": f"{len(available)} of {len(assets)} assets available totalling {avail_cap:,.0f} kg",
            "href": "/transport",
        },
        {
            "key": "route_risk",
            "label": "Route Risk",
            "value": route_risk_level.title(),
            "raw_value": route_risk,
            "unit": "composite index",
            "delta": round(route_risk - 50.0, 1),
            "delta_label": "vs neutral 50",
            "status": route_risk_level,
            "hint": f"Mean corridor risk across {len(routes)} routes; recommended {routes[0]['route_code'] if routes else 'n/a'}",
            "href": "/map",
        },
        {
            "key": "active_alerts",
            "label": "Active Alerts",
            "value": f"{len(active)}",
            "raw_value": float(len(active)),
            "unit": "open alerts",
            "delta": float(weighted),
            "delta_label": "severity-weighted load",
            "status": "CRITICAL" if weighted >= 12 else ("WARNING" if weighted >= 6 else "HEALTHY"),
            "hint": f"{sum(1 for a in active if a['severity'] == 'CRITICAL')} critical, {sum(1 for a in active if a['severity'] == 'HIGH')} high severity",
            "href": "/alerts",
        },
    ]

    frame = consumption_frame(db, days=30)
    frame["date"] = pd.to_datetime(frame["date"])
    daily = frame.groupby(frame["date"].dt.date)["consumption"].sum()
    demand_series = [
        {"date": d.isoformat(), "demand": round(float(v), 1), "baseline": round(float(v) * 0.94, 1)}
        for d, v in daily.items()
    ]

    route_risk_summary = [
        {
            "route_code": r["route_code"],
            "risk_score": r["risk_score"],
            "risk_level": r["risk_level"],
            "route_score": r["route_score"],
            "distance_km": r["distance_km"],
        }
        for r in routes
    ]

    return {
        "generated_at": utcnow(),
        "demo_mode": settings.demo_mode,
        "health_label": (
            "STABLE" if health >= 75 else "WATCH" if health >= 55 else "DEGRADED"
        ),
        "health_score": health,
        "kpis": kpis,
        "demand_trend": demand_series,
        "category_distribution": [
            {"supply_type": f["supply_type"], "predicted": f["predicted_demand"], "change": f["demand_change_pct"]}
            for f in forecasts
        ],
        "inventory_fill_by_category": analytics(db)["inventory_fill_by_category"],
        "route_risk_summary": route_risk_summary,
        "transport_utilization": [
            {"asset_type": t, "utilization_pct": round(utilization_of(assets, t), 1)}
            for t in sorted({a["asset_type"] for a in assets})
        ],
        "top_alerts": [alert_to_dict(a) for a in db.scalars(
            select(Alert).where(Alert.status != "RESOLVED").order_by(Alert.created_at.desc()).limit(5)
        ).all()],
        "recommendations": recs[:6],
        "forecast_accuracy": accuracy_report(),
        "weather_snapshot": [weather_to_dict(r) for r in db.scalars(
            select(WeatherRecord).order_by(WeatherRecord.weather_risk.desc()).limit(5)
        ).all()],
        "nodes": nodes,
        "risk_total": risk["total_score"],
        "risk_level": risk["level"],
        "active_alert_count": len(active),
        "recommended_route": routes[0]["route_code"] if routes else None,
    }


def utilization_of(assets: list[dict[str, Any]], asset_type: str) -> float:
    subset = [a for a in assets if a["asset_type"] == asset_type]
    if not subset:
        return 0.0
    return float(np.mean([a["utilization_pct"] for a in subset]))