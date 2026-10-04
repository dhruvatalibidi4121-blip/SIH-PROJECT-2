"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { MapSkeleton } from "@/components/ui/states";
import { riskColor } from "@/lib/utils";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

// Fix for default Leaflet marker icon
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Synthetic "Sector Boundary" - Northern Highland Zone
const SECTOR_BOUNDARY: L.LatLngExpression[] = [
  [32.5, 75.0], [32.5, 79.0], [29.0, 79.0], [29.0, 75.0]
];

export function MapClient() {
  const mounted = useMounted();
  
  const { data: routeData, isLoading: routeLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: () => endpoints.routes(),
  });
  const { data: nodeData, isLoading: nodeLoading } = useQuery({
    queryKey: ["nodes"],
    queryFn: () => endpoints.nodes(),
  });

  if (!mounted || routeLoading || nodeLoading) return <MapSkeleton />;

  return (
    <>
      <PageHeader title="Logistics Map" subtitle="GIS Corridor Intelligence" />
      
      <div className="panel h-[calc(100vh-160px)] overflow-hidden rounded-sm">
        <MapContainer
          center={[32.5, 77.5]}
          zoom={7}
          className="h-full w-full map-grid-bg"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {routeData?.routes.map((route) => {
            const c = riskColor(route.risk_level);
            return (
              <Polyline
                key={route.id}
                positions={route.path as L.LatLngExpression[]}
                color={c.hex}
                weight={3}
                opacity={0.7}
              />
            );
          })}

          <Polygon 
            positions={SECTOR_BOUNDARY} 
            color="#38bdf8" 
            weight={1} 
            fillOpacity={0.03} 
            dashArray="10, 10" 
          />

          {nodeData?.nodes.map((node) => (
            <Marker key={node.id} position={[node.latitude, node.longitude]} icon={icon}>
              <Popup>
                <div className="text-xs space-y-1">
                  <h4 className="font-semibold text-accent-400">{node.name}</h4>
                  <p>Terrain: <span className="text-slate-300">{node.terrain}</span></p>
                  <p>Fill Rate: {node.fill_pct.toFixed(0)}%</p>
                  <p>Risk: <span className="text-warn-500">{node.risk_level}</span></p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </>
  );
}
