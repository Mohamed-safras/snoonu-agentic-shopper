/** GET /api/popular-categories — the most popular Kapruka categories, ranked
 *  from the LIVE catalog: we read every category from kapruka_list_categories,
 *  then order them by how many products each actually has (a real popularity
 *  signal from MCP — no hardcoded category names or priorities). Each tile is
 *  fronted by a real, on-topic product photo, picked at random per request so
 *  the thumbnails vary. Computed once per server lifetime, then served fast. */
import { listCategories, searchProducts } from "@/lib/mcp/tools";

export const runtime = "nodejs";
// Each request returns a fresh random photo per category — never cache the response.
export const dynamic = "force-dynamic";

const SHOW = 15; // tiles to display (desktop is a 5×3 grid)
// Fetch up to the MCP max (50) per category so the product-count popularity
// signal differentiates better (a 36 cap made many categories tie at the top).
const SCAN_LIMIT = 50;
const SCAN_CONCURRENCY = 4; // gentle on the MCP — never flood it with requests

/** Map over items with a bounded number of in-flight promises, so we don't fire
 *  40+ MCP searches at once (which rate-limits the shared connection and starves
 *  the shopper's own searches). */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

interface CategoryTile {
  name: string;
  image?: string;
}

interface CategoryPool {
  name: string;
  images: string[];
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

// Categories explicitly hidden from the popular row (the shopper asked to drop
// Curd — niche / not a gift). Everything else is ranked by real product count.
const EXCLUDE = ["curd"];

/** On-topic product photos from a category's search results (items whose own
 *  category matches the tile come first; cross-category noise after). */
function imagesFrom(
  results: { image_url?: string; category?: { name?: string; slug?: string } }[],
  name: string,
): string[] {
  const target = normalise(name);
  const onTopic: string[] = [];
  const rest: string[] = [];
  for (const item of results) {
    if (!item.image_url) continue;
    const itemCategory = normalise(item.category?.name || item.category?.slug || "");
    const matches =
      itemCategory.includes(target) ||
      (target.length > 3 && itemCategory.length > 3 && target.includes(itemCategory));
    (matches ? onTopic : rest).push(item.image_url);
  }
  return onTopic.length ? onTopic : rest;
}

const randomItem = <T,>(list: T[]): T | undefined =>
  list.length ? list[Math.floor(Math.random() * list.length)] : undefined;

// Ranked candidate pools, computed once per server lifetime.
let pools: CategoryPool[] | null = null;

export async function GET() {
  try {
    if (!pools || !pools.length) {
      const names = (await listCategories(1)).categories
        .map((category) => category.name)
        .filter(Boolean)
        .filter((name) => !EXCLUDE.includes(normalise(name)));

      // Search every category once (bounded concurrency): the result count is
      // our live popularity signal, and the same results give us the photos.
      const scored = await mapWithConcurrency(names, SCAN_CONCURRENCY, async (name) => {
        try {
          const { results } = await searchProducts({
            query: name,
            limit: SCAN_LIMIT,
          });
          return { name, count: results.length, images: imagesFrom(results, name) };
        } catch {
          return { name, count: 0, images: [] as string[] };
        }
      });

      const ranked = scored
        .filter((category) => category.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, SHOW)
        .map(({ name, images }) => ({ name, images }));

      if (ranked.length) pools = ranked;
    }

    // Pick a fresh random photo per category on every request → dynamic each load.
    const tiles: CategoryTile[] = (pools ?? []).map((pool) => ({
      name: pool.name,
      image: randomItem(pool.images),
    }));
    return Response.json({ categories: tiles });
  } catch {
    return Response.json({ categories: [] });
  }
}
