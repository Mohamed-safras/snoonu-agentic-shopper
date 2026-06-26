/** GET /api/delivery/quote?city=Doha&date=2026-06-20&product=flowers00t2075 */
import { quoteDelivery } from "@/lib/agents/specialists/delivery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const city = searchParams.get("city");
  if (!city) return Response.json({ error: "city required" }, { status: 400 });
  try {
    const quote = await quoteDelivery(
      city,
      searchParams.get("date") ?? undefined,
      searchParams.get("product") ?? undefined,
    );
    return Response.json({ quote });
  } catch (err) {
    return Response.json(
      {
        quote: null,
        error: err instanceof Error ? err.message : "quote failed",
      },
      { status: 502 },
    );
  }
}
