/** GET /api/gift-notes?occasion=romance&lang=si — real LLM gift-card suggestions. */
import { giftNotes } from "@/lib/agents/content/gift-notes";
import { activeProviderConfigured } from "@/lib/llm";
import type { Lang } from "@/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const occasion = searchParams.get("occasion");
  const lang = (searchParams.get("lang") || "en") as Lang;
  if (!activeProviderConfigured()) return Response.json({ notes: [] });
  try {
    return Response.json({ notes: await giftNotes(occasion, lang) });
  } catch {
    return Response.json({ notes: [] });
  }
}
