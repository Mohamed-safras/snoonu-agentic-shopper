/**
 * Qatar's 8 municipalities (geographic facts) + a PREDICTED delivery window
 * derived from the real road-distance from Snoonu HQ. This is an estimate
 * for the delivery-zones map — the authoritative fee/feasibility for a
 * specific city always comes from the live MCP `check_delivery` (matches the
 * tiering in the mock server's `src/tools/delivery.py`).
 */

export const SNOONU_HQ = { lat: 25.3548, lng: 51.4326 }; // West Bay / Lusail, Doha

export interface District {
  name: string;
  lat: number;
  lng: number;
}

/** Municipality centres (lat/lng) — matches scripts/seed.py's QATAR_CITIES. */
export const DISTRICTS: District[] = [
  { name: "Doha", lat: 25.2854, lng: 51.531 },
  { name: "Al Rayyan", lat: 25.2919, lng: 51.4244 },
  { name: "Al Wakrah", lat: 25.1659, lng: 51.6038 },
  { name: "Umm Salal", lat: 25.4151, lng: 51.3973 },
  { name: "Al Khor", lat: 25.6804, lng: 51.4989 },
  { name: "Al Daayen", lat: 25.5197, lng: 51.4926 },
  { name: "Al Shamal", lat: 26.1167, lng: 51.2167 },
  { name: "Al Shahaniya", lat: 25.3705, lng: 51.1969 },
];

/** Great-circle distance in km (Haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface ZonePrediction {
  name: string;
  km: number;
  /** Estimated delivery window. */
  eta: string;
  /** 0 = fastest tier → for colour banding. */
  tier: 0 | 1 | 2 | 3;
}

/** Predict a delivery window from road-distance to Snoonu HQ. Qatar's whole
 *  landmass is ~80km across (vs. Sri Lanka's ~450km), so these tiers are
 *  scaled down accordingly — matches `_tier()` in the mock server's
 *  `src/tools/delivery.py`. */
export function predictZone(district: District): ZonePrediction {
  const km = Math.round(distanceKm(SNOONU_HQ, district));
  let eta: string;
  let tier: 0 | 1 | 2 | 3;
  if (km <= 10) {
    eta = "Same day";
    tier = 0;
  } else if (km <= 30) {
    eta = "Same day / next day";
    tier = 1;
  } else if (km <= 55) {
    eta = "Next day";
    tier = 2;
  } else {
    eta = "1–2 days";
    tier = 3;
  }
  return { name: district.name, km, eta, tier };
}

/** All 8 municipalities with predicted windows, nearest first. */
export function predictedZones(): ZonePrediction[] {
  return DISTRICTS.map(predictZone).sort((a, b) => a.km - b.km);
}
