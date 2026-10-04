"""Synthetic weather endpoints (optional external provider integration)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.database import get_db
from app.forecasting import get_model
from app.models import utcnow
from app.schemas import HealthResponse, WeatherListResponse

router = APIRouter(tags=["Risk"])


@router.get(
    "/weather",
    response_model=WeatherListResponse,
    summary="Current weather risk observations",
    description="Synthetic weather observations per node. Set WEATHER_API_KEY to "
    "enable the optional external provider; the demo never requires it.",
)
def get_weather(db: Session = Depends(get_db)) -> WeatherListResponse:
    try:
        records = crud.get_weather(db)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Weather retrieval failed: {exc}") from exc

    if not records:
        raise HTTPException(status_code=404, detail="No weather observations are available")

    avg_risk = sum(float(r["weather_risk"]) for r in records) / len(records)
    severity = crud.logistics.risk_level(avg_risk)
    source = records[0]["source"]

    return WeatherListResponse(
        records=records,
        system_risk=round(avg_risk, 1),
        severity=severity,
        source="SYNTHETIC" if not settings.weather_api_key else source,
        demo_mode=settings.demo_mode,
        fetched_at=utcnow(),
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health",
    description="Liveness probe including database connectivity and ML model status.",
)
def health() -> HealthResponse:
    from app.database import db_healthcheck

    try:
        info = get_model_info_safe()
    except Exception:  # noqa: BLE001
        info = {"ready": False}

    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=settings.app_version,
        demo_mode=settings.demo_mode,
        database=db_healthcheck(),
        server_time=utcnow(),
        model_ready=bool(info.get("ready")),
        model_version=info.get("version", "unavailable"),
    )


def get_model_info_safe() -> dict:
    from app.forecasting import model_info

    return model_info()