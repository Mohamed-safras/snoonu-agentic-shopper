/**
 * Dynamic promo banner slides — grounded in Snoonu's REAL catalog. The LLM
 * curates a few timely, seasonal themes from the live category list, and each
 * slide's background is a REAL Snoonu product image fetched from search. No
 * hardcoded occasions or images. Cached to spare quota.
 */
import "server-only";
import { listCategories, searchProducts } from "@/lib/mcp/tools";
import { getProvider } from "@/lib/llm";
import { activeProviderConfigured } from "@/lib/llm";
import {
  machineTranslate,
  machineTranslationConfigured,
} from "@/lib/i18n/machine-translation";
import type { RawSearchItem } from "@/lib/mcp/raw";
import type { BannerSlide, Lang } from "@/types";

// Cosmetic gradient backdrops (used under the real image / as fallback).
const BGS = ["#601020", "#1a2e1a", "#3d1800", "#4a0d1a", "#0e2436", "#3a1020"];

let catCache: { at: number; names: string[] } | null = null;
async function categoryNames(): Promise<string[]> {
  if (catCache && Date.now() - catCache.at < 30 * 60 * 1000)
    return catCache.names;
  const res = await listCategories(1);
  const names = res.categories.map((c) => c.name).filter(Boolean);
  if (names.length) catCache = { at: Date.now(), names };
  return names;
}

interface Theme {
  title: string;
  tagline: string;
  badge?: string;
  offer?: string;
  countdownHours?: number;
  query: string;
}

// No-LLM fallback themes from REAL categories only. Their badge/offer are
// derived later from real product data (discounts / stock) — never invented.
function fallbackThemes(cats: string[]): Theme[] {
  const sorted = [...cats].sort((a, b) => priorityIndex(a) - priorityIndex(b));
  return sorted.slice(0, 6).map((c) => ({
    title: c,
    tagline: `Shop ${c.toLowerCase()} on Snoonu`,
    query: c,
  }));
}

/** Derive a truthful promo from a real product: actual discount, then stock. */
function realPromo(item?: RawSearchItem): { offer?: string; badge?: string } {
  if (!item) return {};
  const now = item.price?.amount;
  const was = item.compare_at_price?.amount;
  if (was && now && was > now) {
    const pct = Math.round(((was - now) / was) * 100);
    if (pct >= 5) return { offer: `Up to ${pct}% off`, badge: "On Sale" };
  }
  if (item.stock_level === "low") return { badge: "Few left" };
  return {};
}

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
  const l = name.toLowerCase();
  const i = PRIORITY.findIndex((k) => l.includes(k));
  return i === -1 ? 999 : i;
};

async function curateThemes(cats: string[]): Promise<Theme[]> {
  if (!activeProviderConfigured() || !cats.length) return fallbackThemes(cats);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await getProvider().generate({
      fast: true,
      system:
        `You curate the homepage promo banner for Snoonu (Qatar's leading super app). Today is ${today}. ` +
        `Choose 6 timely, appealing themes a shopper would tap — consider the season and any nearby occasions/festivals. ` +
        `Ground every theme in these REAL categories: ${cats.slice(0, 28).join(", ")}. Each theme must map to CONCRETE products that exist (e.g. "Chocolate Hampers", "Fresh Flowers", "Father's Day Watches") — NOT abstract promos like "Summer Sale". ` +
        `CRITICAL — "query" is fed straight into product search and its FIRST result becomes the slide's background IMAGE, so it MUST be ONE short, concrete product phrase (2–4 words) that depicts EXACTLY the title's theme (e.g. title "Eid Mubarak Gifts" → query "eid gift hamper"; "Fresh Flowers" → "rose bouquet"; "Birthday Treats" → "birthday cake"). It must NOT be a comma-separated list and must NOT just echo category names. The title, tagline and query must all describe the SAME product/occasion — NEVER mix unrelated cultural or religious items (e.g. do not pair an Eid theme with Buddhist "pirikara" items). ` +
        `Make each slide feel like a LIVE marketing promotion: ` +
        `"badge" = short flair ("Featured","Trending","In Season","Top Gift","New In"); ` +
        `"offer" = an enticing promo line ("Up to 30% off","Buy 1 Get 1 Free","Free island-wide delivery","Flash deal"); ` +
        `"countdownHours" = an integer 6–72 for the limited-time window (rendered as a live countdown). ` +
        `Write all text in English (it is machine-translated to the shopper's language afterwards, so every language shows the same slides). Return ONLY JSON: {"slides":[{"title":"2-3 words","tagline":"max 6 words","badge":"tag","offer":"promo line","countdownHours":24,"query":"concrete product keywords"}]}.`,
      messages: [{ role: "user", content: "Curate 6 banner themes." }],
      json: true,
      temperature: 0.5,
      maxTokens: 600,
    });
    const parsed = JSON.parse(
      res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1),
    );
    const slides = Array.isArray(parsed?.slides) ? parsed.slides : [];
    const themes: Theme[] = slides
      .filter((s: unknown) => s && typeof (s as Theme).query === "string")
      .map((s: Theme) => ({
        title: String(s.title || ""),
        tagline: String(s.tagline || ""),
        badge: s.badge ? String(s.badge) : undefined,
        offer: s.offer ? String(s.offer) : undefined,
        countdownHours:
          typeof s.countdownHours === "number" && s.countdownHours > 0
            ? Math.min(72, Math.round(s.countdownHours))
            : undefined,
        // Defensive: if the model returns a comma list, keep only the first
        // (primary) phrase so the image + "Shop now" search stay on-theme.
        query: String(s.query).split(",")[0].trim() || String(s.query),
      }))
      .slice(0, 8);
    return themes.length ? themes : fallbackThemes(cats);
  } catch {
    return fallbackThemes(cats);
  }
}

const TTL = 30 * 60 * 1000;

// The slides are curated ONCE in English (with real product images), then
// machine-translated per language — so at any moment EVERY language shows the
// SAME slides, just translated (it can still change over time as the cache
// expires). `englishCache` holds the source; `cache` holds translated results.
let englishCache: { at: number; value: BannerSlide[] } | null = null;
const cache = new Map<Lang, { at: number; value: BannerSlide[] }>();

/** Curate the English slides and attach a real Snoonu product image to each. */
async function buildEnglishSlides(): Promise<BannerSlide[]> {
  const cats = await categoryNames().catch(() => []);
  const themes = await curateThemes(cats);

  // Attach a REAL Snoonu product image to each theme (in parallel). Try the
  // query, then the title, then its head noun — pick the first result with an image.
  return Promise.all(
    themes.map(async (t, i): Promise<BannerSlide> => {
      const terms = [
        t.query,
        t.title,
        t.query.trim().split(/\s+/).slice(-1)[0],
      ].filter(Boolean);
      let matched: RawSearchItem | undefined;
      for (const term of terms) {
        try {
          const r = await searchProducts({
            query: term,
            limit: 3,
            currency: "LKR",
          });
          matched = r.results.find((x) => x.image_url) ?? matched;
        } catch {
          /* try next term */
        }
        if (matched?.image_url) break;
      }
      // Request a larger, higher-quality render from Snoonu's CDN resizer so
      // the right-side banner image stays crisp.
      const image = matched?.image_url
        ?.replace(/width=\d+/, "width=900")
        .replace(/quality=\d+/, "quality=95");
      // Badge/offer come from the AI; when missing (no-LLM fallback) derive a
      // TRUTHFUL promo from the real product's discount/stock — never invented.
      const promo = realPromo(matched);
      return {
        title: t.title,
        tagline: t.tagline,
        badge: t.badge ?? promo.badge,
        offer: t.offer ?? promo.offer,
        countdownHours: t.countdownHours,
        query: t.query,
        image,
        bg: BGS[i % BGS.length],
      };
    }),
  );
}

/** Machine-translate the display text of each slide (title/tagline/badge/offer)
 *  into si/ta. The image, query, countdown and colour are untouched, so the
 *  slides stay identical across languages — only the words change. */
async function translateSlides(
  slides: BannerSlide[],
  lang: Lang,
): Promise<BannerSlide[]> {
  const texts: string[] = [];
  for (const slide of slides)
    texts.push(slide.title, slide.tagline, slide.badge ?? "", slide.offer ?? "");

  let translated: string[];
  try {
    translated = await machineTranslate(texts, lang);
  } catch {
    return slides; // keep English on failure
  }

  let cursor = 0;
  return slides.map((slide) => {
    const title = translated[cursor++] || slide.title;
    const tagline = translated[cursor++] || slide.tagline;
    const badge = translated[cursor++] || slide.badge;
    const offer = translated[cursor++] || slide.offer;
    return {
      ...slide,
      title,
      tagline,
      badge: slide.badge ? badge : slide.badge,
      offer: slide.offer ? offer : slide.offer,
    };
  });
}

export async function getBanners(lang: Lang): Promise<BannerSlide[]> {
  const hit = cache.get(lang);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  // One English source for all languages (cached), so they never diverge.
  if (!englishCache || Date.now() - englishCache.at >= TTL) {
    const built = await buildEnglishSlides();
    if (built.length) englishCache = { at: Date.now(), value: built };
  }
  const base = englishCache?.value ?? [];

  // English uses the source as-is; si/ta/ar are machine-translated.
  const slides =
    (lang === "si" || lang === "ta" || lang === "ar") &&
    machineTranslationConfigured()
      ? await translateSlides(base, lang)
      : base;

  if (slides.length) cache.set(lang, { at: Date.now(), value: slides });
  return slides;
}
