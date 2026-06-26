/**
 * Dev-only smoke test for the Kapruka MCP layer. Exercises the read tools and
 * the adapters end-to-end so we can confirm real data shapes before the UI
 * depends on them. Does NOT create orders. Disabled in production.
 *
 *   GET /api/debug/mcp           → tools + search + categories
 *   GET /api/debug/mcp?q=cake&city=Galle&date=2026-06-20
 */
import { NextResponse } from "next/server";
import { listTools } from "@/lib/mcp/client";
import {
  checkDelivery,
  getProduct,
  listCategories,
  listDeliveryCities,
  searchProducts,
} from "@/lib/mcp/tools";
import { toCity, toProductFromDetail, toProductFromSearch, toQuote } from "@/lib/mcp/adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "red roses";
  const city = url.searchParams.get("city") || "Kandy";
  const date = url.searchParams.get("date") || "2026-06-20";

  try {
    const tools = (await listTools()).map((t) => t.name);

    const rawSearch = await searchProducts({ query: q, limit: 4 });
    const products = rawSearch.results.map(toProductFromSearch);

    const cats = await listCategories();

    const rawCities = await listDeliveryCities(city, 5);
    const cities = rawCities.cities.map(toCity);

    const rawQuote = await checkDelivery(cities[0]?.name || city, date, products[0]?.id);
    const quote = rawQuote ? toQuote(rawQuote) : null;

    const rawDetail = products[0] ? await getProduct(products[0].id) : null;
    const detail = rawDetail ? toProductFromDetail(rawDetail) : null;

    return NextResponse.json({
      ok: true,
      tools,
      counts: {
        products: products.length,
        categories: cats.categories.length,
        cities: cities.length,
      },
      products,
      categories: cats.categories.slice(0, 12),
      cities,
      quote,
      detail,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
