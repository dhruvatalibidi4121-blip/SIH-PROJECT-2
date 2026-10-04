"use client";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";

export default function ArchitecturePage() {
  return (
    <>
      <PageHeader title="System Architecture" subtitle="LOGISENSE AI Data Flow" />
      <Panel className="p-8">
        <div className="flex flex-col items-center gap-8 text-center text-slate-400">
          <div className="flex flex-col items-center gap-2 rounded-sm border border-base-700 bg-base-850 p-6 max-w-2xl w-full">
            <span className="font-mono text-accent-400 font-bold">DATA SOURCES</span>
            <span className="text-xl">↓</span>
            <span className="font-mono">FastAPI Data Ingestion / Processing</span>
            <span className="text-xl">↓</span>
            <span className="font-mono text-accent-300 font-bold">RandomForestRegressor ML Engine</span>
            <span className="text-xl">↓</span>
            <span className="font-mono">Logistics & Risk Intelligence Engines</span>
            <span className="text-xl">↓</span>
            <span className="font-mono text-slate-100 font-bold">REST API (JSON)</span>
            <span className="text-xl">↓</span>
            <span className="font-mono">Next.js Dashboard + GIS Visualization</span>
          </div>
          <p className="max-w-lg text-sm leading-relaxed">
            The platform architecture transforms raw inventory, consumption, and environmental telemetry into actionable supply intelligence using a tiered ensemble of local ML models and heuristic logistics engines.
          </p>
        </div>
      </Panel>
    </>
  );
}