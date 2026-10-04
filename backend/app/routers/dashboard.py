"""Dashboard aggregation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.schemas import DashboardResponse

router = APIRouter(tags=["Dashboard"])


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Aggregated dashboard payload",
    description="Returns KPI cards, demand trend, category distribution, node rollups, "
    "top alerts and AI recommendations for the command dashboard. All values are "
    "computed from the demo dataset at request time.",
)
def get_dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    try:
        return DashboardResponse(**crud.dashboard(db))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Dashboard aggregation failed: {exc}") from exc


@router.get("/nodes", summary="GIS node rollups")
def get_nodes(db: Session = Depends(get_db)):
    return {"nodes": crud.node_payloads(db)}