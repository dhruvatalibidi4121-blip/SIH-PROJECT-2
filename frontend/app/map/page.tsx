"use client";

import dynamic from "next/dynamic";
import { MapSkeleton } from "@/components/ui/states";

// Dynamically import the Map component, disabling SSR entirely.
const MapClient = dynamic(() => import("@/components/map/map-client").then((m) => m.MapClient), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function MapPage() {
  return <MapClient />;
}