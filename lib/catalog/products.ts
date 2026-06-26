/** Small product helpers shared across agents/endpoints. */
import type { Product } from "@/types";

/** Remove duplicates by `id` (the Snoonu search can return repeats). */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "for",
  "to",
  "with",
  "and",
  "of",
  "in",
  "on",
  "my",
  "your",
  "her",
  "his",
  "gift",
  "gifts",
  "best",
  "nice",
  "good",
  "some",
  "something",
  "please",
  "want",
  "need",
  "buy",
  "get",
  "just",
  "pick",
  "order",
  "choose",
  "decide",
  "place",
  "handle",
  "under",
  "rs",
  "lkr",
  "delivery",
  "delivered",
  "today",
  "online",
  "snoonu",
]);

export function tokenize(string: string): string[] {
  return string
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

/** The most distinctive words of a product name, for a focused related search
 *  (so each product searches its OWN terms — not a generic catalog default). */
export function keyTerms(name: string, max = 8): string {
  return tokenize(name).slice(0, max).join(" ");
}

/** Catch-all categories that carry NO relevance signal — most of the Snoonu
 *  catalog is filed under these, so two items sharing one isn't "related". */
const GENERIC_CATEGORIES = new Set([
  "",
  "general",
  "gift",
  "gifts",
  "snoonu",
  "other",
  "others",
  "misc",
  "uncategorized",
  "uncategorised",
  "all",
]);
export function isGenericCategory(category?: string): boolean {
  return GENERIC_CATEGORIES.has((category ?? "").toLowerCase().trim());
}

/** How many products genuinely match the query keywords (name/category). Used
 *  as a confidence gate before showing a speculative search. */
export function strongMatchCount(
  products: Product[],
  queryString: string,
): number {
  const tokenizeQuery = tokenize(queryString);
  if (!tokenizeQuery.length) return 0;
  let count = 0;
  for (const product of products) {
    const tokens = tokenize(`${product.name} ${product.category ?? ""}`);
    if (
      tokenizeQuery.some((query) =>
        tokens.some(
          (token) =>
            token === query || token.includes(query) || query.includes(token),
        ),
      )
    )
      count++;
  }
  return count;
}

/** Read the literal item-count printed in a product NAME, e.g. "50 Red Roses"
 *  → 50, "6 Red Rose Bouquet" → 6. Pure data extraction, no interpretation. */
function countInName(name: string): number | null {
  const matched = name.match(/\b(\d{1,3})\b/);
  return matched ? parseInt(matched[1], 10) : null;
}

/**
 * Re-rank Snoonu's fuzzy search results by how well each product actually
 * matches the query keywords (name/category/blurb), dropping the off-topic
 * tail. Falls back to the original MCP order when too few clearly match, so we
 * never end up with an empty/odd shelf.
 */
export function rankByRelevance(
  products: Product[],
  query: string,
  requestedCount?: number | null,
): Product[] {
  const queryTokens = tokenize(query);
  if (!queryTokens.length || products.length <= 1) return products;

  const scored = products.map((product, i) => {
    const productTokens = tokenize(
      `${product.name} ${product.category ?? ""} ${product.blurb ?? ""}`,
    );
    const tokenSet = new Set(productTokens);
    let score = 0;
    for (const queryToken of queryTokens) {
      if (tokenSet.has(queryToken)) score += 3;
      else if (
        productTokens.some(
          (productToken) =>
            productToken.includes(queryToken) ||
            queryToken.includes(productToken),
        )
      )
        score += 1; // partial/plural
    }
    // When the shopper asked for a specific item count (decided by the LLM from
    // context — NOT a hardcoded rule), prefer the exact printed count, then nearest.
    if (requestedCount != null) {
      const productCount = countInName(product.name);
      if (productCount != null) {
        // Linear gradient: exact = +10, each unit away loses 1 (floored at 0),
        // so the closest available count ranks clearly highest.
        score += Math.max(0, 10 - Math.abs(productCount - requestedCount));
      }
    }
    // Deal priority: among relevant items, float real discounts (genuine MCP
    // compare_at_price) to the top, scaled by how deep the discount is.
    if (score > 0 && product.oldPrice && product.oldPrice > product.price) {
      const pct = (product.oldPrice - product.price) / product.oldPrice;
      score += 2 + Math.min(3, Math.round(pct * 6)); // +2..+5
    }
    return { product, score, i };
  });

  const matched = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);

  // Require a couple of genuine matches before trusting the re-rank; otherwise
  // the query words simply don't appear in names — keep MCP's own ranking.
  if (matched.length < 2) return products;
  return matched.map((entry) => entry.product);
}

/**
 * Rank "you may also like" candidates by relevance to the product being viewed.
 * Signals, strongest first:
 *   1. Same category as the source (the dominant relevance signal).
 *   2. Shared significant name/category tokens.
 *   3. Similar price tier (same budget bracket).
 * A confidence gate drops clearly off-topic items so we only surface solid
 * matches; if too few pass, we fall back to the best-ranked pool so the section
 * is never empty.
 */
export function rankRelated(
  candidates: Product[],
  source: { id: string; name: string; category?: string; price?: number },
  limit = 12,
): Product[] {
  const sourceTokens = new Set(
    tokenize(`${source.name} ${source.category ?? ""}`),
  );
  const sourceCategory = (source.category ?? "").toLowerCase().trim();

  const scored = dedupeById(candidates)
    .filter((product) => product.id && product.id !== source.id)
    .map((product) => {
      let score = 0;

      // 1) Category match — the clearest "same kind of thing" signal, BUT only
      // for real categories. Most of the catalog is filed under "general", so
      // matching on a generic category is a false signal (earbuds "match" a
      // platter). Skip the boost entirely when either side is generic.
      const productCategory = (product.category ?? "").toLowerCase().trim();
      if (
        sourceCategory &&
        productCategory &&
        !isGenericCategory(sourceCategory) &&
        !isGenericCategory(productCategory)
      ) {
        if (productCategory === sourceCategory) score += 6;
        else if (
          productCategory.includes(sourceCategory) ||
          sourceCategory.includes(productCategory)
        )
          score += 4;
      }

      // 2) Shared significant tokens between the two product names.
      const tokens = tokenize(`${product.name} ${product.category ?? ""}`);
      let overlap = 0;
      for (const token of tokens) {
        if (sourceTokens.has(token)) overlap += 1;
        else if (
          [...sourceTokens].some(
            (sourceToken) =>
              sourceToken.includes(token) || token.includes(sourceToken),
          )
        )
          overlap += 0.4;
      }
      score += Math.min(overlap, 4) * 1.5;

      // 3) Price proximity — keep suggestions in a comparable budget tier.
      if (source.price && product.price) {
        const ratio =
          Math.min(source.price, product.price) /
          Math.max(source.price, product.price);
        if (ratio >= 0.5) score += 2;
        else if (ratio >= 0.25) score += 1;
      }

      return { product, score };
    })
    .sort((a, b) => b.score - a.score);

  // Confidence gate: a relevant item shares a category OR real name tokens.
  const strong = scored
    .filter((entry) => entry.score >= 4)
    .map((entry) => entry.product);
  if (strong.length >= 3) return strong.slice(0, limit);

  // Low similarity (nothing strongly matches): show the NEAREST items by price
  // tier rather than a fixed generic set — varies per product and still feels
  // relevant ("around the same kind of spend").
  const rest = scored.map((entry) => entry.product);
  if (source.price) {
    rest.sort(
      (a, b) =>
        Math.abs((a.price ?? Infinity) - source.price!) -
        Math.abs((b.price ?? Infinity) - source.price!),
    );
  }
  return dedupeById([...strong, ...rest]).slice(0, limit);
}
