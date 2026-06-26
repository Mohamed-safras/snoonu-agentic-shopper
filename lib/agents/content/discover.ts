/**
 * Dynamic suggestion specialist. Produces (a) tappable chips and (b) natural
 * example search phrases for the input placeholder — both grounded in the REAL
 * Snoonu category list and personalized to the shopper's behavior (recent
 * searches + cart). Never a hardcoded list.
 */
import "server-only";
import { listCategories } from "@/lib/mcp/tools";
import { getProvider } from "@/lib/llm";
import { activeProviderConfigured } from "@/lib/llm";
import type { Lang } from "@/types";

const LANG_HINT: Record<Lang, string> = {
  en: "English",
  ar: "Arabic script",
  si: "Sinhala script",
  ta: "Tamil script",
};

let catCache: { at: number; names: string[] } | null = null;
async function categoryNames(): Promise<string[]> {
  if (catCache && Date.now() - catCache.at < 30 * 60 * 1000)
    return catCache.names;
  const res = await listCategories(1);
  const names = res.categories.map((c) => c.name).filter(Boolean);
  if (names.length) catCache = { at: Date.now(), names };
  return names;
}

export interface DiscoverResult {
  chips: string[];
  placeholders: string[];
}

// Surface gift/shopping-relevant real categories first when the LLM is
// unavailable — this only ORDERS live MCP categories (no invented suggestions),
// so the fallback shows "Flowers, Cakes…" instead of alphabetical "Automobile…".
const PRIORITY = [
  "flower",
  "cake",
  "chocolate",
  "hamper",
  "gift",
  "jewell",
  "fashion",
  "cloth",
  "watch",
  "fruit",
  "perfume",
  "cosmetic",
  "electronic",
  "grocery",
  "baby",
  "home",
  "book",
];
const priorityIndex = (name: string) => {
  const i = PRIORITY.findIndex((k) => name.toLowerCase().includes(k));
  return i === -1 ? 999 : i;
};

/**
 * Last-resort fallback used ONLY when no LLM is configured and we have no prior
 * dynamic result. Orders the live MCP categories by gift-relevance.
 */
function derive(cats: string[], n: number): DiscoverResult {
  const sorted = [...cats].sort((a, b) => priorityIndex(a) - priorityIndex(b));
  const chips = sorted.slice(0, n);
  const placeholders = sorted
    .slice(0, 5)
    .map((c) => `Find ${c.toLowerCase()}…`);
  return { chips, placeholders };
}

export interface DiscoverInput {
  lang: Lang;
  recent: string[];
  cartCats: string[];
  n: number;
}

const resultCache = new Map<string, { at: number; value: DiscoverResult }>();
const RESULT_TTL = 5 * 60 * 1000;
// Last successful LLM result per language — reused if a later call is rate-limited,
// so we keep serving dynamic (emoji'd, ordered) suggestions instead of plain ones.
const lastGood = new Map<Lang, DiscoverResult>();

export async function discoverSuggestions({
  lang,
  recent,
  cartCats,
  n,
}: DiscoverInput): Promise<DiscoverResult> {
  // Cache identical requests briefly so repeated UI refreshes don't burn quota.
  const key = `${lang}|${n}|${recent.join(",")}|${cartCats.join(",")}`;
  const hit = resultCache.get(key);
  if (hit && Date.now() - hit.at < RESULT_TTL) return hit.value;

  const cats = await categoryNames().catch(() => []);
  if (!activeProviderConfigured() || !cats.length)
    return lastGood.get(lang) ?? derive(cats, n);

  const personalized = recent.length || cartCats.length;
  // Trim the grounding list to keep input tokens small (saves daily quota).
  const catList = cats.slice(0, 28).join(", ");
  try {
    const res = await getProvider().generate({
      fast: true,
      system:
        `You power the suggestion UI for Snoonu (Qatar's leading super app). Ground EVERYTHING in these REAL categories: ${catList}. ` +
        `Reply in ${LANG_HINT[lang]}. Return ONLY JSON: {"chips":[...], "placeholders":[...]}.\n` +
        `- "chips": ${n} short tappable suggestions, 2–4 words each, with a leading emoji.\n` +
        `- "placeholders": 5 natural, specific example search phrases a shopper would TYPE (no emoji), crisp and varied, e.g. "a birthday cake for amma under Rs 5000", "red roses delivered to Kandy today".`,
      messages: [
        {
          role: "user",
          content:
            `Recent searches: ${recent.join("; ") || "none"}. Cart categories: ${cartCats.join(", ") || "none"}. ` +
            (personalized
              ? "Personalize toward related items and complements to what they're exploring."
              : "Span popular gifting + everyday needs."),
        },
      ],
      json: true,
      // Lower temperature → most-relevant, grounded picks. Freshness still comes
      // from the changing behavior inputs (recent searches + cart), not randomness.
      temperature: 0.4,
      maxTokens: 500,
    });
    const parsed = JSON.parse(
      res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1),
    );
    const chips: string[] = Array.isArray(parsed?.chips)
      ? parsed.chips.filter((c: unknown) => typeof c === "string")
      : [];
    const placeholders: string[] = Array.isArray(parsed?.placeholders)
      ? parsed.placeholders.filter((c: unknown) => typeof c === "string")
      : [];
    const fb = lastGood.get(lang) ?? derive(cats, n);
    const value: DiscoverResult = {
      chips: chips.length ? chips.slice(0, n) : fb.chips,
      placeholders: placeholders.length
        ? placeholders.slice(0, 6)
        : fb.placeholders,
    };
    resultCache.set(key, { at: Date.now(), value });
    if (chips.length) lastGood.set(lang, value);
    return value;
  } catch {
    return lastGood.get(lang) ?? derive(cats, n);
  }
}
