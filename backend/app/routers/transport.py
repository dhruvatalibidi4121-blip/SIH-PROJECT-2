"""Transport fleet endpoints."""

from __future__ import annotations

from collections import defaultdict

import numpy as np
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.database import get_db
from app.schemas import TransportResponse

router = APIRouter(tags=["Transport"])


@router.get(
    "/transport",
    response_model=TransportResponse,
    summary="Transport asset availability",
    description="Fictional fleet assets with capacity, status, assignment, ETA and "
    "utilisation, plus fleet-level availability and capacity headroom.",
)
def get_transport(
    status: str | None = Query(None, pattern="^(AVAILABLE|IN_TRANSIT|MAINTENANCE)$"),
    asset_type: str | None = Query(None),
    db: Session = Depends(get_db),
) -> TransportResponse:
    assets = crud.get_transport(db)
    if status:
        assets = [a for a in assets if a["status"] == status]
    if asset_type:
        assets = [a for a in assets if a["asset_type"] == asset_type]

    all_assets = crud.get_transport(db)
    available = [a for a in all_assets if a["status"] == "AVAILABLE"]
    in_transit = [a for a in all_assets if a["status"] == "IN_TRANSIT"]
    maintenance = [a for a in all_assets if a["status"] == "MAINTENANCE"]

    total_capacity = sum(a["capacity_kg"] for a in all_assets)
    available_capacity = sum(a["capacity_kg"] for a in available)
    availability_pct = round(available_capacity / total_capacity * 100, 1) if total_capacity else 0.0
    utilization_pct = round(float(np.mean([a["utilization_pct"] for a in all_assets])), 1) if all_assets else 0.0

    by_type: dict[str, dict[str, float]] = defaultdict(
        lambda: {"count": 0, "capacity_kg": 0.0, "utilization_pct": 0.0}
    )
    for a in all_assets:
        entry = by_type[a["asset_type"]]
        entry["count"] += 1
        entry["capacity_kg"] += a["capacity_kg"]
        entry["utilization_pct"] += a["utilization_pct"]
    by_type_list = [
        {
            "asset_type": k,
            "count": int(v["count"]),
            "capacity_kg": round(v["capacity_kg"], 1),
            "utilization_pct": round(v["utilization_pct"] / v["count"], 1),
        }
        for k, v in sorted(by_type.items())
    ]

    return TransportResponse(
        assets=assets,
        total=len(assets),
        available_count=len(available),
        in_transit_count=len(in_transit),
        maintenance_count=len(maintenance),
        total_capacity_kg=round(total_capacity, 1),
        available_capacity_kg=round(available_capacity, 1),
        utilization_pct=utilization_pct,
        availability_pct=availability_pct,
        by_type=by_type_list,
        demo_mode=settings.demo_mode,
    )