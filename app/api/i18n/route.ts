/** GET /api/i18n?lang=si — real LLM-translated UI strings (cached server-side). */
import { translateStrings } from "@/lib/agents/i18n/translate";
import { activeProviderConfigured } from "@/lib/llm";
import { T } from "@/lib/i18n/i18n";
import type { Lang } from "@/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const lang = (new URL(request.url).searchParams.get("lang") || "en") as Lang;
  // English is the source; without a provider we honestly fall back to English.
  if (lang === "en" || !activeProviderConfigured()) {
    return Response.json({ lang, strings: T.en });
  }
  try {
    return Response.json({ lang, strings: await translateStrings(lang) });
  } catch {
    return Response.json({ lang, strings: T.en });
  }
}
