/**
 * Dynamic "Surprise me" concierge quiz. The recipient / budget / vibe options
 * are generated fresh by the LLM (grounded in the REAL Snoonu category list and
 * phrased in the shopper's language) so the widget varies between sessions —
 * never a hardcoded list. Falls back to live-category-derived options only when
 * no LLM is configured or a call fails.
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

export interface SurpriseOption {
  /** Natural-language fragment fed into the search brief. */
  value: string;
  /** Short button label. */
  label: string;
  /** Leading emoji. */
  emoji: string;
}
export interface SurpriseQuiz {
  recipients: SurpriseOption[];
  budgets: SurpriseOption[];
  vibes: SurpriseOption[];
}

let catCache: { at: number; names: string[] } | null = null;
async function categoryNames(): Promise<string[]> {
  if (catCache && Date.now() - catCache.at < 30 * 60 * 1000)
    return catCache.names;
  const res = await listCategories(1);
  const names = res.categories.map((c) => c.name).filter(Boolean);
  if (names.length) catCache = { at: Date.now(), names };
  return names;
}

// Resilience-only fallback (no LLM configured / call failed). Recipients &
// budgets are universal gifting facts; vibes are derived from REAL categories.
function derive(categories: string[]): SurpriseQuiz {
  const vibeFrom = (
    keyword: string,
    label: string,
    emoji: string,
  ): SurpriseOption | null => {
    const match = categories.find((name) =>
      name.toLowerCase().includes(keyword),
    );
    return match ? { value: match.toLowerCase(), label, emoji } : null;
  };
  const vibes = [
    vibeFrom("flower", "Flowers", "🌹"),
    vibeFrom("cake", "Cakes", "🍰"),
    vibeFrom("chocolate", "Chocolate", "🍫"),
    vibeFrom("hamper", "Hampers", "🧺"),
    vibeFrom("jewell", "Jewellery", "💎"),
    vibeFrom("fruit", "Fruit", "🍓"),
  ].filter(Boolean) as SurpriseOption[];
  return {
    recipients: [
      { value: "my partner", label: "Partner", emoji: "💖" },
      { value: "my mum", label: "Mum", emoji: "🌷" },
      { value: "my dad", label: "Dad", emoji: "☕" },
      { value: "a friend", label: "A friend", emoji: "🥂" },
      { value: "a kid", label: "A kid", emoji: "🎈" },
      { value: "anyone", label: "Anyone", emoji: "✨" },
    ],
    budgets: [
      { value: "under Rs 5000", label: "Under 5k", emoji: "💸" },
      { value: "around Rs 10000", label: "5k–15k", emoji: "🎁" },
      { value: "premium, money no object", label: "Premium", emoji: "👑" },
    ],
    vibes: vibes.length
      ? vibes.slice(0, 4)
      : [
          { value: "sweet and romantic", label: "Romantic", emoji: "🌹" },
          { value: "fun and playful", label: "Playful", emoji: "🎉" },
          { value: "elegant and classy", label: "Elegant", emoji: "💎" },
          { value: "tasty treats", label: "Treats", emoji: "🍰" },
        ],
  };
}

const isValidOption = (candidate: unknown): candidate is SurpriseOption =>
  !!candidate &&
  typeof (candidate as SurpriseOption).value === "string" &&
  typeof (candidate as SurpriseOption).label === "string" &&
  typeof (candidate as SurpriseOption).emoji === "string";

// Short per-language cache so a double-mount (dev strict mode) or rapid reopen
// doesn't burn quota — but it expires fast so the widget keeps varying.
const cache = new Map<Lang, { at: number; value: SurpriseQuiz }>();
const TTL = 45 * 1000;
const lastGood = new Map<Lang, SurpriseQuiz>();

export async function surpriseQuiz(lang: Lang): Promise<SurpriseQuiz> {
  const cached = cache.get(lang);
  if (cached && Date.now() - cached.at < TTL) return cached.value;

  const categories = await categoryNames().catch(() => []);
  if (!activeProviderConfigured())
    return lastGood.get(lang) ?? derive(categories);

  const categoryList = categories.slice(0, 28).join(", ");
  try {
    const response = await getProvider().generate({
      fast: true,
      system:
        `You power a playful 3-tap gift-finder quiz for Snoonu (Qatar's leading super app). ` +
        `Ground the "vibes" in these REAL categories where sensible: ${categoryList || "flowers, cakes, chocolates, hampers, jewellery"}. ` +
        `Reply in ${LANG_HINT[lang]}. Return ONLY JSON of this exact shape:\n` +
        `{"recipients":[{"value","label","emoji"}...6], "budgets":[{"value","label","emoji"}...3], "vibes":[{"value","label","emoji"}...4]}\n` +
        `- "value": a short natural-language fragment for a search brief (e.g. recipient "my elder sister", budget "under Rs 7500", vibe "elegant fresh flowers").\n` +
        `- "label": a 1–2 word button label. "emoji": one fitting emoji.\n` +
        `- budgets MUST be in Sri Lankan Rupees (Rs).\n` +
        `Make the choices feel fresh and varied — surprise me.`,
      messages: [
        {
          role: "user",
          content: `Generate a fresh quiz. Variety token: ${Math.random()
            .toString(36)
            .slice(2, 8)}.`,
        },
      ],
      json: true,
      temperature: 0.95,
      maxTokens: 700,
    });
    const parsed = JSON.parse(
      response.text.slice(
        response.text.indexOf("{"),
        response.text.lastIndexOf("}") + 1,
      ),
    );
    const fallbackQuiz = lastGood.get(lang) ?? derive(categories);
    const pickOptions = (
      raw: unknown,
      limit: number,
      fallback: SurpriseOption[],
    ) => {
      const list = Array.isArray(raw)
        ? raw.filter(isValidOption).slice(0, limit)
        : [];
      return list.length >= 2 ? list : fallback;
    };
    const quiz: SurpriseQuiz = {
      recipients: pickOptions(parsed?.recipients, 6, fallbackQuiz.recipients),
      budgets: pickOptions(parsed?.budgets, 3, fallbackQuiz.budgets),
      vibes: pickOptions(parsed?.vibes, 4, fallbackQuiz.vibes),
    };
    cache.set(lang, { at: Date.now(), value: quiz });
    lastGood.set(lang, quiz);
    return quiz;
  } catch {
    return lastGood.get(lang) ?? derive(categories);
  }
}
