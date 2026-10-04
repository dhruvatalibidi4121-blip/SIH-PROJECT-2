"use client";

import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Activity, LifeBuoy, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-base-800 bg-base-900/80 backdrop-blur-xl transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[232px]",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 border-b border-base-800",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <span className="relative flex size-7 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-sm border border-accent-500/45 bg-accent-900/60" />
          <Activity className="relative size-3.5 text-accent-400" strokeWidth={2.4} />
        </span>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-none tracking-[0.14em] text-slate-100">
              LOGISENSE
              <span className="text-accent-400"> AI</span>
            </span>
            <span className="mt-1 block truncate text-[9px] uppercase leading-none tracking-[0.12em] text-slate-500">
              Supply Intelligence
            </span>
          </span>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3" aria-label="Main navigation">
        {!collapsed ? (
          <p className="label-caps px-4 pb-2 text-[9px] text-slate-600">Workspace</p>
        ) : null}
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.filter((i) => i.group !== "reference").map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-accent-500/12 font-medium text-accent-300"
                      : "text-slate-400 hover:bg-base-800 hover:text-slate-200",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent-400" />
                  ) : null}
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-accent-400" : "text-slate-500 group-hover:text-slate-300",
                    )}
                    strokeWidth={2}
                  />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  {!collapsed && item.badge ? (
                    <span className="ml-auto rounded-sm bg-crit-500/20 px-1.5 py-0.5 text-[9px] font-bold text-crit-400">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed ? (
          <p className="label-caps px-4 pb-2 pt-5 text-[9px] text-slate-600">Reference</p>
        ) : null}
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.filter((i) => i.group === "reference").map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-accent-500/12 font-medium text-accent-300"
                      : "text-slate-400 hover:bg-base-800 hover:text-slate-200",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-accent-400" : "text-slate-500 group-hover:text-slate-300",
                    )}
                  />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-base-800 p-2">
        <Link
          href="/architecture"
          onClick={onNavigate}
          title={collapsed ? "System architecture" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[12px] text-slate-500 transition-colors hover:bg-base-800 hover:text-slate-300",
            collapsed && "justify-center px-0",
          )}
        >
          <LifeBuoy className="size-4 shrink-0" />
          {!collapsed ? <span className="truncate">System Architecture</span> : null}
        </Link>
        {!collapsed ? (
          <p className="px-2.5 pb-1 pt-1 text-[9px] leading-relaxed text-slate-600">
            Synthetic demo data. Not for operational use.
          </p>
        ) : null}
      </div>

      {/* Mobile close */}
      <button
        type="button"
        onClick={onNavigate}
        className="absolute -right-9 top-3 hidden size-7 items-center justify-center rounded-sm border border-base-700 bg-base-850 text-slate-400 max-lg:flex"
        aria-label="Close navigation"
      >
        <X className="size-3.5" />
      </button>
    </aside>
  );
}