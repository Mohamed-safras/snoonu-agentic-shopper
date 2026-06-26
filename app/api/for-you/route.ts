/** GET /api/for-you?seeds=roses,headphones&exclude=id1,id2 — a personalized
 *  product feed built from the shopper's own signals (recent searches + cart
 *  categories). Runs a few real MCP searches, merges + dedupes, drops disliked
 *  ids. No hardcoded data. */
import { searchProducts } from "@/lib/mcp/tools";
import { toProductFromSearch } from "@/lib/mcp/adapters";
import { dedupeById, rankByRelevance } from "@/lib/catalog/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const seeds = (searchParams.get("seeds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3); // bounded — never flood the MCP
  const exclude = new Set(
    (searchParams.get("exclude") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (!seeds.length) return Response.json({ products: [] });

  try {
    const lists = await Promise.all(
      seeds.map(async (seed) => {
        const { results } = await searchProducts({ query: seed, limit: 12 });
        return rankByRelevance(
          dedupeById(results.map(toProductFromSearch)),
          seed,
        ).slice(0, 8);
      }),
    );
    const products = dedupeById(lists.flat())
      .filter((product) => product.price > 0 && !exclude.has(product.id))
      .slice(0, 18);
    return Response.json({ products });
  } catch {
    return Response.json({ products: [] });
  }
}
