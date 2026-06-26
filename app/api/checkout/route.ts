/**
 * POST /api/checkout — create a REAL Kapruka guest order and return the Order
 * (with genuine pay link). Validates input via the checkout specialist's zod
 * schema; rate-guarded against the live order endpoint.
 */
import { placeOrder, OrderRateLimitError, type CheckoutRequest } from "@/lib/agents/specialists/checkout";
import { ordersRemaining } from "@/lib/mcp/order-guard";
import { friendlyMcpError, isRateLimit } from "@/lib/mcp/errors";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body?.cart?.length) {
    return Response.json({ error: "cart is empty" }, { status: 400 });
  }

  try {
    const order = await placeOrder(body);
    return Response.json({ order, ordersRemaining: ordersRemaining() });
  } catch (err) {
    if (err instanceof OrderRateLimitError) {
      return Response.json(
        { error: "Order limit reached for now — please try again shortly." },
        { status: 429 },
      );
    }
    if (isRateLimit(err)) {
      return Response.json({ error: friendlyMcpError(err) }, { status: 429 });
    }
    const raw = err instanceof Error ? err.message : "";
    // Hide transport noise, but DO surface a meaningful order/validation error
    // so the shopper knows what to fix (instead of a fake "order placed").
    const isTransport =
      /streamable http|posting to endpoint|fetch failed|econn|timeout|temporarily unavailable|\b5\d\d\b/i.test(
        raw,
      );
    return Response.json(
      {
        error:
          !raw || isTransport
            ? friendlyMcpError(err)
            : raw.slice(0, 200),
      },
      { status: 502 },
    );
  }
}
