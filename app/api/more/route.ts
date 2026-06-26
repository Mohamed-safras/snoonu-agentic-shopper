/** GET /api/more — the next page of an existing product shelf ("View more").
 *  Continues a search via the MCP's own `next_cursor` (true pagination, not a
 *  re-search), so tapping "View more" reveals genuinely new options. Returns the
 *  next batch plus the cursor for the page after it (empty when exhausted). */
import { searchProducts } from "@/lib/mcp/tools";
import { toProductFromSearch } from "@/lib/mcp/adapters";
import { dedupeById } from "@/lib/catalog/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const numberOrUndefined = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") || "").trim();
  const cursor = (params.get("cursor") || "").trim();
  if (!query) return Response.json({ products: [], nextCursor: null });

  try {
    const raw = await searchProducts({
      query,
      category: params.get("category")?.trim() || undefined,
      min_price: numberOrUndefined(params.get("min_price")),
      max_price: numberOrUndefined(params.get("max_price")),
      cursor: cursor || undefined,
      limit: 48, // same page size as the initial shelf
    });
    return Response.json({
      products: dedupeById(raw.results.map(toProductFromSearch)),
      nextCursor: raw.next_cursor ?? null,
    });
  } catch {
    return Response.json({ products: [], nextCursor: null });
  }
}
