/** POST /api/translate { lang, texts:[] } — translate UI copy + chat lines into a
 *  target language. Prefers the LLM translator: literal machine translation
 *  (Google) reads word-for-word and confuses native Sinhala/Tamil speakers, while
 *  the LLM can write the natural, colloquial register people actually speak.
 *  Falls back to Google MT if no LLM provider is configured (or the LLM call
 *  fails), and finally to the originals (English) if neither is available. */
import { translateTexts } from "@/lib/agents/i18n/translate-text";
import {
  machineTranslate,
  machineTranslationConfigured,
} from "@/lib/i18n/machine-translation";
import { activeProviderConfigured } from "@/lib/llm";
import type { Lang } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: { lang?: Lang; sourceLang?: Lang; texts?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ texts: [] }, { status: 400 });
  }
  const lang = (body.lang || "en") as Lang;
  // The language the input text is ACTUALLY written in — defaults to English
  // (true for UI copy/banners/compare output), but chat lines that were
  // originally written/replied in Sinhala or Tamil must say so, otherwise the
  // MT engine assumes an English source and silently fails to translate them.
  const sourceLang = (body.sourceLang || "en") as Lang;
  const texts = Array.isArray(body.texts)
    ? body.texts.filter((text): text is string => typeof text === "string")
    : [];
  if (!texts.length) return Response.json({ texts: [] });

  // Translate each unique string once (callers may send repeats — e.g. the
  // same confirmation line across several messages) then expand back to the
  // original order/length, so duplicates never cost extra MT/LLM calls.
  const uniqueTexts = [...new Set(texts)];
  const translateUnique = async (): Promise<string[]> => {
    // Prefer the LLM: it produces natural, colloquial phrasing instead of MT's
    // literal word-for-word output (the source of native-speaker confusion).
    if (activeProviderConfigured()) {
      try {
        return await translateTexts(uniqueTexts, lang);
      } catch {
        /* fall through to MT / originals */
      }
    }
    // No LLM provider → the dedicated MT engine (fast, non-LLM, strong si/ta) if
    // configured, else the originals (English).
    if (!machineTranslationConfigured()) return uniqueTexts;
    try {
      return await machineTranslate(uniqueTexts, lang, sourceLang);
    } catch {
      return uniqueTexts;
    }
  };

  const translatedUnique = await translateUnique();
  const translationByText = new Map(
    uniqueTexts.map((text, index) => [text, translatedUnique[index] ?? text]),
  );
  return Response.json({
    texts: texts.map((text) => translationByText.get(text) ?? text),
  });
}
