"""Analytics endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.database import get_db
from app.schemas import AnalyticsResponse

router = APIRouter(tags=["Analytics"])

ALLOWED_RANGES = (7, 14, 30, 60, 90, 180)


@router.get(
    "/analytics",
    response_model=AnalyticsResponse,
    summary="Trend series for the analytics workspace",
    description="Demand trend, inventory trend, transport utilisation, route risk, "
    "forecast accuracy benchmarks and supply-category distribution over the "
    "requested window.",
)
def get_analytics(
    range_days: int = Query(30, description=f"One of: {', '.join(map(str, ALLOWED_RANGES))}"),
    db: Session = Depends(get_db),
) -> AnalyticsResponse:
    if range_days not in ALLOWED_RANGES:
        range_days = 30
    try:
        payload = crud.analytics(db, range_days=range_days)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Analytics aggregation failed: {exc}") from exc
    return AnalyticsResponse(**payload)