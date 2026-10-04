/**
 * Thin typed fetch wrapper around the LOGISENSE AI REST API.
 *
 * Provides consistent error shapes, request timeouts and a small cache-busting
 * helper so the dashboard "Last Updated" indicator is meaningful.
 */

import type { ApiError } from "@/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

const DEFAULT_TIMEOUT = 30_000;

/** Error thrown for any non-2xx response or network failure. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly payload: ApiError | null;
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    status: number,
    payload: ApiError | null = null,
    isNetworkError = false,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
    this.isNetworkError = isNetworkError;
  }

  /** Human-readable guidance shown in the UI error states. */
  get hint(): string {
    if (this.isNetworkError) {
      return `Cannot reach the backend at ${API_BASE}. Start it with "uvicorn app.main:app --reload --port 8000" and confirm NEXT_PUBLIC_API_URL is correct.`;
    }
    if (this.status === 404) {
      return "The requested resource does not exist. Run `python -m app.seed` to populate demo data.";
    }
    if (this.status === 422) {
      return "The request was rejected by the API. Check the selected filters and try again.";
    }
    if (this.status >= 500) {
      return "The backend reported an internal error. Check the uvicorn console output for details.";
    }
    return "Please try again, or check the backend logs for details.";
  }
}

type QueryValue = string | number | boolean | null | undefined;

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (!params) return url;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(
  path: string,
  init: RequestInit & { params?: Record<string, QueryValue>; timeout?: number } = {},
): Promise<T> {
  const { params, timeout = DEFAULT_TIMEOUT, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timer);
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ApiRequestError(
      aborted
        ? `Request to ${path} timed out after ${timeout / 1000}s.`
        : `Network request to ${API_BASE} failed.`,
      0,
      null,
      true,
    );
  }
  clearTimeout(timer);

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { detail: text.slice(0, 300) };
    }
  }

  if (!response.ok) {
    const errPayload = (payload ?? null) as ApiError | null;
    throw new ApiRequestError(
      errPayload?.detail ?? `Request failed with status ${response.status}`,
      response.status,
      errPayload,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, QueryValue>) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown, params?: Record<string, QueryValue>) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}), params }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
};

/* ---------------------------- typed endpoint helpers ----------------------- */
import type {
  Alert,
  AlertsResponse,
  Analytics,
  Dashboard,
  Forecast,
  ForecastMeta,
  Health,
  InventoryDetail,
  InventoryResponse,
  LocationNode,
  RecommendationsResponse,
  RiskResponse,
  RouteRecommendation,
  Route,
  TransportResponse,
  WeatherResponse,
} from "@/types";

export const endpoints = {
  health: () => api.get<Health>("/api/health", { _t: Date.now() }),

  dashboard: () => api.get<Dashboard>("/api/dashboard", { _t: Date.now() }),

  inventory: (params?: {
    search?: string;
    status?: string;
    category?: string;
    location_id?: string;
  }) => api.get<InventoryResponse>("/api/inventory", params),

  inventoryItem: (id: number) => api.get<InventoryDetail>(`/api/inventory/${id}`),

  forecast: (params: {
    supply_type: string;
    horizon_days: number;
    location_id?: string | null;
    history_days?: number;
  }) => api.get<Forecast>("/api/forecast", params),

  forecastMeta: () => api.get<ForecastMeta>("/api/forecast/meta"),

  routes: (params?: { destination_id?: string; required_kg?: number }) =>
    api.get<{ routes: Route[]; count: number; demo_mode: boolean }>("/api/routes", params),

  routeRecommendation: (params?: { destination_id?: string; required_kg?: number }) =>
    api.get<RouteRecommendation>("/api/routes/recommendation", params),

  weather: () => api.get<WeatherResponse>("/api/weather"),

  risk: (horizon = 7) => api.get<RiskResponse>("/api/risk", { horizon_days: horizon }),

  recommendations: (horizon = 7) =>
    api.get<RecommendationsResponse>("/api/recommendations", { horizon_days: horizon }),

  alerts: (params?: { severity?: string; status?: string; category?: string }) =>
    api.get<AlertsResponse>("/api/alerts", params),

  updateAlert: (id: number, status: string) =>
    api.patch<Alert>(`/api/alerts/${id}`, { status }),

  transport: (params?: { status?: string; asset_type?: string }) =>
    api.get<TransportResponse>("/api/transport", params),

  analytics: (rangeDays = 30) =>
    api.get<Analytics>("/api/analytics", { range_days: rangeDays }),

  nodes: () => api.get<{ nodes: LocationNode[] }>("/api/nodes", { _t: Date.now() }),
};