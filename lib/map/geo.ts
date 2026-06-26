/**
 * Map geo helpers: district-centre fallback, Nominatim geocoding, and OSRM
 * routing — with in-memory caches so the same destination is never re-fetched
 * (shared across the delivery card, order tracking, and re-opens).
 */
import { DISTRICTS } from "@/lib/map/zones";
import { SNOONU_HQ } from "./constants";

export interface RouteResult {
  coords: [number, number][];
  km: string;
  min: number;
}

// Cache geocode + route results per query string (fewer external calls).
export const geoCache = new Map<string, [number, number]>();
export const routeCache = new Map<string, RouteResult>();

/** Best-effort coordinate for a destination name from the known districts —
 *  the fallback when live geocoding is unavailable. */
export function districtCoord(name?: string): [number, number] | null {
  if (!name) return null;
  const n = name.toLowerCase();
  const match =
    DISTRICTS.find((d) => d.name.toLowerCase() === n) ||
    DISTRICTS.find(
      (d) =>
        n.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(n),
    );
  return match ? [match.lat, match.lng] : null;
}

/** Geocode a free-text place (within Qatar) to a coordinate via Nominatim. */
export async function geocode(query: string): Promise<[number, number] | null> {
  try {
    const geo = await fetch(
      "https://nominatim.openstreetmap.org/search?q=" +
        encodeURIComponent(query + " Qatar") +
        "&format=json&limit=1",
      { headers: { "Accept-Language": "en" } },
    ).then((r) => r.json());
    if (geo[0]) return [parseFloat(geo[0].lat), parseFloat(geo[0].lon)];
  } catch {
    /* geocoder unavailable */
  }
  return null;
}

/** Road route + distance/ETA from Snoonu HQ to a destination via OSRM. */
export async function fetchRoute(
  dest: [number, number],
): Promise<RouteResult | null> {
  try {
    const route = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${SNOONU_HQ[1]},${SNOONU_HQ[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`,
    ).then((r) => r.json());
    if (!route.routes?.[0]) return null;
    const coords = route.routes[0].geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]],
    ) as [number, number][];
    return {
      coords,
      km: (route.routes[0].distance / 1000).toFixed(1),
      min: Math.round(route.routes[0].duration / 60),
    };
  } catch {
    return null;
  }
}
