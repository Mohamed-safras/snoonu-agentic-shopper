/**
 * GET /api/related?id=<productId>&q=<name>&cat=<category>&price=<amount>
 * Relevant "you may also like" products from the live Kapruka catalog. Builds a
 * candidate pool from BOTH the product's category (same-kind items) and its name
 * (close matches), then ranks by category + name-token + price relevance and
 * keeps only solid matches. Excludes the product being viewed.
 */
import { searchProducts } from "@/lib/mcp/tools";
import { toProductFromSearch } from "@/lib/mcp/adapters";
import { isGenericCategory, keyTerms, rankRelated } from "@/lib/catalog/products";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const searchParam = new URL(request.url).searchParams;
  const id = searchParam.get("id") || "";
  const query = (searchParam.get("q") || "").trim();
  const category = (searchParam.get("cat") || "").trim();
  const price = Number(searchParam.get("price")) || undefined;
  if (!query && !category) return Response.json({ products: [] });

  async function find(term: string) {
    if (!term) return [];
    try {
      const res = await searchProducts({
        query: term,
        limit: 12,
        currency: "LKR",
      });
      return res.results.map(toProductFromSearch);
    } catch {
      return [];
    }
  }

  // Pool = the product's OWN distinctive name terms (so the set varies per
  // product, not a generic catalog default) + its category for breadth — but
  // only if the category is REAL. Searching a generic bucket ("general") just
  // returns random catalog items, which is exactly what made suggestions wrong.
  const nameTerms = keyTerms(query) || query;
  // Broader "next level" term = the single most distinctive word (usually the
  // head noun), so niche products still get a fuller list of nearby items.
  const broadTerm =
    nameTerms.split(" ").sort((a, b) => b.length - a.length)[0] || "";
  const useCategory = !isGenericCategory(category) ? category : "";
  const [byName, byBroad, byCategory] = await Promise.all([
    find(nameTerms),
    find(broadTerm !== nameTerms ? broadTerm : ""),
    find(useCategory),
  ]);
  // rankRelated orders most-relevant first (exact name/category matches), then
  // the broader/next-level matches, then nearest-by-price — never a hard cut.
  const products = rankRelated(
    [...byName, ...byBroad, ...byCategory],
    { id, name: query, category, price },
    12,
  );
  return Response.json({ products });
}
