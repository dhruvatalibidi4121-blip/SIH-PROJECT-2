"""Composite risk intelligence endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.database import get_db
from app.models import RiskSnapshot, utcnow
from app.schemas import RecommendationResponse, RiskResponse

router = APIRouter(tags=["Risk"])


@router.get(
    "/risk",
    response_model=RiskResponse,
    summary="Composite logistics risk score",
    description="Weighted 0-100 risk score combining inventory (25), demand (20), "
    "weather (20), route (20) and transport (15) risk, with a full breakdown and "
    "historical trend.",
)
def get_risk(
    horizon_days: int = Query(7, description="Forecast horizon feeding the demand component"),
    db: Session = Depends(get_db),
) -> RiskResponse:
    try:
        payload = crud.system_risk(db, horizon_days=horizon_days)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Risk computation failed: {exc}") from exc

    # Prefer persisted snapshots for the trend when available.
    snapshots = db.query(RiskSnapshot).order_by(RiskSnapshot.created_at.desc()).limit(14).all()
    if snapshots:
        trend = [
            {
                "label": s.created_at.strftime("%d %b %H:%M"),
                "score": round(float(s.total_score), 1),
            }
            for s in reversed(snapshots)
        ]
        payload["trend"] = trend

    return RiskResponse(**payload)


@router.get(
    "/risk/components",
    summary="Risk component breakdown only",
)
def risk_components(db: Session = Depends(get_db)) -> dict:
    risk = crud.system_risk(db)
    return {"components": risk["components"], "total_score": risk["total_score"], "level": risk["level"]}


@router.get(
    "/recommendations",
    response_model=RecommendationResponse,
    summary="AI logistics recommendations",
    description="Prioritised, actionable recommendations generated from inventory "
    "coverage, forecast demand, route scoring, weather exposure and transport "
    "capacity. Each item carries a priority, reason, expected impact and action.",
)
def get_recommendations(
    horizon_days: int = Query(7),
    limit: int | None = Query(None, ge=1, le=50),
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    try:
        recs = crud.recommendations(db, horizon_days=horizon_days, limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Recommendation engine failed: {exc}") from exc

    return RecommendationResponse(
        recommendations=recs,
        total=len(recs),
        generated_at=utcnow(),
        engine="LOGISENSE Rule + Forecast Ensemble v1.0",
        demo_mode=settings.demo_mode,
        disclaimer=(
            "Decision-support suggestions generated from synthetic demonstration data. "
            "Not operational instructions."
        ),
    )