"""Route and logistics planning endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.database import get_db
from app.schemas import RouteListResponse, RouteRecommendation

router = APIRouter(tags=["Logistics"])


@router.get(
    "/routes",
    response_model=RouteListResponse,
    summary="Scored logistics corridors",
    description="All fictional corridors with distance, ETA, composite risk, weather "
    "risk, terrain risk, road condition, transport capacity and a weighted "
    "route score (100 = best).",
)
def list_routes(
    required_kg: float = Query(2000.0, gt=0, description="Payload the convoy must carry"),
    destination_id: str | None = Query(None, description="Restrict to corridors serving a node"),
    db: Session = Depends(get_db),
) -> RouteListResponse:
    routes = crud.score_route_network(db, required_kg=required_kg, destination_id=destination_id)
    return RouteListResponse(routes=routes, count=len(routes), demo_mode=settings.demo_mode)


@router.get(
    "/routes/recommendation",
    response_model=RouteRecommendation,
    summary="Recommended corridor with explanation",
    description="Runs the multi-criteria scoring engine and returns the recommended "
    "corridor plus alternatives and a natural-language explanation of the trade-offs.",
)
def get_recommendation(
    required_kg: float = Query(2000.0, gt=0),
    destination_id: str | None = Query(
        None, description="Compare corridors serving a specific node"
    ),
    db: Session = Depends(get_db),
) -> RouteRecommendation:
    try:
        return RouteRecommendation(
            **crud.route_recommendation(
                db, required_kg=required_kg, destination_id=destination_id
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Route recommendation failed: {exc}") from exc