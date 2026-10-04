"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { cn, formatNumber, relativeTime, riskColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { Alert } from "@/types";
import { Check, CircleDot, Eye } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  NEW: "border-crit-500/40 bg-crit-900/40 text-crit-400",
  ACKNOWLEDGED: "border-warn-500/40 bg-warn-900/40 text-warn-500",
  RESOLVED: "border-ok-500/40 bg-ok-900/40 text-ok-400",
};

const STATUS_ICON: Record<string, typeof CircleDot> = {
  NEW: CircleDot,
  ACKNOWLEDGED: Eye,
  RESOLVED: Check,
};

/**
 * Alert row with inline status transitions (NEW -> ACKNOWLEDGED -> RESOLVED).
 * PATCHes /api/alerts/{id} and invalidates the alerts + dashboard caches.
 */
export function AlertRow({
  alert,
  compact,
  showActions = true,
}: {
  alert: Alert;
  compact?: boolean;
  showActions?: boolean;
}) {
  const queryClient = useQueryClient();
  const c = riskColor(alert.severity);

  const mutation = useMutation({
    mutationFn: (status: string) => endpoints.updateAlert(alert.id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["risk"] });
      toast.success(`Alert ${updated.status.toLowerCase()}`, {
        description: updated.title,
      });
    },
    onError: (err: Error) => {
      toast.error("Could not update alert", { description: err.message });
    },
  });

  const StatusIcon = STATUS_ICON[alert.status] ?? CircleDot;

  return (
    <article className="relative px-4 py-3 transition-colors hover:bg-base-850/40">
      <span
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ background: c.hex, opacity: 0.8 }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="border-0 px-1.5 py-0"
              style={{ background: `${c.hex}1f`, color: c.hex }}
            >
              {alert.severity}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider",
                STATUS_STYLE[alert.status],
              )}
            >
              <StatusIcon className="size-2.5" />
              {alert.status}
            </span>
            <span className="label-caps text-[9px] text-slate-600">{alert.category}</span>
            {alert.location_name ? (
              <span className="truncate text-[10px] text-slate-600">{alert.location_name}</span>
            ) : null}
            <Tooltip content={`Raised ${relativeTime(alert.created_at)} · confidence ${(alert.confidence * 100).toFixed(0)}%`}>
              <span className="num ml-auto shrink-0 cursor-help text-[9px] text-slate-600">
                {relativeTime(alert.created_at)}
              </span>
            </Tooltip>
          </div>

          <h4 className="mt-1.5 text-[13px] font-medium leading-snug text-slate-100">
            {alert.title}
          </h4>

          {!compact ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{alert.description}</p>
          ) : null}

          {!compact ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
              <span className="text-accent-300/85">
                <span className="label-caps mr-1.5 text-[9px] text-slate-600">Action</span>
                {alert.recommended_action}
              </span>
              {alert.metric_value !== null ? (
                <span className="num text-slate-600">
                  <span className="label-caps mr-1.5 text-[9px]">Metric</span>
                  {formatNumber(alert.metric_value, 1)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {showActions ? (
          <div className="flex shrink-0 flex-col gap-1">
            {alert.status === "NEW" ? (
              <Button
                size="xs"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("ACKNOWLEDGED")}
              >
                Acknowledge
              </Button>
            ) : alert.status === "ACKNOWLEDGED" ? (
              <Button
                size="xs"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("RESOLVED")}
              >
                Resolve
              </Button>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("NEW")}
              >
                Reopen
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}