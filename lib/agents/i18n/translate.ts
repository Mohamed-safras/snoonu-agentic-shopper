/**
 * Real translation of UI chrome via the active LLM. English is the source of
 * truth (lib/i18n.ts); other locales are generated on demand and cached, so no
 * translations are hand-authored / hardcoded.
 */
import "server-only";
import { getProvider } from "@/lib/llm";
import { T, type Strings } from "@/lib/i18n/i18n";
import type { Lang } from "@/types";

const LANG_NAME: Record<Exclude<Lang, "en">, string> = {
  ar: "Arabic (العربية script)",
  si: "Sinhala (සිංහල script)",
  ta: "Tamil (தமிழ் script)",
};

const cache = new Map<Lang, Strings>();

function extractJson(text: string): unknown {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}

/** Merge a (possibly partial) translated object over the English source. */
function coerce(raw: unknown): Strings {
  const r = (raw ?? {}) as Partial<Strings> & { chips?: unknown };
  const chips = Array.isArray(r.chips) && r.chips.length === 4 ? (r.chips as string[]) : T.en.chips;
  return {
    online: r.online ?? T.en.online,
    cart: r.cart ?? T.en.cart,
    empty_cart: r.empty_cart ?? T.en.empty_cart,
    subtotal: r.subtotal ?? T.en.subtotal,
    delivery: r.delivery ?? T.en.delivery,
    total: r.total ?? T.en.total,
    checkout: r.checkout ?? T.en.checkout,
    add: r.add ?? T.en.add,
    free: r.free ?? T.en.free,
    greet_title: r.greet_title ?? T.en.greet_title,
    greet_body: r.greet_body ?? T.en.greet_body,
    suggest: r.suggest ?? T.en.suggest,
    chips: [chips[0], chips[1], chips[2], chips[3]],
    order_placed: r.order_placed ?? T.en.order_placed,
  };
}

export async function translateStrings(lang: Lang): Promise<Strings> {
  if (lang === "en") return T.en;
  const cached = cache.get(lang);
  if (cached) return cached;

  const provider = getProvider();
  const res = await provider.generate({
    translate: true,
    system: `You are a professional localizer for a Qatar-based e-commerce app. Translate every JSON string value into ${LANG_NAME[lang]}, writing in a warm, everyday spoken register, NOT a stiff literal or formal literary/news translation. Keep the JSON keys and array structure identical, keep emojis and the brand names "Trova" and "Snoonu" unchanged. Return ONLY the JSON object.`,
    messages: [{ role: "user", content: JSON.stringify(T.en) }],
    json: true,
    temperature: 0.3,
    maxTokens: 2000,
  });
  const raw = extractJson(res.text);
  const strings = coerce(raw);
  if (raw) cache.set(lang, strings); // never cache an English fallback
  return strings;
}
