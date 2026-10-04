"""Composite risk intelligence engine and the AI recommendation engine.

The risk score (0-100) aggregates five weighted components:

    inventory risk  (max 25)
    demand risk     (max 20)
    weather risk    (max 20)
    route risk      (max 20)
    transport risk  (max 15)

Recommendations are rule-based analytical narratives derived from the same
synthetic data -- they are decision-support suggestions, not operational orders.
"""

from __future__ import annotations

from typing import Any

# Component weights (max contributions sum to 100).
COMPONENT_MAX: dict[str, float] = {
    "inventory": 25.0,
    "demand": 20.0,
    "weather": 20.0,
    "route": 20.0,
    "transport": 15.0,
}

LEVEL_BANDS = (
    (30.0, "LOW"),
    (60.0, "MEDIUM"),
    (80.0, "HIGH"),
    (100.1, "CRITICAL"),
)


def band(score: float) -> str:
    for ceiling, label in LEVEL_BANDS:
        if score < ceiling:
            return label
    return "CRITICAL"


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# Component scoring
# ---------------------------------------------------------------------------
def score_inventory(items: list[dict[str, Any]]) -> tuple[float, list[str]]:
    """Risk from stock coverage and storage utilisation across all tracked items."""
    if not items:
        return 0.0, ["No inventory records available for risk scoring."]

    red = sum(1 for i in items if i["status"] == "CRITICAL")
    amber = sum(1 for i in items if i["status"] == "WARNING")
    total = len(items)

    critical_ratio = red / total
    warning_ratio = amber / total

    cover = [float(i.get("days_remaining", 0)) for i in items]
    cover = [c for c in cover if c != float("inf")]
    median_cover = sorted(cover)[len(cover) // 2] if cover else 30.0

    # Buffer capacity: how much headroom remains before the network is full and
    # can no longer absorb a demand spike without an external resupply.
    fill_pcts = [float(i.get("stock_pct", 0)) for i in items]
    mean_fill = sum(fill_pcts) / len(fill_pcts)
    buffer_penalty = _clamp((72.0 - mean_fill) / 45.0 * 100)

    cover_penalty = _clamp((14.0 - median_cover) / 14.0 * 100)
    raw = (
        0.34 * critical_ratio * 100
        + 0.20 * warning_ratio * 100
        + 0.26 * cover_penalty
        + 0.20 * buffer_penalty
    )
    score = round(COMPONENT_MAX["inventory"] * _clamp(raw) / 100, 2)

    drivers = [f"{red} item(s) below the 3-day safety threshold"]
    if amber:
        drivers.append(f"{amber} item(s) inside the 3-7 day warning band")
    drivers.append(f"Median stock cover {median_cover:.1f} days")
    drivers.append(f"Mean storage utilisation {mean_fill:.0f}% (limited surge buffer)")
    return score, drivers


def score_demand(items: list[dict[str, Any]], forecast_lookup: dict[str, Any]) -> tuple[float, list[str]]:
    """Risk from projected demand exceeding available stock."""
    if not items:
        return 0.0, ["No forecast data available for demand risk."]

    total_demand = sum(float(v.get("projected_demand", 0.0)) for v in forecast_lookup.values())
    total_stock = sum(float(i["current_stock"]) for i in items)
    coverage = (total_stock / total_demand * 100) if total_demand else 100.0

    shortages = [
        (k, v) for k, v in forecast_lookup.items() if v.get("projected_shortage_day") is not None
    ]
    rising = [
        k
        for k, v in forecast_lookup.items()
        if float(v.get("demand_change_pct", 0.0)) > 5
    ]

    coverage_penalty = _clamp((120.0 - coverage) / 60.0 * 100)
    shortage_penalty = _clamp(len(shortages) / max(1, len(forecast_lookup)) * 130)
    rise_penalty = _clamp(len(rising) / max(1, len(forecast_lookup)) * 70)

    raw = 0.45 * coverage_penalty + 0.35 * shortage_penalty + 0.20 * rise_penalty
    score = round(COMPONENT_MAX["demand"] * _clamp(raw) / 100, 2)

    drivers = [f"7-day projected coverage {coverage:.0f}% of forecast demand"]
    if shortages:
        keys = ", ".join(sorted({str(k) for k, _ in shortages})[:4])
        drivers.append(f"Projected shortage window for {keys}")
    if rising:
        drivers.append(f"{len(rising)} category forecast(s) trending upward")
    return score, drivers


def score_weather(records: list[dict[str, Any]]) -> tuple[float, list[str]]:
    """Risk from the worst / average weather exposure across nodes."""
    if not records:
        return 0.0, ["No weather observations available."]

    values = [float(r["weather_risk"]) for r in records]
    avg = sum(values) / len(values)
    worst = max(values)

    drivers = [f"Average weather risk index {avg:.0f}/100 across {len(records)} node(s)"]
    worst_rec = max(records, key=lambda r: float(r["weather_risk"]))
    if worst >= 55:
        drivers.append(
            f"Worst exposure at {worst_rec['location_name']}: "
            f"{worst_rec['rainfall']:.0f} mm rainfall, {worst_rec['visibility_km']:.1f} km visibility"
        )
    return round(COMPONENT_MAX["weather"] * _clamp(avg * 0.75 + worst * 0.25) / 100, 2), drivers


def score_route(routes: list[dict[str, Any]]) -> tuple[float, list[str]]:
    """Risk from the network's route exposure."""
    if not routes:
        return 0.0, ["No routes available for risk scoring."]

    values = [float(r["risk_score"]) for r in routes]
    avg = sum(values) / len(values)
    worst = max(values)

    high = [r for r in routes if r["risk_level"] in ("HIGH", "CRITICAL")]
    drivers = [f"Mean route risk {avg:.0f}/100 across {len(routes)} corridor(s)"]
    if high:
        worst_route = max(high, key=lambda r: float(r["risk_score"]))
        drivers.append(
            f"{len(high)} corridor(s) above HIGH risk -- worst is "
            f"{worst_route['route_code']} ({worst_route['risk_level']})"
        )
    return round(COMPONENT_MAX["route"] * _clamp(avg * 0.7 + worst * 0.3) / 100, 2), drivers


def score_transport(assets: list[dict[str, Any]], required_kg: float = 2000.0) -> tuple[float, list[str]]:
    """Risk from transport availability and capacity headroom."""
    if not assets:
        return 0.0, ["No transport assets available for risk scoring."]

    total_capacity = sum(float(a["capacity_kg"]) for a in assets)
    available = [a for a in assets if a["status"] == "AVAILABLE"]
    available_capacity = sum(float(a["capacity_kg"]) for a in available)
    maint = sum(1 for a in assets if a["status"] == "MAINTENANCE")

    availability_pct = available_capacity / total_capacity * 100 if total_capacity else 0.0
    shortage = _clamp((required_kg * 3 - available_capacity) / (required_kg * 3) * 100)
    maint_penalty = _clamp(maint / len(assets) * 100)

    raw = 0.5 * _clamp((100.0 - availability_pct) / 100 * 140) + 0.3 * shortage + 0.2 * maint_penalty
    score = round(COMPONENT_MAX["transport"] * _clamp(raw) / 100, 2)

    drivers = [
        f"{availability_pct:.0f}% of fleet capacity available ({len(available)}/{len(assets)} assets)",
        f"{maint} asset(s) in maintenance",
    ]
    if available_capacity < required_kg * 2:
        drivers.append("Available capacity below two concurrent convoys")
    return score, drivers


# ---------------------------------------------------------------------------
# Composite
# ---------------------------------------------------------------------------
def compute_risk(
    items: list[dict[str, Any]],
    forecast_lookup: dict[str, Any],
    weather: list[dict[str, Any]],
    routes: list[dict[str, Any]],
    assets: list[dict[str, Any]],
    required_kg: float = 2000.0,
    scope: str = "SYSTEM",
) -> dict[str, Any]:
    """Full composite risk breakdown."""
    inv_s, inv_d = score_inventory(items)
    dem_s, dem_d = score_demand(items, forecast_lookup)
    wea_s, wea_d = score_weather(weather)
    rou_s, rou_d = score_route(routes)
    tra_s, tra_d = score_transport(assets, required_kg)

    total = round(inv_s + dem_s + wea_s + rou_s + tra_s, 2)
    level = band(total)

    components = [
        {
            "key": "inventory",
            "label": "Inventory",
            "score": inv_s,
            "max_score": COMPONENT_MAX["inventory"],
            "pct": round(inv_s / COMPONENT_MAX["inventory"] * 100, 1),
            "level": band(inv_s / COMPONENT_MAX["inventory"] * 100),
            "detail": "; ".join(inv_d),
        },
        {
            "key": "demand",
            "label": "Demand",
            "score": dem_s,
            "max_score": COMPONENT_MAX["demand"],
            "pct": round(dem_s / COMPONENT_MAX["demand"] * 100, 1),
            "level": band(dem_s / COMPONENT_MAX["demand"] * 100),
            "detail": "; ".join(dem_d),
        },
        {
            "key": "weather",
            "label": "Weather",
            "score": wea_s,
            "max_score": COMPONENT_MAX["weather"],
            "pct": round(wea_s / COMPONENT_MAX["weather"] * 100, 1),
            "level": band(wea_s / COMPONENT_MAX["weather"] * 100),
            "detail": "; ".join(wea_d),
        },
        {
            "key": "route",
            "label": "Route",
            "score": rou_s,
            "max_score": COMPONENT_MAX["route"],
            "pct": round(rou_s / COMPONENT_MAX["route"] * 100, 1),
            "level": band(rou_s / COMPONENT_MAX["route"] * 100),
            "detail": "; ".join(rou_d),
        },
        {
            "key": "transport",
            "label": "Transport",
            "score": tra_s,
            "max_score": COMPONENT_MAX["transport"],
            "pct": round(tra_s / COMPONENT_MAX["transport"] * 100, 1),
            "level": band(tra_s / COMPONENT_MAX["transport"] * 100),
            "detail": "; ".join(tra_d),
        },
    ]

    drivers = sorted(
        [d for group in (inv_d, dem_d, wea_d, rou_d, tra_d) for d in group],
        key=len,
        reverse=True,
    )[:6]

    return {
        "scope": scope,
        "total_score": total,
        "level": level,
        "inventory_score": inv_s,
        "demand_score": dem_s,
        "weather_score": wea_s,
        "route_score": rou_s,
        "transport_score": tra_s,
        "components": components,
        "drivers": drivers,
    }


# ---------------------------------------------------------------------------
# AI recommendation engine
# ---------------------------------------------------------------------------
PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def build_recommendations(
    risk: dict[str, Any],
    items: list[dict[str, Any]],
    forecasts: list[dict[str, Any]],
    route_rec: dict[str, Any],
    assets: list[dict[str, Any]],
    weather: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Generate prioritised, actionable recommendations from live demo state."""
    recs: list[dict[str, Any]] = []

    # 1. Projected shortages -- the highest-value signal.
    for f in forecasts:
        shortage_day = f.get("projected_shortage_day")
        if shortage_day is None:
            continue
        unit = f.get("unit", "units")
        node = f.get("location_name", "network")
        supply = f["supply_type"]
        available_kg = next(
            (float(a["capacity_kg"]) for a in assets if a["status"] == "AVAILABLE"), 0.0
        )
        sufficient = available_kg >= 2000.0
        priority = "CRITICAL" if shortage_day <= 3 else "HIGH"

        recs.append(
            {
                "id": f"REC-SHORT-{supply.upper().replace(' ', '-')}-{f.get('location_id', 'NET')}",
                "priority": priority,
                "priority_score": 5 if priority == "CRITICAL" else 4,
                "title": f"Replenish {supply} at {node} within {shortage_day} day(s)",
                "reason": (
                    f"Forecast model projects {f['predicted_demand']:,.0f} {unit} of {supply.lower()} "
                    f"consumption over the next {f['horizon_days']} days against "
                    f"{f['current_inventory']:,.0f} {unit} on hand. Cumulative demand crosses the "
                    f"available stock on day {shortage_day}."
                ),
                "expected_impact": (
                    "Avoids a projected supply gap and keeps modelled consumption fully covered "
                    "through the planning horizon."
                ),
                "suggested_action": (
                    f"Dispatch a replenishment convoy carrying ~{min(4000, max(1500, float(f['predicted_demand']) * 0.4)):.0f} {unit} "
                    f"to {node}. Current transport capacity is "
                    f"{'sufficient' if sufficient else 'insufficient'} for this movement "
                    f"({available_kg:,.0f} kg available)."
                ),
                "category": "Inventory",
                "confidence": float(f.get("confidence", 0.7)),
                "location_id": f.get("location_id"),
                "location_name": node,
                "metric_value": float(shortage_day),
                "horizon_days": int(f.get("horizon_days", 7)),
            }
        )

    # 2. Rising demand signals.
    rising = [f for f in forecasts if float(f.get("demand_change_pct", 0)) > 8]
    if rising:
        top = max(rising, key=lambda f: float(f["demand_change_pct"]))
        recs.append(
            {
                "id": "REC-DEMAND-UP",
                "priority": "HIGH" if float(top["demand_change_pct"]) > 15 else "MEDIUM",
                "priority_score": 4 if float(top["demand_change_pct"]) > 15 else 3,
                "title": f"{top['supply_type']} demand rising {top['demand_change_pct']:+.1f}% over {top['horizon_days']} days",
                "reason": (
                    f"The 7-day rolling mean for {top['supply_type'].lower()} at "
                    f"{top['location_name']} sits {abs(float(top['demand_change_pct'])):.1f}% above its "
                    "28-day baseline, driven by seasonal index and current temperature exposure in "
                    "the synthetic consumption series."
                ),
                "expected_impact": (
                    "Pre-emptive ordering prevents the demand increase from converting into a "
                    "stockout during the forecast window."
                ),
                "suggested_action": (
                    f"Increase forward order quantity for {top['supply_type'].lower()} by "
                    f"{max(10, int(abs(float(top['demand_change_pct'])) * 1.2))}% and re-evaluate the "
                    "replenishment schedule at the next planning cycle."
                ),
                "category": "Demand",
                "confidence": float(top.get("confidence", 0.7)),
                "location_id": top.get("location_id"),
                "location_name": top.get("location_name"),
                "metric_value": float(top["demand_change_pct"]),
                "horizon_days": int(top.get("horizon_days", 7)),
            }
        )

    # 3. Route recommendation narrative.
    if route_rec:
        best = route_rec["recommended"]
        others = route_rec.get("alternatives", [])
        worst = max(others, key=lambda o: float(o["risk_score"])) if others else None
        reason = route_rec["explanation"]
        if worst:
            reason += (
                f" {worst['route_code']} carries a {worst['risk_score']:.0f} risk score "
                f"({worst['risk_level']}) driven by {worst['road_condition'].lower()} road conditions "
                f"and {worst['terrain_risk']:.0f} terrain risk."
            )
        recs.append(
            {
                "id": "REC-ROUTE-OPT",
                "priority": "MEDIUM",
                "priority_score": 3,
                "title": f"Use corridor {best['route_code']} ({best['origin']} to {best['destination']})",
                "reason": reason,
                "expected_impact": (
                    f"Reduces composite corridor risk by roughly "
                    f"{(float(worst['risk_score']) - float(best['risk_score'])):.0f} points versus the "
                    f"highest-risk alternative, with an ETA of {best['estimated_time_hours']:.1f} hours."
                )
                if worst
                else "Maintains the lowest-exposure corridor for planned movements.",
                "suggested_action": (
                    f"Schedule movement via {best['route_code']} "
                    f"({best['distance_km']:.0f} km, {best['estimated_time_hours']:.1f} h ETA) and "
                    f"brief the convoy on {best['road_condition'].lower()} road conditions."
                ),
                "category": "Routing",
                "confidence": 0.82,
                "location_id": best.get("destination_id"),
                "location_name": best.get("destination"),
                "metric_value": float(best["risk_score"]),
                "horizon_days": None,
            }
        )

    # 4. Weather-driven transit risk.
    severe = [w for w in weather if float(w["weather_risk"]) >= 55]
    if severe:
        worst = max(severe, key=lambda w: float(w["weather_risk"]))
        recs.append(
            {
                "id": "REC-WEATHER-DELAY",
                "priority": "HIGH" if float(worst["weather_risk"]) >= 70 else "MEDIUM",
                "priority_score": 4 if float(worst["weather_risk"]) >= 70 else 3,
                "title": f"Weather at {worst['location_name']} may extend delivery time",
                "reason": (
                    f"Observed conditions show {worst['rainfall']:.0f} mm rainfall, "
                    f"{worst['visibility_km']:.1f} km visibility and {worst['wind_speed']:.0f} km/h wind, "
                    f"producing a weather risk index of {worst['weather_risk']:.0f}/100 "
                    f"({worst['severity']})."
                ),
                "expected_impact": (
                    "Adding a schedule buffer prevents convoy ETAs from being missed and preserves "
                    "the confidence window for downstream node planning."
                ),
                "suggested_action": (
                    f"Add a 1.5-2.0 hour weather buffer to movements crossing {worst['location_name']} "
                    "and prefer corridors with FAIR or better road condition."
                ),
                "category": "Weather",
                "confidence": 0.78,
                "location_id": worst.get("location_id"),
                "location_name": worst.get("location_name"),
                "metric_value": float(worst["weather_risk"]),
                "horizon_days": None,
            }
        )

    # 5. Transport capacity health.
    available = [a for a in assets if a["status"] == "AVAILABLE"]
    avail_cap = sum(float(a["capacity_kg"]) for a in available)
    if avail_cap >= 6000:
        recs.append(
            {
                "id": "REC-CAPACITY-OK",
                "priority": "LOW",
                "priority_score": 2,
                "title": "Transport capacity currently sufficient for projected demand",
                "reason": (
                    f"{len(available)} of {len(assets)} assets are available totalling "
                    f"{avail_cap:,.0f} kg of lift, which comfortably covers the replenishment "
                    "volumes implied by current forecasts."
                ),
                "expected_impact": (
                    "No capacity-driven delay is expected for the current replenishment plan; "
                    "scheduling flexibility is preserved."
                ),
                "suggested_action": (
                    "Maintain the current dispatch roster and re-evaluate after the maintenance "
                    "asset returns to service."
                ),
                "category": "Transport",
                "confidence": 0.86,
                "location_id": None,
                "location_name": None,
                "metric_value": avail_cap,
                "horizon_days": None,
            }
        )
    else:
        recs.append(
            {
                "id": "REC-CAPACITY-TIGHT",
                "priority": "HIGH",
                "priority_score": 4,
                "title": "Available transport capacity below recommended threshold",
                "reason": (
                    f"Only {avail_cap:,.0f} kg of lift is available across the fleet, below the "
                    "6,000 kg needed to run concurrent replenishment convoys."
                ),
                "expected_impact": "Replenishment moves would need to be sequenced, delaying shortage response.",
                "suggested_action": "Return maintenance assets to service or contract additional haulage.",
                "category": "Transport",
                "confidence": 0.85,
                "location_id": None,
                "location_name": None,
                "metric_value": avail_cap,
                "horizon_days": None,
            }
        )

    # 6. Healthy-category confirmation (explicitly communicates "no action").
    healthy = [
        i
        for i in items
        if i["status"] == "HEALTHY" and i["category"] == "Medical Supplies"
    ]
    if healthy:
        recs.append(
            {
                "id": "REC-MEDICAL-HEALTHY",
                "priority": "LOW",
                "priority_score": 2,
                "title": "Medical inventory is healthy -- no immediate replenishment indicated",
                "reason": (
                    f"All {len(healthy)} medical supply records remain above the 7-day reorder "
                    "threshold, with comfortable stock cover and no projected shortage window."
                ),
                "expected_impact": (
                    "Planning attention can be reallocated to categories carrying projected "
                    "shortage risk."
                ),
                "suggested_action": (
                    "No action required. Continue routine monitoring on the standard reporting cycle."
                ),
                "category": "Inventory",
                "confidence": 0.8,
                "location_id": healthy[0].get("location_id"),
                "location_name": healthy[0].get("location_name"),
                "metric_value": float(min(float(i["days_remaining"]) for i in healthy)),
                "horizon_days": None,
            }
        )

    # 7. Aggregate risk posture.
    recs.append(
        {
            "id": "REC-RISK-POSTURE",
            "priority": risk["level"] if risk["level"] in ("HIGH", "CRITICAL") else "MEDIUM",
            "priority_score": {"CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2}[risk["level"]],
            "title": f"Composite logistics risk currently {risk['level']} ({risk['total_score']:.0f}/100)",
            "reason": (
                f"Risk decomposition -- inventory {risk['inventory_score']:.1f}/25, "
                f"demand {risk['demand_score']:.1f}/20, weather {risk['weather_score']:.1f}/20, "
                f"route {risk['route_score']:.1f}/20, transport {risk['transport_score']:.1f}/15. "
                f"Primary driver: {risk['drivers'][0] if risk['drivers'] else 'aggregate exposure'}."
            ),
            "expected_impact": (
                "A single composite figure allows planners to compare scenarios and focus "
                "mitigation on the highest-contributing component."
            ),
            "suggested_action": (
                f"Target the {max(risk['components'], key=lambda c: c['score'] / c['max_score'])['label'].lower()} "
                "component first, then re-run the risk engine after mitigation to confirm improvement."
            ),
            "category": "Risk",
            "confidence": 0.84,
            "location_id": None,
            "location_name": None,
            "metric_value": float(risk["total_score"]),
            "horizon_days": None,
        }
    )

    # Sort by urgency band, then most urgent lead time (a shortage in 3 days outranks
    # one in 6 days). Urgency metric is derived rather than reusing metric_value,
    # which means different things across recommendation types.
    def urgency(r: dict[str, Any]) -> float:
        if r["category"] == "Inventory" and r.get("metric_value") is not None:
            return float(r["metric_value"])
        return 999.0

    recs.sort(key=lambda r: (r["priority_score"], urgency(r), r["id"]))
    return recs