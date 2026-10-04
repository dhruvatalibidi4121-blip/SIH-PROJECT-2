"""Predictive alert endpoints."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.database import get_db
from app.models import Alert, utcnow
from app.schemas import AlertListResponse, AlertOut, AlertUpdate

router = APIRouter(tags=["Alerts"])

SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
STATUSES = ["NEW", "ACKNOWLEDGED", "RESOLVED"]


@router.get(
    "/alerts",
    response_model=AlertListResponse,
    summary="List predictive alerts",
    description="Alerts generated from the forecasting, risk and weather engines "
    "during seeding. Filterable by severity, status and category.",
)
def list_alerts(
    severity: str | None = Query(None, pattern="^(CRITICAL|HIGH|MEDIUM|LOW)$"),
    status: str | None = Query(None, pattern="^(NEW|ACKNOWLEDGED|RESOLVED)$"),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
) -> AlertListResponse:
    alerts = crud.get_alerts(db)

    if severity:
        alerts = [a for a in alerts if a["severity"] == severity]
    if status:
        alerts = [a for a in alerts if a["status"] == status]
    if category:
        alerts = [a for a in alerts if a["category"] == category]

    all_alerts = crud.get_alerts(db)
    counts = {s: sum(1 for a in all_alerts if a["status"] == s) for s in STATUSES}
    severity_counts = {s: sum(1 for a in all_alerts if a["severity"] == s) for s in SEVERITIES}

    return AlertListResponse(
        alerts=alerts,
        total=len(alerts),
        counts=counts,
        severity_counts=severity_counts,
        demo_mode=settings.demo_mode,
    )


@router.get("/alerts/{alert_id}", response_model=AlertOut, summary="Alert detail")
def get_alert(alert_id: int, db: Session = Depends(get_db)) -> AlertOut:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return AlertOut(**crud.alert_to_dict(alert))


@router.patch(
    "/alerts/{alert_id}",
    response_model=AlertOut,
    summary="Update alert status",
    description="Transitions an alert between NEW, ACKNOWLEDGED and RESOLVED.",
)
def update_alert(alert_id: int, payload: AlertUpdate, db: Session = Depends(get_db)) -> AlertOut:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert.status = payload.status
    alert.updated_at = utcnow()
    db.commit()
    db.refresh(alert)
    return AlertOut(**crud.alert_to_dict(alert))


@router.post("/alerts/regenerate", summary="Regenerate alerts from current state")
def regenerate(db: Session = Depends(get_db)) -> dict:
    from app.seed import seed_alerts
    from sqlalchemy import delete

    db.execute(delete(Alert))
    db.commit()
    seed_alerts(db)
    alerts = crud.get_alerts(db)
    return {
        "regenerated": len(alerts),
        "alerts": alerts,
        "generated_at": datetime.utcnow(),
    }