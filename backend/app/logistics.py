"""Logistics / route-optimisation engine.

All routes, distances and nodes are fictional demonstration data. The
recommendation engine scores candidate routes on a weighted blend of transit
time, composite risk, weather exposure, terrain difficulty, road condition and
transport capacity headroom.
"""

from __future__ import annotations

import math
from typing import Any, Iterable

# ---------------------------------------------------------------------------
# Weights for the multi-criteria route score (lower is better)
# ---------------------------------------------------------------------------
ROUTE_WEIGHTS: dict[str, float] = {
    "distance": 0.16,
    "time": 0.24,
    "risk": 0.32,
    "weather": 0.10,
    "terrain": 0.08,
    "road": 0.06,
    "capacity": 0.04,
}

SPEED_PROFILE = {"GOOD": 62.0, "FAIR": 46.0, "POOR": 30.0, "SEVERE": 22.0}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def risk_level(score: float) -> str:
    """Map a 0-100 risk score onto the four standard bands."""
    if score < 30:
        return "LOW"
    if score < 61:
        return "MEDIUM"
    if score < 81:
        return "HIGH"
    return "CRITICAL"


def estimate_transit_hours(distance_km: float, road_condition: str, weather_penalty: float) -> float:
    """Base speed from road quality, degraded by weather."""
    base_speed = SPEED_PROFILE.get(road_condition.upper(), 40.0)
    effective = max(10.0, base_speed * (1.0 - 0.45 * weather_penalty))
    return round(distance_km / effective + 0.6, 2)


def composite_risk(route: dict[str, Any], weather_penalty: float) -> float:
    """Blend stored risk factors with live weather into a single 0-100 score."""
    base = float(route.get("base_risk_score", route.get("risk_score", 30.0)))
    weather = float(route.get("weather_risk", 20.0)) * (0.65 + 0.7 * weather_penalty)
    terrain = float(route.get("terrain_risk", 20.0))
    road_map = {"GOOD": 8.0, "FAIR": 22.0, "POOR": 45.0, "SEVERE": 68.0}
    road = road_map.get(str(route.get("road_condition", "FAIR")).upper(), 30.0)
    return round(min(100.0, 0.55 * base + 0.22 * weather + 0.13 * terrain + 0.10 * road), 2)


def _capacity_headroom_pct(route: dict[str, Any], required_kg: float) -> float:
    capacity = float(route.get("transport_capacity", route.get("transport_capacity_kg", 1000.0)))
    if capacity <= 0:
        return 0.0
    return round(max(0.0, min(100.0, (capacity - required_kg) / capacity * 100)), 2)


def normalise(value: float, values: Iterable[float]) -> float:
    """Min-max normalisation to 0-100 (higher value -> higher sub-risk)."""
    vals = [v for v in values if v is not None]
    if not vals:
        return 50.0
    lo, hi = min(vals), max(vals)
    if hi - lo < 1e-9:
        return 50.0
    return round((value - lo) / (hi - lo) * 100, 2)


def score_routes(
    routes: list[dict[str, Any]],
    required_kg: float = 2000.0,
    weather_penalty: float = 0.5,
) -> list[dict[str, Any]]:
    """Score every route. Returns copies enriched with score fields."""
    if not routes:
        return []

    distances = [float(r["distance_km"]) for r in routes]
    times = [float(r["estimated_time_hours"]) for r in routes]

    scored: list[dict[str, Any]] = []
    for r in routes:
        item = dict(r)
        distance = float(item["distance_km"])
        travel_time = float(item["estimated_time_hours"])
        risk = composite_risk(item, weather_penalty)
        headroom = _capacity_headroom_pct(item, required_kg)

        n_dist = normalise(distance, distances)
        n_time = normalise(travel_time, times)
        n_risk = normalise(risk, [composite_risk(x, weather_penalty) for x in routes])

        score = (
            ROUTE_WEIGHTS["distance"] * n_dist
            + ROUTE_WEIGHTS["time"] * n_time
            + ROUTE_WEIGHTS["risk"] * n_risk
            + ROUTE_WEIGHTS["weather"] * min(100.0, float(item["weather_risk"]) * (0.65 + 0.7 * weather_penalty))
            + ROUTE_WEIGHTS["terrain"] * float(item["terrain_risk"])
            + ROUTE_WEIGHTS["road"]
            * {"GOOD": 6.0, "FAIR": 24.0, "POOR": 48.0, "SEVERE": 70.0}
            .get(str(item["road_condition"]).upper(), 30.0)
            + ROUTE_WEIGHTS["capacity"] * (100.0 - headroom)
        )

        item.update(
            {
                "risk_score": risk,
                "risk_level": risk_level(risk),
                "route_score": round(score, 2),
                "capacity_headroom_pct": headroom,
                "capacity_sufficient": headroom > 0,
            }
        )
        scored.append(item)

    scored.sort(key=lambda x: x["route_score"])
    best = scored[0]["route_score"]
    worst = scored[-1]["route_score"]
    span = (worst - best) or 1.0
    for item in scored:
        # 100 = best, 0 = worst. Easier to reason about in the UI.
        item["route_score"] = round(100.0 - ((item["route_score"] - best) / span) * 100, 2)
    return scored


def _factor_explanation(recommended: dict[str, Any], others: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    shorter = [o for o in others if float(o["distance_km"]) < float(recommended["distance_km"])]
    faster = [o for o in others if float(o["estimated_time_hours"]) < float(recommended["estimated_time_hours"])]

    if shorter:
        shortest = min(shorter, key=lambda o: o["distance_km"])
        parts.append(
            f"Although {recommended['route_code']} is "
            f"{float(recommended['distance_km']) - float(shortest['distance_km']):.0f} km longer than "
            f"{shortest['route_code']}, its combined risk is "
            f"{float(shortest['risk_score']) - float(recommended['risk_score']):.0f} points lower."
        )
    if faster:
        quick = min(faster, key=lambda o: o["estimated_time_hours"])
        parts.append(
            f"{quick['route_code']} arrives ~"
            f"{float(recommended['estimated_time_hours']) - float(quick['estimated_time_hours']):.1f} h sooner "
            f"but carries {quick['risk_level'].lower()} risk from "
            f"{quick['road_condition'].lower()} road conditions."
        )
    if not parts:
        parts.append(
            f"{recommended['route_code']} offers the best balance of transit time and exposure across "
            f"the candidate set."
        )
    parts.append(
        f"Weighted score {recommended['route_score']:.0f}/100 across distance (16%), transit time (24%), "
        f"composite risk (32%), weather (10%), terrain (8%), road condition (6%) and capacity headroom (4%)."
    )
    return " ".join(parts)


def recommend_route(
    routes: list[dict[str, Any]],
    required_kg: float = 2000.0,
    weather_penalty: float = 0.5,
) -> dict[str, Any]:
    """Produce the recommended route plus a human-readable explanation."""
    scored = score_routes(routes, required_kg=required_kg, weather_penalty=weather_penalty)
    if not scored:
        raise ValueError("No candidate routes available for recommendation")

    best = scored[0]
    explanation = _factor_explanation(best, scored[1:])
    return {
        "recommended": best,
        "alternatives": scored[1:],
        "explanation": explanation,
        "factors": {
            "distance": ROUTE_WEIGHTS["distance"],
            "time": ROUTE_WEIGHTS["time"],
            "risk": ROUTE_WEIGHTS["risk"],
            "weather": ROUTE_WEIGHTS["weather"],
            "terrain": ROUTE_WEIGHTS["terrain"],
            "road_condition": ROUTE_WEIGHTS["road"],
            "capacity": ROUTE_WEIGHTS["capacity"],
        },
        "method": "Weighted multi-criteria route score (normalised min-max)",
    }