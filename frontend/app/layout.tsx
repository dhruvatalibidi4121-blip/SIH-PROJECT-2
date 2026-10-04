import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LOGISENSE AI | Predictive Logistics & Supply Intelligence",
    template: "%s | LOGISENSE AI",
  },
  description:
    "AI-powered predictive logistics decision-support platform combining demand forecasting, inventory intelligence, GIS route analysis, weather risk and transport capacity.",
  keywords: [
    "logistics",
    "demand forecasting",
    "predictive analytics",
    "supply chain",
    "GIS",
    "risk intelligence",
    "machine learning",
  ],
  authors: [{ name: "LOGISENSE AI Research Prototype" }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#05080e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
