/**
 * GET /api/discover?lang=en&recent=a,b&cart=flowers,cake&n=8
 * Dynamic, behavior-personalized suggestion chips grounded in real Kapruka data.
 */
import { discoverSuggestions } from "@/lib/agents/content/discover";
import type { Lang } from "@/types";

export const runtime = "nodejs";

function csv(value: string | null): string[] {
  return (value || "")
    .split(",")
    .map((char) => char.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const lang = (searchParams.get("lang") || "en") as Lang;
  const n = Math.min(12, Math.max(3, Number(searchParams.get("n")) || 10));
  try {
    const result = await discoverSuggestions({
      lang,
      recent: csv(searchParams.get("recent")),
      cartCats: csv(searchParams.get("cart")),
      n,
    });
    return Response.json(result);
  } catch {
    return Response.json({ chips: [], placeholders: [] });
  }
}
