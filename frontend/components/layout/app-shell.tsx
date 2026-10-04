"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Footer } from "@/components/layout/footer";
import { DataSidebar } from "@/components/layout/data-sidebar";
import { useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className="app-grid-bg flex h-screen overflow-hidden">
      {/* Left Sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onOpenMobileNav={() => setMobileOpen(true)}
          rightSidebarCollapsed={rightCollapsed}
          onToggleRightSidebar={() => setRightCollapsed((v) => !v)}
        />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 lg:px-7">
              {children}
            </div>
          </main>
          {/* Right Operations Telemetry Sidebar */}
          <DataSidebar
            collapsed={rightCollapsed}
            onToggleCollapse={() => setRightCollapsed((v) => !v)}
          />
        </div>
        <Footer />
      </div>
    </div>
  );
}
