/** GET /api/track?order=VIMP34456CB2 — look up a Kapruka order's progress. */
import { track } from "@/lib/agents/specialists/tracking";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const order = new URL(request.url).searchParams.get("order")?.trim();
  if (!order || order.length < 4) {
    return Response.json({ error: "valid order number required" }, { status: 400 });
  }
  try {
    const result = await track(order);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { data: null, text: "", error: err instanceof Error ? err.message : "tracking failed" },
      { status: 502 },
    );
  }
}
