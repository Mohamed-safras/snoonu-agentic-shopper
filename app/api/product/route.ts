/** GET /api/product?id=flowers00t2075 — full product detail (variants/images). */
import { getProduct } from "@/lib/mcp/tools";
import { toProductFromDetail } from "@/lib/mcp/adapters";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  try {
    const raw = await getProduct(id);
    return Response.json({ product: raw ? toProductFromDetail(raw) : null });
  } catch (err) {
    return Response.json(
      { product: null, error: err instanceof Error ? err.message : "lookup failed" },
      { status: 502 },
    );
  }
}
