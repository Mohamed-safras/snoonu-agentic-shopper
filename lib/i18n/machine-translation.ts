/**
 * Non-LLM machine translation for UI copy + thread re-translation, via Google
 * Cloud Translation v2 (plain API key — strong Sinhala & Tamil). Keeps the LLM
 * reserved for agent work; results are cached client-side so each string is
 * translated once and then served instantly.
 *
 * `{placeholders}` are protected across translation: they're swapped for numbered
 * tokens the engine won't translate, then restored — so word-order changes in
 * Sinhala/Tamil keep the right placeholder in the right spot.
 */
import "server-only";
import { config } from "@/configs/env";
import type { Lang } from "@/types";

/** Google Translation language codes for our languages. */
const ENGINE_CODE: Record<Lang, string> = {
  en: "en",
  ar: "ar",
  si: "si",
  ta: "ta",
};

/** True if the machine-translation backend (Google) has an API key configured. */
export function machineTranslationConfigured(): boolean {
  return Boolean(config.machineTranslation.googleTranslationApiKey);
}

/** Replace `{name}` → `{0}` (numbered, order-stable) so the engine leaves them
 *  alone; returns the masked text + the original tokens to restore afterwards. */
function maskPlaceholders(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(/\{[^}]+\}/g, (match) => {
    const index = tokens.push(match) - 1;
    return `{${index}}`;
  });
  return { masked, tokens };
}

function restorePlaceholders(text: string, tokens: string[]): string {
  return text.replace(
    /\{(\d+)\}/g,
    (whole, index) => tokens[Number(index)] ?? whole,
  );
}

async function googleTranslate(
  masked: string[],
  lang: Lang,
  sourceLang: Lang,
): Promise<string[]> {
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${config.machineTranslation.googleTranslationApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: masked,
        source: ENGINE_CODE[sourceLang],
        target: ENGINE_CODE[lang],
        format: "text",
      }),
    },
  );
  if (!response.ok) throw new Error(`Google Translate ${response.status}`);
  const data = (await response.json()) as {
    data: { translations: { translatedText: string }[] };
  };
  return data.data.translations.map((t, i) => t?.translatedText ?? masked[i]);
}

/**
 * Translate `texts` from `sourceLang` (default English) into `lang` via the
 * configured MT engine. Returns the same array length/order; on any failure,
 * for an English target, or when source and target already match, returns the
 * originals unchanged.
 */
export async function machineTranslate(
  texts: string[],
  lang: Lang,
  sourceLang: Lang = "en",
): Promise<string[]> {
  if (!texts.length || lang === "en" || lang === sourceLang) return texts;
  const maskedText = texts.map(maskPlaceholders);
  const translated = await googleTranslate(
    maskedText.map((text) => text.masked),
    lang,
    sourceLang,
  );
  return translated.map((text, index) =>
    restorePlaceholders(text, maskedText[index].tokens),
  );
}
