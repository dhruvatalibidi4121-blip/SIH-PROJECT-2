import { WORKSPACE_NAV } from "@/lib/nav";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-base-800 bg-base-900/60 px-4 py-2.5 backdrop-blur-sm sm:px-6 lg:px-7">
      <div className="mx-auto flex max-w-[1680px] flex-col items-start justify-between gap-1.5 sm:flex-row sm:items-center">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Prototype for demonstration and decision-support research using synthetic data. Not
          intended for real-world operational deployment.
        </p>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {WORKSPACE_NAV.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[10px] text-slate-600 transition-colors hover:text-accent-400"
            >
              {item.label}
            </Link>
          ))}
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-slate-600 transition-colors hover:text-accent-400"
          >
            API Docs
          </a>
        </nav>
      </div>
    </footer>
  );
}