"use client";

import { useQuery } from "@tanstack/react-query";
import { endpoints, API_BASE } from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Activity,
  ChevronDown,
  ExternalLink,
  FlaskConical,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/** Live-ish clock so "Last Updated" is meaningful without a manual refresh. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Topbar({
  collapsed,
  onToggleCollapse,
  onOpenMobileNav,
  rightSidebarCollapsed,
  onToggleRightSidebar,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileNav: () => void;
  rightSidebarCollapsed?: boolean;
  onToggleRightSidebar?: () => void;
}) {
  const now = useNow();
  const mounted = useMounted();
  const [manualSyncTime, setManualSyncTime] = useState<string | null>(null);

  const { data: health, isError, isFetching, refetch } = useQuery({
    queryKey: ["health"],
    queryFn: endpoints.health,
    refetchInterval: 30_000,
  });

  const lastSync = manualSyncTime ?? health?.server_time ?? null;
  const online = !isError && health?.status === "ok";

  const handleRefresh = async () => {
    const result = await refetch();
    if (result.isSuccess) {
      setManualSyncTime(new Date().toISOString());
      toast.success("Telemetry refreshed", {
        description: `Backend responded at ${API_BASE}`,
      });
    } else {
      toast.error("Refresh failed", {
        description: "The backend did not respond. Verify it is running on port 8000.",
      });
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-base-800 bg-base-900/70 px-3 backdrop-blur-xl sm:px-4">
      {/* Mobile nav toggle */}
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="flex size-8 items-center justify-center rounded-sm border border-base-700 text-slate-400 transition-colors hover:text-slate-200 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-4" />
      </button>

      {/* Desktop collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden size-8 items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-base-800 hover:text-slate-300 lg:flex"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <Activity className="size-3.5 shrink-0 text-accent-500/70" />
        <span className="truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Northern Sector Logistics Command
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Clock */}
        <Tooltip
          content={
            lastSync ? `Last backend sync ${relativeTime(lastSync)}` : "Awaiting first sync"
          }
        >
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="num text-[11px] tabular-nums text-slate-400">
              {mounted ? now.toLocaleTimeString("en-GB", { hour12: false }) : "--:--:--"}
            </span>
          </div>
        </Tooltip>

        <button
          type="button"
          onClick={handleRefresh}
          className="flex size-8 items-center justify-center rounded-sm border border-base-700 text-slate-400 transition-colors hover:border-accent-600 hover:text-accent-300"
          aria-label="Refresh telemetry"
          title="Refresh telemetry"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-accent-400")} />
        </button>

        {/* Demo mode */}
        <Tooltip content="All data is synthetic and generated locally for demonstration.">
          <Badge tone="accent" className="hidden sm:inline-flex">
            <FlaskConical className="size-2.5" />
            Live AI Telemetry
          </Badge>
        </Tooltip>

        {/* System status */}
        <Tooltip
          content={
            online
              ? `API ONLINE - model ${health?.model_version ?? "n/a"}, DB ${health?.database.dialect ?? "n/a"}`
              : `API OFFLINE - cannot reach ${API_BASE}`
          }
        >
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
              online
                ? "border-ok-500/40 bg-ok-900/50 text-ok-400"
                : "border-crit-500/40 bg-crit-900/50 text-crit-400",
            )}
          >
            {online ? <Wifi className="size-2.5" /> : <WifiOff className="size-2.5" />}
            {online ? "Online" : "Offline"}
          </span>
        </Tooltip>

        {/* Right Sidebar Telemetry Toggle */}
        {onToggleRightSidebar && (
          <Tooltip content={rightSidebarCollapsed ? "Expand Values Telemetry Sidebar" : "Collapse Values Telemetry Sidebar"}>
            <button
              type="button"
              onClick={onToggleRightSidebar}
              className={cn(
                "hidden size-8 items-center justify-center rounded-sm border transition-colors lg:flex",
                rightSidebarCollapsed
                  ? "border-base-700 text-slate-400 hover:border-accent-600 hover:text-accent-300"
                  : "border-accent-500/50 bg-accent-500/15 text-accent-300",
              )}
              aria-label="Toggle Telemetry Sidebar"
            >
              {rightSidebarCollapsed ? (
                <PanelRightOpen className="size-4" />
              ) : (
                <PanelRightClose className="size-4" />
              )}
            </button>
          </Tooltip>
        )}

        {/* API docs link */}
        <Tooltip content="Open FastAPI Swagger documentation">
          <a
            href={`${API_BASE}/docs`}
            target="_blank"
            rel="noreferrer"
            className="hidden size-8 items-center justify-center rounded-sm border border-base-700 text-slate-400 transition-colors hover:border-accent-600 hover:text-accent-300 sm:flex"
            aria-label="Open API documentation"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </Tooltip>

        {/* User profile */}
        <Tooltip content="Signed in as Tactical Operations Commander">
          <button
            type="button"
            className="flex items-center gap-2 rounded-sm border border-base-700 py-1 pl-1 pr-1.5 transition-colors hover:border-base-600"
          >
            <span className="flex size-6 items-center justify-center rounded-sm bg-accent-500/15 text-[10px] font-bold text-accent-300">
              CMD
            </span>
            <ChevronDown className="hidden size-3 text-slate-500 sm:block" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
