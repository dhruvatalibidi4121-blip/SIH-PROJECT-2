"""AI demand forecasting endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.database import get_db
from app.forecasting import SUPPLY_PROFILE, model_info, predict_demand
from app.schemas import ForecastRequest, ForecastResponse

router = APIRouter(tags=["Forecasting"])

SUPPLIES = list(SUPPLY_PROFILE.keys())
HORIZONS = [3, 7, 14, 30]


def _build(
    db: Session, supply_type: str, horizon_days: int, location_id: str | None, history_days: int
) -> ForecastResponse:
    if supply_type not in SUPPLIES:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown supply_type '{supply_type}'. Valid values: {', '.join(SUPPLIES)}",
        )
    if horizon_days not in HORIZONS:
        raise HTTPException(
            status_code=422,
            detail=f"horizon_days must be one of {HORIZONS}",
        )
    try:
        return ForecastResponse(**crud.build_forecast(db, supply_type, horizon_days, location_id, history_days))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Forecast computation failed: {exc}") from exc


@router.get(
    "/forecast",
    response_model=ForecastResponse,
    summary="Demand forecast (query parameters)",
    description="RandomForestRegressor-based demand projection combining historical "
    "consumption with temperature, rainfall, road condition, transport availability "
    "and seasonal index. Predictions use synthetic demonstration data.",
)
def get_forecast(
    supply_type: str = Query("Fuel", description=f"One of: {', '.join(SUPPLIES)}"),
    horizon_days: int = Query(7, description="3, 7, 14 or 30"),
    location_id: str | None = Query(None),
    history_days: int = Query(30, ge=7, le=180),
    db: Session = Depends(get_db),
) -> ForecastResponse:
    return _build(db, supply_type, horizon_days, location_id, history_days)


@router.post(
    "/forecast",
    response_model=ForecastResponse,
    summary="Demand forecast (JSON body)",
    description="Same model as the GET variant; accepts a structured request body for "
    "the interactive forecast controls.",
)
def post_forecast(payload: ForecastRequest, db: Session = Depends(get_db)) -> ForecastResponse:
    return _build(
        db,
        payload.supply_type,
        payload.horizon_days,
        payload.location_id,
        payload.history_days,
    )


@router.get("/forecast/meta", summary="Forecast capabilities and model metrics")
def forecast_meta() -> dict:
    return {
        "supply_types": SUPPLIES,
        "horizons": HORIZONS,
        "units": {k: v["unit"] for k, v in SUPPLY_PROFILE.items()},
        "model": model_info(),
        "demo_mode": settings.demo_mode,
        "disclaimer": (
            "Demo prediction using synthetic data. Predictions are illustrative only and "
            "are not operationally accurate."
        ),
    }