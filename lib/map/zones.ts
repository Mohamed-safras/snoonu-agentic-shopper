/**
 * Sri Lanka's 25 administrative districts (geographic facts) + a PREDICTED
 * delivery window derived from the real road-distance from Kapruka HQ. This is
 * an estimate for the delivery-zones map — the authoritative fee/feasibility
 * for a specific city always comes from the live MCP `check_delivery`.
 */

export const KAPRUKA_HQ = { lat: 6.8728, lng: 79.8889 }; // Nugegoda

export interface District {
  name: string;
  lat: number;
  lng: number;
}

/** District capitals (lat/lng). */
export const DISTRICTS: District[] = [
  { name: "Colombo", lat: 6.9271, lng: 79.8612 },
  { name: "Gampaha", lat: 7.092, lng: 79.999 },
  { name: "Kalutara", lat: 6.5854, lng: 79.9607 },
  { name: "Kandy", lat: 7.2906, lng: 80.6337 },
  { name: "Matale", lat: 7.4675, lng: 80.6234 },
  { name: "Nuwara Eliya", lat: 6.9497, lng: 80.7891 },
  { name: "Galle", lat: 6.0535, lng: 80.221 },
  { name: "Matara", lat: 5.9549, lng: 80.555 },
  { name: "Hambantota", lat: 6.1241, lng: 81.1185 },
  { name: "Jaffna", lat: 9.6615, lng: 80.0255 },
  { name: "Kilinochchi", lat: 9.3803, lng: 80.3847 },
  { name: "Mannar", lat: 8.9776, lng: 79.9043 },
  { name: "Vavuniya", lat: 8.7514, lng: 80.4971 },
  { name: "Mullaitivu", lat: 9.2671, lng: 80.8142 },
  { name: "Batticaloa", lat: 7.7102, lng: 81.6924 },
  { name: "Ampara", lat: 7.2917, lng: 81.6726 },
  { name: "Trincomalee", lat: 8.5874, lng: 81.2152 },
  { name: "Kurunegala", lat: 7.4863, lng: 80.3623 },
  { name: "Puttalam", lat: 8.0362, lng: 79.8283 },
  { name: "Anuradhapura", lat: 8.3114, lng: 80.4037 },
  { name: "Polonnaruwa", lat: 7.9403, lng: 81.0188 },
  { name: "Badulla", lat: 6.9934, lng: 81.055 },
  { name: "Monaragala", lat: 6.8728, lng: 81.351 },
  { name: "Ratnapura", lat: 6.6828, lng: 80.3992 },
  { name: "Kegalle", lat: 7.2513, lng: 80.3464 },
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

/** Predict a delivery window from road-distance to Kapruka HQ. */
export function predictZone(district: District): ZonePrediction {
  const km = Math.round(distanceKm(KAPRUKA_HQ, district));
  let eta: string;
  let tier: 0 | 1 | 2 | 3;
  if (km <= 35) {
    eta = "Same day / next day";
    tier = 0;
  } else if (km <= 120) {
    eta = "1–2 days";
    tier = 1;
  } else if (km <= 230) {
    eta = "2–3 days";
    tier = 2;
  } else {
    eta = "3–4 days";
    tier = 3;
  }
  return { name: district.name, km, eta, tier };
}

/** All 25 districts with predicted windows, nearest first. */
export function predictedZones(): ZonePrediction[] {
  return DISTRICTS.map(predictZone).sort((a, b) => a.km - b.km);
}
