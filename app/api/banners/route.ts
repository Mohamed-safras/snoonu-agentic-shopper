/** GET /api/banners?lang=en — dynamic promo slides grounded in real Snoonu data. */
import { getBanners } from "@/lib/agents/content/banners";
import type { Lang } from "@/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const lang = (new URL(request.url).searchParams.get("lang") || "en") as Lang;
  try {
    return Response.json({ slides: await getBanners(lang) });
  } catch {
    return Response.json({ slides: [] });
  }
}
