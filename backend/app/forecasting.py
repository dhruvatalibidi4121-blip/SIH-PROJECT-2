"""Machine-learning demand forecasting engine (scikit-learn).

Pipeline
--------
1. ``generate_training_data()`` builds a synthetic but internally consistent
   historical dataset with the documented feature set:
   date, location_id, supply_type, consumption, inventory, temperature,
   rainfall, road_condition, transport_availability, season_index
2. ``train_model()`` fits a ``RandomForestRegressor`` on that data (a
   ``GradientBoostingRegressor`` is used as the fallback) and persists it with
   joblib.
3. ``predict_demand()`` walks forward day-by-day, feeding model predictions back
   as the future inventory level so the projection is self-consistent.
4. ``calculate_confidence()`` derives a confidence value from the model's
   cross-validated error plus a data-sufficiency factor.

Everything here runs locally. No external services are required, and no
operational accuracy is claimed -- the outputs are demonstration values.
"""

from __future__ import annotations

import logging
import math
from datetime import date, timedelta
from functools import lru_cache
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_percentage_error
from sklearn.model_selection import train_test_split

from app.config import MODEL_DIR, settings

logger = logging.getLogger("logisense.forecasting")

MODEL_VERSION = "RF-1.0.0"

FEATURE_COLUMNS = [
    "supply_type_code",
    "location_code",
    "day_of_week",
    "day_of_year",
    "lag_1",
    "lag_7",
    "rolling_7",
    "trend_index",
    "temperature",
    "rainfall",
    "road_condition",
    "transport_availability",
    "season_index",
    "inventory",
]

SUPPLY_TYPES = ["Fuel", "Food", "Water", "Medical Supplies", "Spare Parts"]

# Baseline daily draw per supply type (fictional planning figures).
SUPPLY_PROFILE: dict[str, dict[str, float]] = {
    "Fuel": {"base": 560.0, "unit": "L", "volatility": 0.10, "temp_sensitivity": 0.055},
    "Food": {"base": 430.0, "unit": "kg", "volatility": 0.07, "temp_sensitivity": 0.010},
    "Water": {"base": 610.0, "unit": "L", "volatility": 0.09, "temp_sensitivity": 0.048},
    "Medical Supplies": {"base": 95.0, "unit": "kits", "volatility": 0.16, "temp_sensitivity": 0.006},
    "Spare Parts": {"base": 48.0, "unit": "units", "volatility": 0.22, "temp_sensitivity": 0.004},
}

# Fictional demand pressure multipliers per node.
UNIT_BY_SUPPLY = {k: v["unit"] for k, v in SUPPLY_PROFILE.items()}

SUPPLY_NODE_FACTOR: dict[str, dict[str, float]] = {
    "LOC-HUB": {
        "Fuel": 1.00, "Food": 1.00, "Water": 1.00, "Medical Supplies": 1.00, "Spare Parts": 1.00
    },
    "LOC-ALPHA": {
        "Fuel": 1.18, "Food": 1.12, "Water": 1.09, "Medical Supplies": 0.82, "Spare Parts": 1.05
    },
    "LOC-NORTH": {
        "Fuel": 0.88, "Food": 0.94, "Water": 0.86, "Medical Supplies": 1.10, "Spare Parts": 0.79
    },
    "LOC-EAST": {
        "Fuel": 1.05, "Food": 1.08, "Water": 1.02, "Medical Supplies": 0.88, "Spare Parts": 1.21
    },
    "LOC-WEST": {
        "Fuel": 0.96, "Food": 0.91, "Water": 1.14, "Medical Supplies": 0.95, "Spare Parts": 0.74
    },
}

N_LOCATION_CODES = 5
HISTORY_DAYS = 420


# ---------------------------------------------------------------------------
# Synthetic data generation
# ---------------------------------------------------------------------------
def generate_training_data(
    n_days: int = HISTORY_DAYS,
    seed: int | None = None,
    end_date: date | None = None,
) -> pd.DataFrame:
    """Generate a synthetic historical consumption dataset.

    The generator embeds realistic structure: weekly seasonality, an annual
    seasonal index, temperature sensitivity, node demand pressure and
    logistics friction (bad roads / low transport availability depress
    consumption). This gives the regression model genuine signal to learn.
    """
    seed = settings.random_seed if seed is None else seed
    rng = np.random.default_rng(seed)
    end_date = end_date or date.today()

    rows: list[dict[str, Any]] = []
    location_ids = list(SUPPLY_NODE_FACTOR.keys())

    for loc_idx, loc_id in enumerate(location_ids):
        inventory_level = 12000.0 + rng.uniform(-1500, 1500)
        for offset in range(n_days, 0, -1):
            day = end_date - timedelta(days=offset)
            doy = day.timetuple().tm_yday

            season_index = 0.5 * (1 + np.sin(2 * np.pi * (doy - 80) / 365.25))
            trend_index = (n_days - offset) / n_days
            dow = day.weekday()

            temperature = float(
                14.0 - 11.0 * np.cos(2 * np.pi * (doy - 20) / 365.25) + rng.normal(0, 2.4)
            )
            rainfall = float(
                max(0.0, 46 * (season_index**2) + rng.gamma(1.6, 11.0) - 12)
            )
            road_condition = float(
                np.clip(0.85 - 0.12 * season_index + rng.normal(0, 0.07), 0.15, 1.0)
            )
            transport_availability = float(
                np.clip(road_condition + rng.normal(0.05, 0.05), 0.25, 1.0)
            )

            for supply in SUPPLY_TYPES:
                profile = SUPPLY_PROFILE[supply]
                node_factor = SUPPLY_NODE_FACTOR[loc_id][supply]

                dow_factor = 1.0
                if dow == 5:  # Saturday surge
                    dow_factor *= 1.08
                elif dow == 6:  # Sunday lull
                    dow_factor *= 0.94

                seasonal_strength = {
                    "Fuel": 0.16,
                    "Food": 0.09,
                    "Water": 0.19,
                    "Medical Supplies": 0.07,
                    "Spare Parts": 0.05,
                }[supply]

                trend_growth = 1.0 + 0.11 * (trend_index - 0.5)

                expected = (
                    profile["base"]
                    * node_factor
                    * dow_factor
                    * trend_growth
                    * (1 + seasonal_strength * (season_index - 0.5) * 2)
                    * (1 + profile["temp_sensitivity"] * max(0.0, temperature - 10))
                    * (1 - 0.10 * max(0.0, 0.55 - transport_availability))
                )
                noise = rng.normal(1.0, profile["volatility"])
                consumption = max(1.0, expected * noise)

                inventory_level = max(
                    consumption * 1.5, inventory_level - consumption + 250 * rng.random()
                )

                rows.append(
                    {
                        "date": day,
                        "location_id": loc_id,
                        "supply_type": supply,
                        "consumption": round(float(consumption), 3),
                        "inventory": round(float(inventory_level), 3),
                        "temperature": round(temperature, 2),
                        "rainfall": round(rainfall, 2),
                        "road_condition": round(road_condition, 3),
                        "transport_availability": round(transport_availability, 3),
                        "season_index": round(float(season_index), 4),
                    }
                )

    df = pd.DataFrame(rows)
    df["day_of_week"] = df["date"].map(lambda d: d.weekday())
    df["day_of_year"] = df["date"].map(lambda d: d.timetuple().tm_yday)
    return df.sort_values(["supply_type", "location_id", "date"]).reset_index(drop=True)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create lag / rolling features needed by the regressor."""
    out = df.copy()
    out = out.sort_values(["supply_type", "location_id", "date"])
    grp = out.groupby(["supply_type", "location_id"], sort=False)["consumption"]

    out["lag_1"] = grp.shift(1)
    out["lag_7"] = grp.shift(7)
    out["rolling_7"] = (
        out.groupby(["supply_type", "location_id"], sort=False)["consumption"]
        .transform(lambda s: s.shift(1).rolling(7, min_periods=3).mean())
    )
    out["trend_index"] = out.groupby("supply_type", sort=False).cumcount() / max(1, len(out) - 1)

    out["supply_type_code"] = out["supply_type"].map(
        {s: i for i, s in enumerate(SUPPLY_TYPES)}
    )
    out["location_code"] = out["location_id"].map(
        {l: i for i, l in enumerate(SUPPLY_NODE_FACTOR.keys())}
    )

    return out


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------
class ForecastModel:
    """Trained regressor wrapper with metadata."""

    def __init__(
        self,
        estimator: Any,
        metrics: dict[str, float],
        feature_columns: list[str],
        version: str = MODEL_VERSION,
        model_type: str = "RandomForestRegressor",
    ) -> None:
        self.estimator = estimator
        self.metrics = metrics
        self.feature_columns = feature_columns
        self.version = version
        self.model_type = model_type

    def predict(self, frame: pd.DataFrame) -> np.ndarray:
        return self.estimator.predict(frame[self.feature_columns])

    @property
    def mape(self) -> float:
        return float(self.metrics.get("mape", 0.12))

    def save(self, path: str | None = None) -> str:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        target = path or str(MODEL_DIR / "demand_forecaster.joblib")
        joblib.dump(
            {
                "estimator": self.estimator,
                "metrics": self.metrics,
                "feature_columns": self.feature_columns,
                "version": self.version,
                "model_type": self.model_type,
            },
            target,
        )
        return target

    @classmethod
    def load(cls, path: str | None = None) -> "ForecastModel | None":
        target = path or str(MODEL_DIR / "demand_forecaster.joblib")
        if not path and not (MODEL_DIR / "demand_forecaster.joblib").exists():
            return None
        try:
            blob = joblib.load(target)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not load persisted model: %s", exc)
            return None
        return cls(
            estimator=blob["estimator"],
            metrics=blob.get("metrics", {}),
            feature_columns=blob.get("feature_columns", FEATURE_COLUMNS),
            version=blob.get("version", MODEL_VERSION),
            model_type=blob.get("model_type", "RandomForestRegressor"),
        )


def train_model(
    df: pd.DataFrame | None = None,
    persist: bool = True,
    random_state: int | None = None,
) -> ForecastModel:
    """Fit the demand regressor. Falls back to GradientBoosting if RF fails."""
    random_state = settings.random_seed if random_state is None else random_state
    data = df if df is not None else generate_training_data()
    featured = build_features(data).dropna(subset=["lag_1", "lag_7", "rolling_7"])

    x = featured[FEATURE_COLUMNS]
    y = featured["consumption"]

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.15, random_state=random_state, shuffle=True
    )

    estimator = RandomForestRegressor(
        n_estimators=220,
        max_depth=18,
        min_samples_leaf=6,
        max_features=0.75,
        n_jobs=-1,
        random_state=random_state,
    )
    model_type = "RandomForestRegressor"
    try:
        estimator.fit(x_train, y_train)
    except Exception as exc:  # noqa: BLE001
        logger.warning("RandomForest failed (%s); using GradientBoosting", exc)
        estimator = GradientBoostingRegressor(
            n_estimators=250, max_depth=4, learning_rate=0.06, random_state=random_state
        )
        estimator.fit(x_train, y_train)
        model_type = "GradientBoostingRegressor"

    preds = estimator.predict(x_test)
    mape = float(mean_absolute_percentage_error(y_test, preds)) * 100
    r2 = float(estimator.score(x_test, y_test))

    model = ForecastModel(
        estimator=estimator,
        metrics={"mape": round(mape, 3), "r2": round(r2, 4), "train_rows": int(len(x_train))},
        feature_columns=FEATURE_COLUMNS,
        model_type=model_type,
    )
    logger.info("Trained %s | MAPE=%.2f%% R2=%.3f", model_type, mape, r2)
    if persist:
        model.save()
    return model


@lru_cache(maxsize=1)
def get_model() -> ForecastModel:
    """Return the persisted model, training it in-process if necessary."""
    model = ForecastModel.load()
    if model is None:
        logger.info("No persisted model found - training in-process")
        model = train_model()
    return model


def model_info() -> dict[str, Any]:
    try:
        model = get_model()
    except Exception as exc:  # noqa: BLE001
        return {"ready": False, "error": str(exc)}
    return {
        "ready": True,
        "version": model.version,
        "type": model.model_type,
        "metrics": model.metrics,
        "features": model.feature_columns,
    }


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------
def _row_payload(
    supply_type: str,
    location_id: str,
    day: date,
    lag_1: float,
    lag_7: float,
    rolling_7: float,
    trend_index: float,
    temperature: float,
    rainfall: float,
    road_condition: float,
    transport_availability: float,
    inventory: float,
) -> pd.DataFrame:
    doy = day.timetuple().tm_yday
    season_index = 0.5 * (1 + math.sin(2 * math.pi * (doy - 80) / 365.25))
    return pd.DataFrame(
        [
            {
                "supply_type_code": SUPPLY_TYPES.index(supply_type)
                if supply_type in SUPPLY_TYPES
                else 0,
                "location_code": list(SUPPLY_NODE_FACTOR.keys()).index(location_id)
                if location_id in SUPPLY_NODE_FACTOR
                else 0,
                "day_of_week": day.weekday(),
                "day_of_year": doy,
                "lag_1": lag_1,
                "lag_7": lag_7,
                "rolling_7": rolling_7,
                "trend_index": trend_index,
                "temperature": temperature,
                "rainfall": rainfall,
                "road_condition": road_condition,
                "transport_availability": transport_availability,
                "season_index": season_index,
                "inventory": inventory,
            }
        ]
    )[FEATURE_COLUMNS]


def _project_environment(
    start: date, horizon: int, last_weather: dict[str, float]
) -> list[dict[str, float]]:
    """Project environmental drivers forward using a damped persistence model."""
    out: list[dict[str, float]] = []
    temp = last_weather.get("temperature", 8.0)
    rain = last_weather.get("rainfall", 20.0)
    road = last_weather.get("road_condition", 0.7)
    transp = last_weather.get("transport_availability", 0.8)

    for i in range(horizon):
        day = start + timedelta(days=i)
        doy = day.timetuple().tm_yday
        clim = 14.0 - 11.0 * math.cos(2 * math.pi * (doy - 20) / 365.25)
        temp = 0.72 * temp + 0.28 * clim
        rain = 0.78 * rain + 0.22 * max(0.0, 46 * (0.5 * (1 + math.sin(2 * math.pi * (doy - 80) / 365.25))) ** 2)
        road = float(min(1.0, max(0.15, 0.80 * road + 0.20 * 0.75)))
        transp = float(min(1.0, max(0.25, 0.75 * transp + 0.25 * road)))
        out.append(
            {
                "temperature": round(temp, 2),
                "rainfall": round(rain, 2),
                "road_condition": round(road, 3),
                "transport_availability": round(transp, 3),
            }
        )
    return out


def predict_demand(
    supply_type: str,
    history: pd.DataFrame,
    current_inventory: float,
    horizon_days: int = 7,
    location_id: str = "LOC-HUB",
    last_weather: dict[str, float] | None = None,
    model: ForecastModel | None = None,
    scale: float = 1.0,
) -> dict[str, Any]:
    """Produce a forward consumption projection.

    Parameters
    ----------
    supply_type:
        One of :data:`SUPPLY_TYPES`.
    history:
        Historical ``consumption`` series for the same supply type / node, oldest
        first. Used to seed the lag features.
    current_inventory:
        Stock level the projection should draw down from.
    horizon_days:
        Number of days to project.
    scale:
        Optional multiplier applied to the model output. The regressor is
        trained on the synthetic generator's own magnitude, so this is used to
        project volumes in the caller's units (e.g. several item codes
        aggregated at one node).

    Returns
    -------
    dict with ``series`` (per-day predicted / lower / upper), ``total``,
    ``daily_average``, ``shortage_day`` and ``confidence``.
    """
    model = model or get_model()
    unit = SUPPLY_PROFILE.get(supply_type, {}).get("unit", "units")

    series = history.sort_values("date")["consumption"].astype(float).tolist() if len(history) else []
    if len(series) < 14:
        fallback = generate_training_data(n_days=60)
        fb = fallback[
            (fallback["supply_type"] == supply_type) & (fallback["location_id"] == location_id)
        ].sort_values("date")["consumption"].tolist()
        series = fb[-30:] or [SUPPLY_PROFILE.get(supply_type, {}).get("base", 100.0)]

    recent_avg = float(np.mean(series[-7:]))
    base_avg = float(np.mean(series[-28:])) if len(series) >= 28 else recent_avg
    trend_index = min(1.6, 1.0 + 0.45 * ((recent_avg - base_avg) / base_avg if base_avg else 0.0))

    last_weather = last_weather or {
        "temperature": 8.0,
        "rainfall": 18.0,
        "road_condition": 0.72,
        "transport_availability": 0.84,
    }
    env = _project_environment(date.today() + timedelta(days=1), horizon_days, last_weather)

    inventory = float(current_inventory)
    rows: list[dict[str, float]] = []
    cumulative = 0.0
    scale = max(0.0, float(scale))
    if scale == 0.0:
        scale = 1.0

    for i, e in enumerate(env):
        # Feature lags are always expressed in the model's training units, so the
        # caller's series is mapped up by the same factor used for the output.
        lag_1 = (series[-1] if series else recent_avg) / scale
        lag_7 = (series[-7] if len(series) >= 7 else recent_avg) / scale
        rolling_7 = (float(np.mean(series[-7:])) if len(series) >= 7 else recent_avg) / scale

        frame = _row_payload(
            supply_type=supply_type,
            location_id=location_id,
            day=date.today() + timedelta(days=i + 1),
            lag_1=lag_1,
            lag_7=lag_7,
            rolling_7=rolling_7,
            trend_index=trend_index,
            temperature=e["temperature"],
            rainfall=e["rainfall"],
            road_condition=e["road_condition"],
            transport_availability=e["transport_availability"],
            inventory=inventory / scale,
        )
        point = max(0.0, float(model.predict(frame)[0]) * scale)

        spread = point * (0.06 + 0.055 * i)
        rows.append(
            {
                "date": (date.today() + timedelta(days=i + 1)).isoformat(),
                "predicted": round(point, 2),
                "lower": round(max(0.0, point - spread), 2),
                "upper": round(point + spread, 2),
                "cumulative": 0.0,
            }
        )
        series.append(point)
        cumulative += point
        inventory = max(0.0, inventory - point)
        rows[-1]["cumulative"] = round(cumulative, 2)

    shortage_day: int | None = None
    for r in rows:
        if r["cumulative"] >= current_inventory:
            shortage_day = int((date.fromisoformat(r["date"]) - date.today()).days)
            break

    total = float(cumulative)
    return {
        "supply_type": supply_type,
        "unit": unit,
        "series": rows,
        "total": round(total, 2),
        "daily_average": round(total / horizon_days, 2) if horizon_days else 0.0,
        "shortage_day": shortage_day,
        "shortage_date": rows[shortage_day - 1]["date"] if shortage_day else None,
        "confidence": calculate_confidence(model, len(history), horizon_days),
        "trend_pct": round(((recent_avg - base_avg) / base_avg) * 100, 2) if base_avg else 0.0,
    }


def calculate_confidence(
    model: ForecastModel, history_rows: int, horizon_days: int
) -> float:
    """Confidence in [0.40, 0.97].

    Degrades with model error, longer horizons and thinner history.
    """
    accuracy = max(0.0, 1.0 - (model.mape / 100.0))
    data_factor = min(1.0, (history_rows or 0) / 180.0)
    horizon_penalty = min(0.22, 0.012 * max(0, horizon_days - 7))
    score = 0.30 + 0.40 * accuracy + 0.22 * data_factor - horizon_penalty
    return round(float(max(0.40, min(0.95, score))), 3)


def accuracy_report(model: ForecastModel | None = None) -> dict[str, float]:
    """Backtest style metrics surfaced on the Analytics page."""
    model = model or get_model()
    return {
        "mape": round(model.metrics.get("mape", 0.0), 2),
        "r2": round(model.metrics.get("r2", 0.0), 4),
        "train_rows": float(model.metrics.get("train_rows", 0)),
        "accuracy_pct": round(max(0.0, 100.0 - model.metrics.get("mape", 0.0)), 2),
    }