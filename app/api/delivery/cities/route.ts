/** GET /api/delivery/cities?q=kandy — resolve Snoonu delivery cities/aliases. */
import { findCities } from "@/lib/agents/specialists/delivery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 2) return Response.json({ cities: [] });
  try {
    const cities = await findCities(query, 8);
    return Response.json({ cities });
  } catch (err) {
    return Response.json(
      {
        cities: [],
        error: err instanceof Error ? err.message : "lookup failed",
      },
      { status: 502 },
    );
  }
}
