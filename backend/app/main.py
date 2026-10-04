"""LOGISENSE AI -- FastAPI application entrypoint.

Prototype for demonstration and decision-support research using synthetic data.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import db_healthcheck, init_db
from app.routers import (
    alerts,
    analytics,
    dashboard,
    forecast,
    inventory,
    risk,
    routes,
    transport,
    weather,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("logisense")

DESCRIPTION = """
**LOGISENSE AI** -- Predictive Logistics & Supply Intelligence Platform.

A decision-support **prototype** that combines:

* **Demand forecasting** -- `RandomForestRegressor` over synthetic consumption,
  temperature, rainfall, road-condition, transport-availability and seasonal features
* **Inventory intelligence** -- coverage, days-remaining and GREEN/AMBER/RED banding
* **GIS logistics planning** -- fictional corridors with multi-criteria route scoring
* **Risk intelligence** -- composite 0-100 score across five weighted components
* **AI recommendations** -- prioritised, actionable planning suggestions

> **Demo notice:** every value is computed from synthetic demonstration data.
> Nothing here is operationally accurate or intended for real-world deployment.
"""

TAGS_METADATA = [
    {"name": "Dashboard", "description": "Aggregated command dashboard payloads."},
    {"name": "Inventory", "description": "Stock levels, coverage and per-item forecasts."},
    {"name": "Forecasting", "description": "ML demand projection endpoints."},
    {"name": "Logistics", "description": "Corridor scoring and route recommendations."},
    {"name": "Risk", "description": "Composite risk scoring, weather and recommendations."},
    {"name": "Alerts", "description": "Automatically generated predictive alerts."},
    {"name": "Transport", "description": "Fictional transport fleet availability."},
    {"name": "Analytics", "description": "Trend series for the analytics workspace."},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    logger.info("DEMO_MODE=%s", settings.demo_mode)
    logger.info("CORS origins: %s", ", ".join(settings.cors_origin_list))
    try:
        init_db()
        logger.info("Database schema ready (%s)", db_healthcheck().get("dialect"))
    except Exception as exc:  # noqa: BLE001
        logger.error("Database initialisation failed: %s", exc)
    try:
        from app.forecasting import model_info

        info = model_info()
        logger.info(
            "ML model %s (%s) ready=%s",
            info.get("version"),
            info.get("type"),
            info.get("ready"),
        )
        if not info.get("ready"):
            logger.warning("Run `python -m app.seed` to populate demo data.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("ML model not ready: %s", exc)

    yield
    logger.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=DESCRIPTION,
    openapi_tags=TAGS_METADATA,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    contact={"name": "LOGISENSE AI Research Prototype"},
    license_info={"name": "Demonstration use only"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)


# ---------------------------------------------------------------------------
# Error handling -- always return JSON the frontend can render.
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_timing(request: Request, call_next):
    import time

    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error while processing the request.",
                "path": request.url.path,
                "error": type(exc).__name__,
            },
        )
    response.headers["X-Process-Time"] = f"{(time.perf_counter() - start) * 1000:.1f}ms"
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "path": request.url.path},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Request validation failed.",
            "errors": [
                {"field": ".".join(str(p) for p in err.get("loc", [])), "message": err.get("msg")}
                for err in exc.errors()
            ],
            "path": request.url.path,
        },
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
API = settings.api_prefix
app.include_router(weather.router, prefix=API)       # /api/health, /api/weather
app.include_router(dashboard.router, prefix=API)
app.include_router(inventory.router, prefix=API)
app.include_router(forecast.router, prefix=API)
app.include_router(routes.router, prefix=API)
app.include_router(risk.router, prefix=API)          # /api/risk, /api/recommendations
app.include_router(alerts.router, prefix=API)
app.include_router(transport.router, prefix=API)
app.include_router(analytics.router, prefix=API)


@app.get("/", tags=["Dashboard"], summary="API index")
def root() -> dict:
    return {
        "app": settings.app_name,
        "subtitle": "Predictive Logistics & Supply Intelligence Platform",
        "version": settings.app_version,
        "demo_mode": settings.demo_mode,
        "docs": "/docs",
        "endpoints": [
            f"{API}/health",
            f"{API}/dashboard",
            f"{API}/inventory",
            f"{API}/inventory/{{id}}",
            f"{API}/forecast",
            f"{API}/routes",
            f"{API}/routes/recommendation",
            f"{API}/weather",
            f"{API}/risk",
            f"{API}/recommendations",
            f"{API}/alerts",
            f"{API}/transport",
            f"{API}/analytics",
        ],
        "disclaimer": (
            "Prototype for demonstration and decision-support research using synthetic data. "
            "Not intended for real-world operational deployment."
        ),
    }