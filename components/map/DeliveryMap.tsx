"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  HUB_HTML,
  SNOONU_HQ,
  MAP_TILE_URL,
  PIN_HTML,
} from "@/lib/map/constants";
import {
  districtCoord,
  fetchRoute,
  geoCache,
  geocode,
  routeCache,
} from "@/lib/map/geo";
import { RouteInfo } from "./RouteInfo";

/**
 * Real Leaflet map: Snoonu HQ → destination, with an OSRM road route and live
 * distance/ETA. Resolves the destination from an explicit pinned coordinate
 * (located / tapped / dragged), otherwise by geocoding the city/address. The
 * pin is draggable and the map is tappable (Uber/PickMe-style). Client-only.
 */
export function DeliveryMap({
  destName,
  address,
  pinned,
  onPick,
}: {
  destName?: string;
  /** Optional captured street address — refines the route pin. */
  address?: string;
  /** An explicit, user-confirmed coordinate. When set it OVERRIDES geocoding. */
  pinned?: { lat: number; lng: number } | null;
  /** When provided, the pin is draggable AND the map is tappable; fires the
   *  confirmed coordinates. `source` distinguishes the auto geocode from a
   *  deliberate user pick (drag/tap — which should overwrite the typed address). */
  onPick?: (lat: number, lng: number, source: "geocode" | "drag") => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  // Keep the latest onPick in a ref so map handlers (bound once) always call the
  // current callback — updated in an effect, never during render.
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  const [stats, setStats] = useState<{ km: string; min: number } | null>(null);

  // init once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      dragging: true,
      zoomControl: true,
      attributionControl: false,
    }).setView([7.8731, 80.7718], 8);
    L.tileLayer(MAP_TILE_URL, { maxZoom: 19 }).addTo(map);
    const hubIcon = L.divIcon({
      className: "leaflet-hala-icon",
      html: HUB_HTML,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    L.marker(SNOONU_HQ, { icon: hubIcon })
      .addTo(map)
      .bindTooltip("Snoonu · Doha", { direction: "top" });
    // Tap anywhere on the map to drop the delivery pin there (Uber/PickMe-style).
    if (onPickRef.current) {
      map.getContainer().style.cursor = "crosshair";
      map.on("click", (event: L.LeafletMouseEvent) => {
        onPickRef.current?.(event.latlng.lat, event.latlng.lng, "drag");
      });
    }
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 60);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // draw route to destination
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    // Geocode the most specific captured location: street address + city when an
    // address is present, otherwise just the city. Cached per full query string.
    const trimmedAddress = address?.trim();
    const query =
      trimmedAddress && trimmedAddress.length > 3
        ? `${trimmedAddress}, ${destName}`
        : destName || "";

    const drawPin = (dest: [number, number]) => {
      const pinIcon = L.divIcon({
        className: "leaflet-hala-icon",
        html: PIN_HTML,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const pickable = Boolean(onPickRef.current);
      const pin = L.marker(dest, { icon: pinIcon, draggable: pickable })
        .addTo(map)
        .bindTooltip(
          pickable
            ? `${destName || "Drop-off"} · drag or tap map to move`
            : destName || "Destination",
          { direction: "top" },
        );
      layersRef.current.push(pin);
      // We deliberately do NOT fire onPick for an auto geocode — only an
      // explicit drag/tap sets the confirmed pin. That keeps `pinned` empty
      // while the shopper types, so the typed address keeps re-geocoding and
      // moving the marker (a stuck pin would otherwise freeze the map).
      if (pickable) {
        pin.on("dragend", () => {
          const p = pin.getLatLng();
          onPickRef.current?.(p.lat, p.lng, "drag");
        });
      }
    };

    const drawRouteLines = (
      dest: [number, number],
      route: { coords: [number, number][]; km: string; min: number } | null,
    ) => {
      if (route) {
        const bg = L.polyline(route.coords, {
          color: "#C9B8E8",
          weight: 6,
          opacity: 0.5,
        }).addTo(map);
        const fg = L.polyline(route.coords, {
          color: "#4C2D8F",
          weight: 4,
          opacity: 0.95,
          className: "leaflet-track-line",
          dashArray: "8 8",
        }).addTo(map);
        layersRef.current.push(bg, fg);
        setStats({ km: route.km, min: route.min });
      }
      map.fitBounds(L.latLngBounds([SNOONU_HQ, dest]).pad(0.25));
    };

    const render = async (dest: [number, number], cacheKey: string) => {
      drawPin(dest);
      const cached = routeCache.get(cacheKey);
      if (cached) {
        drawRouteLines(dest, cached);
        return;
      }
      const route = await fetchRoute(dest);
      if (cancelled) return;
      if (route) routeCache.set(cacheKey, route);
      drawRouteLines(dest, route);
    };

    (async () => {
      layersRef.current.forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      // 1) A user-confirmed coordinate (located / tapped / dragged) wins.
      if (pinned) {
        await render(
          [pinned.lat, pinned.lng],
          `pin:${pinned.lat},${pinned.lng}`,
        );
        return;
      }

      // 2) Otherwise geocode the typed address / city (cached), then fall back
      //    to the district centre so a pin + route always show.
      if (!destName) return;
      let dest = geoCache.get(query) ?? (await geocode(query));
      if (cancelled) return;
      if (!dest) dest = districtCoord(destName);
      if (!dest) return;
      geoCache.set(query, dest);
      await render(dest, query);
    })();

    return () => {
      cancelled = true;
    };
  }, [destName, address, pinned?.lat, pinned?.lng, pinned]);

  return (
    <div>
      <div ref={elRef} className="zone-map-leaflet" style={{ height: 240 }} />
      {stats && <RouteInfo km={stats.km} min={stats.min} />}
    </div>
  );
}
