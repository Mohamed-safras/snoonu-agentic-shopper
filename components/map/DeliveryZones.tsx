"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DISTRICTS, predictZone } from "@/lib/map/zones";
import { MAP_TILE_URL } from "@/lib/map/constants";

// tier 0..3 → fastest → slowest
const TIER_COLOR = ["#2F8F5B", "#4C2D8F", "#C9A000", "#C73838"];
const TIER_LABEL = ["Same day", "Same / next day", "Next day", "1–2 days"];

/**
 * All 8 Qatar municipalities plotted as points on a map, coloured by PREDICTED
 * delivery window (estimated from road-distance to Snoonu HQ). The user's
 * district is enlarged. Authoritative fee/feasibility still comes from the MCP.
 */
export function DeliveryZones({ highlight }: { highlight?: string }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
      attributionControl: false,
    }).setView([7.8731, 80.7718], 7);
    L.tileLayer(MAP_TILE_URL, { maxZoom: 19 }).addTo(map);

    for (const d of DISTRICTS) {
      const z = predictZone(d);
      const on = highlight && d.name.toLowerCase() === highlight.toLowerCase();
      const size = on ? 18 : 12;
      const icon = L.divIcon({
        className: "leaflet-trova-icon",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${TIER_COLOR[z.tier]};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      L.marker([d.lat, d.lng], { icon })
        .addTo(map)
        .bindTooltip(`${d.name} · ${z.eta} · ${z.km} km`, { direction: "top" });
    }
    setTimeout(() => map.invalidateSize(), 60);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [highlight]);

  return (
    <div>
      <div ref={elRef} className="zone-map-leaflet" style={{ height: 240 }} />
      <div className="zones-legend">
        {TIER_LABEL.map((label, i) => (
          <span key={i} className="zones-legend-item">
            <span className="zone-dot" style={{ background: TIER_COLOR[i] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
