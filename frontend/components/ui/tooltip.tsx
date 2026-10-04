"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  children,
  content,
  side = "top",
  delay = 120,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-[1200] max-w-xs rounded-sm border border-base-600 bg-base-900/98 px-2.5 py-1.5",
            "text-[11px] leading-relaxed text-slate-200 shadow-[0_12px_32px_rgba(0,0,0,0.6)]",
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0",
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-base-600" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Small "?" affordance used to attach explanatory tooltips to values. */
export function InfoHint({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <Tooltip content={children}>
      <span
        aria-label={label ?? "More information"}
        className="inline-flex size-3.5 cursor-help items-center justify-center rounded-full border border-base-600 text-[9px] font-bold text-slate-500 transition-colors hover:border-accent-600 hover:text-accent-400"
      >
        ?
      </span>
    </Tooltip>
  );
}