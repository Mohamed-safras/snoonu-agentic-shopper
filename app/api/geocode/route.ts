/**
 * GET /api/geocode — server-side geocoding proxy with a fallback provider.
 *   ?lat=&lng=  → reverse geocode → { address, city }
 *   ?q=         → forward search  → { results: [{label,lat,lng}] }
 *
 * Proxied server-side (proper User-Agent) and dual-provider — Nominatim first,
 * then Photon/Komoot — because a single provider frequently rate-limits (429),
 * which is what made client-side autofill fail.
 */
export const runtime = "nodejs";

const UA = "HalaShoppingConcierge/1.0 (Snoonu Agent Challenge)";

interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    if (!res.headers.get("content-type")?.includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const join = (parts: (string | undefined)[]) => parts.filter(Boolean).join(", ");

/* ----------------------------- Nominatim (OSM) ---------------------------- */
function nominatimAddress(parts: Record<string, string>): string {
  return join([
    parts.house_number,
    parts.road || parts.pedestrian || parts.footway,
    parts.neighbourhood || parts.suburb || parts.hamlet,
    parts.city || parts.town || parts.village,
  ]);
}
function nominatimCity(parts: Record<string, string>): string | null {
  return (
    parts.city ||
    parts.town ||
    parts.village ||
    parts.suburb ||
    parts.county ||
    parts.state_district ||
    null
  );
}

/* ------------------------------- Photon ----------------------------------- */
function photonProps(p: Record<string, string>) {
  const label =
    join([
      join([p.housenumber, p.street].filter(Boolean)) || p.name,
      p.district || p.suburb,
      p.city || p.town || p.village,
    ]) ||
    p.name ||
    "";
  const city = p.city || p.town || p.village || p.county || p.state || null;
  return { label, city };
}

async function reverse(lat: string, lng: string) {
  const n = (await getJson(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
  )) as { address?: Record<string, string>; display_name?: string } | null;
  if (n?.address) {
    const address = nominatimAddress(n.address) || n.display_name || "";
    if (address) return { address, city: nominatimCity(n.address) };
  }
  const p = (await getJson(
    `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`,
  )) as { features?: { properties: Record<string, string> }[] } | null;
  const props = p?.features?.[0]?.properties;
  if (props) {
    const { label, city } = photonProps(props);
    if (label) return { address: label, city };
  }
  return { address: `${lat}, ${lng}`, city: null };
}

async function search(q: string): Promise<GeoResult[]> {
  const n = (await getJson(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=qa&q=${encodeURIComponent(q)}`,
  )) as { display_name: string; lat: string; lon: string }[] | null;
  if (Array.isArray(n) && n.length)
    return n.map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));

  // Photon, biased to Qatar's centre.
  const p = (await getJson(
    `https://photon.komoot.io/api?q=${encodeURIComponent(q)}&limit=6&lat=25.30&lon=51.20`,
  )) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: Record<string, string>;
    }[];
  } | null;
  return (p?.features ?? []).map((f) => ({
    label: photonProps(f.properties).label || f.properties.name || "",
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const q = searchParams.get("q");

  if (lat && lng) return Response.json(await reverse(lat, lng));
  if (q && q.trim().length >= 3)
    return Response.json({ results: await search(q.trim()) });
  return Response.json({ error: "missing lat/lng or q" }, { status: 400 });
}
