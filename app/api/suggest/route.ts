/**
 * GET /api/suggest?q=ros — real search suggestions from the live Kapruka
 * catalog. Re-ranks the MCP's fuzzy results by how well each product actually
 * matches the typed query (and drops the off-topic tail) so the dropdown stays
 * relevant. Backs the composer autosuggest.
 */
import { searchProducts } from "@/lib/mcp/tools";
import { toProductFromSearch } from "@/lib/mcp/adapters";
import { dedupeById, rankByRelevance } from "@/lib/catalog/products";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") || "").trim();
  if (query.length < 2) return Response.json({ suggestions: [] });
  try {
    const response = await searchProducts({ query, limit: 12 });
    const ranked = rankByRelevance(
      dedupeById(response.results.map(toProductFromSearch)),
      query,
    );
    const suggestions = ranked.slice(0, 12).map((product) => ({
      text: product.name,
      kind: "product" as const,
      category: product.category,
    }));
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
