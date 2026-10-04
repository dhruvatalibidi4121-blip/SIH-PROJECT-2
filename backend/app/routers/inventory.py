"""Inventory endpoints."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.database import get_db
from app.forecasting import UNIT_BY_SUPPLY
from app.models import InventoryItem, utcnow
from app.schemas import InventoryDetailOut, InventoryListResponse

router = APIRouter(tags=["Inventory"])

SUPPLIES = list(UNIT_BY_SUPPLY.keys())


def _detail(item: InventoryItem, db: Session) -> dict:
    base = crud.inventory_to_dict(item)
    unit = base["unit"]
    forecasts = {
        h: crud.build_forecast(
            db,
            supply_type=item.category,
            horizon_days=h,
            location_id=item.location_id,
            history_days=45,
        )
        for h in (3, 7, 14, 30)
    }
    f7 = forecasts[7]
    hist = f7["history"]
    pred = [
        {
            "date": p["date"],
            "value": p["predicted"],
            "kind": "predicted",
        }
        for p in f7["series"]
        if p.get("is_projection")
    ]
    historical = [
        {
            "date": h["date"],
            "value": h["consumption"],
            "kind": "actual",
        }
        for h in hist
    ]

    predicted_total_7d = f7["predicted_demand"]
    suggested = max(0.0, predicted_total_7d * 1.15 - base["current_stock"])
    cover_ratio = (
        round(base["current_stock"] / predicted_total_7d * 100, 1)
        if predicted_total_7d
        else 100.0
    )

    return {
        **base,
        "days_of_cover_ratio": cover_ratio,
        "predicted_demand_3d": forecasts[3]["predicted_demand"],
        "predicted_demand_7d": round(predicted_total_7d, 2),
        "predicted_demand_14d": forecasts[14]["predicted_demand"],
        "predicted_demand_30d": forecasts[30]["predicted_demand"],
        "shortage_day": f7["projected_shortage_day"],
        "shortage_date": f7["projected_shortage_date"],
        "risk_level": f7["risk_level"],
        "confidence": f7["confidence"],
        "model_version": f7["model_version"],
        "historical": historical,
        "predicted": pred,
        "restock_suggestion_kg": round(suggested, 2),
        "restock_suggestion_units": int(round(suggested)),
    }


@router.get(
    "/inventory",
    response_model=InventoryListResponse,
    summary="List all inventory items",
    description="Returns every inventory record with computed days-remaining, fill "
    "percentage and a GREEN/AMBER/RED status band.",
)
def list_inventory(
    search: str | None = Query(None, description="Filter by name, code or location"),
    status: str | None = Query(None, pattern="^(HEALTHY|WARNING|CRITICAL)$"),
    category: str | None = Query(None, description="Supply category filter"),
    location_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> InventoryListResponse:
    items = crud.get_inventory(db)

    if search:
        q = search.lower()
        items = [
            i
            for i in items
            if q in i["name"].lower()
            or q in i["item_code"].lower()
            or q in i["category"].lower()
            or q in i["location_name"].lower()
        ]
    if status:
        items = [i for i in items if i["status"] == status]
    if category and category != "All":
        items = [i for i in items if i["category"] == category]
    if location_id:
        items = [i for i in items if i["location_id"] == location_id]

    counts = {"HEALTHY": 0, "WARNING": 0, "CRITICAL": 0}
    for i in crud.get_inventory(db):
        counts[i["status"]] = counts.get(i["status"], 0) + 1

    all_items = crud.get_inventory(db)
    total_stock = sum(i["current_stock"] for i in all_items)
    total_capacity = sum(i["capacity"] for i in all_items) or 1.0

    return InventoryListResponse(
        items=items,
        total=len(items),
        counts=counts,
        fill_rate_pct=round(total_stock / total_capacity * 100, 1),
        demo_mode=settings.demo_mode,
        generated_at=utcnow(),
    )


@router.get(
    "/inventory/{item_id}",
    response_model=InventoryDetailOut,
    summary="Inventory item detail with forecasts",
    description="Full detail panel payload: current stock, capacity, consumption, "
    "3/7/14/30-day forecasts, historical + predicted series, risk level and a "
    "restock suggestion.",
)
def get_inventory_item(item_id: int, db: Session = Depends(get_db)) -> InventoryDetailOut:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Inventory item {item_id} not found")
    try:
        return InventoryDetailOut(**_detail(item, db))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Could not build inventory detail: {exc}") from exc


@router.get("/inventory/meta/categories", summary="Distinct supply categories")
def categories() -> dict:
    return {"categories": SUPPLIES, "units": UNIT_BY_SUPPLY, "generated_at": datetime.utcnow()}