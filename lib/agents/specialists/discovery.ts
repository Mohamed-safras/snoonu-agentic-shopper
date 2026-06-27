/**
 * Discovery specialist — turns a search intent (or an uploaded photo) into real
 * Snoonu products via MCP, then emits shelf / spotlight / photo_match UI
 * directives. Emits tool-activity events so the UI can show live MCP usage.
 */
import "server-only";
import { getProvider } from "@/lib/llm";
import { activeProviderConfigured } from "@/lib/llm";
import { getProduct, searchProducts } from "@/lib/mcp/tools";
import { toProductFromDetail, toProductFromSearch } from "@/lib/mcp/adapters";
import { VISION_QUERY_SYSTEM } from "../core/prompts";
import {
  dedupeById,
  rankByRelevance,
  strongMatchCount,
} from "@/lib/catalog/products";
import { langTokens } from "@/lib/llm/tokens";
import { emitMessage } from "../core/emit";
import { looksLikeProductQuery } from "../routing/intent";
import type { EmitFn } from "../core/context";
import type { Lang, Product, ShelfMore } from "@/types";

/** The loose shape of the router's "search" field — kept local (not imported
 *  from routing/decision.ts) so this specialist stays decoupled from the
 *  orchestrator's decision schema. */
export interface RouterSearch {
  query?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  quantity?: number;
  in_stock?: boolean;
}

export interface DiscoveryInput {
  query: string;
  /** The shopper's ORIGINAL words — used for intent-aware re-ranking. */
  intent?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  /** Desired item count (LLM-decided) — boosts exact/nearest-count products. */
  quantity?: number;
  /** Only keep in-stock products (the shopper asked for availability). */
  in_stock?: boolean;
  spotlight?: boolean;
  title?: string;
  sub?: string;
  /** Flagged-explicit search awaiting age confirmation — the shelf/spotlight
   *  renders blurred behind a confirm gate instead of showing images outright. */
  gated?: boolean;
}

/**
 * Intent-aware re-rank: keyword matching alone misses semantics (occasion,
 * recipient, colour, budget). Given the shopper's request + the candidate
 * names, the LLM returns the most relevant FIRST; anything it omits is kept and
 * appended after (we never silently drop products). Falls back to the input
 * order if the LLM is unavailable.
 */
async function semanticRerank(
  request: string,
  products: Product[],
): Promise<Product[]> {
  if (!activeProviderConfigured() || products.length < 3 || !request.trim())
    return products;
  const list = products
    .map(
      (product, index) =>
        `${index}: ${product.name}${product.category ? ` [${product.category}]` : ""} — ${product.price} ${product.currency}`,
    )
    .join("\n");
  try {
    const response = await getProvider().generate({
      fast: true,
      system:
        "You order shopping results by how well they match the shopper's request — understand the INTENT (occasion, recipient, item type, colour, budget, quantity), not just shared words. " +
        'Return ONLY a JSON array of the item indices, MOST relevant first, e.g. {"order":[3,0,5,1]}. Put clearly irrelevant items last. Use only indices that exist.',
      messages: [
        {
          role: "user",
          content: `Request: "${request.trim()}"\n\nItems:\n${list}`,
        },
      ],
      json: true,
      temperature: 0,
      maxTokens: 300,
    });
    const parsed = JSON.parse(
      response.text.slice(
        response.text.indexOf("{"),
        response.text.lastIndexOf("}") + 1,
      ),
    );
    const order: number[] = Array.isArray(parsed?.order) ? parsed.order : [];
    const ordered: Product[] = [];
    const used = new Set<number>();
    for (const index of order) {
      if (Number.isInteger(index) && products[index] && !used.has(index)) {
        ordered.push(products[index]);
        used.add(index);
      }
    }
    // Keep any products the model didn't list, in their original order.
    products.forEach((product, index) => {
      if (!used.has(index)) ordered.push(product);
    });
    return ordered.length ? ordered : products;
  } catch {
    return products;
  }
}

function titleFor(q: string): string {
  const clean = q.replace(/["']/g, "").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1) + " — top picks";
}

/** Broaden a query to its head noun(s) so a too-specific phrase still matches. */
function broaden(query: string): string | null {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return null;
  const lastTwo = words.slice(-2).join(" ");
  return lastTwo !== query ? lastTwo : words[words.length - 1];
}

/** Search + rank products for an intent, WITHOUT emitting any shelf/spotlight.
 *  Returns [] when the catalog truly has no match. Lets the caller decide what
 *  to say BEFORE showing results (so we never promise products then show none). */
export interface SearchResult {
  products: Product[];
  /** Cursor + params for the next page (drives the shelf's "View more" button). */
  more?: ShelfMore;
}

export async function searchAndRank(
  emit: EmitFn,
  input: DiscoveryInput,
): Promise<SearchResult> {
  emit({ type: "tool", name: "snoonu_search_products", status: "running" });
  // Remember the query/category that actually produced the shelf, plus the MCP
  // cursor for its next page, so "View more" can continue THAT same search.
  // (A holder object, since the assignment happens inside the search closure.)
  const lastSearch: {
    current: { query: string; category?: string; cursor: string } | null;
  } = { current: null };
  const runSearch = (query: string, category?: string) =>
    searchProducts({
      query,
      category,
      min_price: input.min_price,
      max_price: input.max_price,
      limit: 48, // MCP search errors above 50; 48 returns a full shelf
    }).then((raw) => {
      lastSearch.current = { query, category, cursor: raw.next_cursor ?? "" };
      return dedupeById(raw.results.map(toProductFromSearch));
    });

  // Fetch extra candidates so the relevance re-rank has room to drop off-topic
  // tail results and still leave a full shelf.
  let products = await runSearch(input.query, input.category);

  // If a precise phrase matched nothing, retry once with the head noun(s).
  if (!products.length) {
    const broader = broaden(input.query);
    if (broader) products = await runSearch(broader, input.category);
  }
  // A category filter that matched nothing (the label may not be an exact catalog
  // category key) must never empty the shelf — retry on the keyword alone.
  if (!products.length && input.category) {
    products = await runSearch(input.query);
  }
  // Still nothing → the term may be a CATEGORY name (e.g. "Ladieswear") that
  // isn't a product keyword. Retry filtering by it as a category.
  if (!products.length && !input.category) {
    products = await runSearch(input.query, input.query);
  }
  // A specific multi-word phrase can match only a handful — top the shelf up with
  // broader (head-noun) matches so a descriptive query never returns a near-empty
  // shelf. The precise hits already rank first; broader ones fill the tail.
  if (products.length < 6) {
    const broader = broaden(input.query);
    if (broader) {
      const seen = new Set(products.map((product) => product.id));
      for (const product of await runSearch(broader)) {
        if (!seen.has(product.id)) {
          products.push(product);
          seen.add(product.id);
        }
      }
    }
  }
  emit({ type: "tool", name: "snoonu_search_products", status: "done" });

  // In-stock filter (only when the shopper asked for availability), but never
  // empty the shelf entirely — keep all if nothing is explicitly in stock.
  if (input.in_stock) {
    const inStock = products.filter((product) => product.inStock !== false);
    if (inStock.length) products = inStock;
  }

  if (!products.length) return { products: [] };

  // Relevance ordering: keyword + count rank everything, then an intent-aware
  // LLM re-rank reorders the strongest head; the tail keeps its keyword order.
  const ranked = rankByRelevance(products, input.query, input.quantity);
  const reorderedHead = await semanticRerank(
    input.intent || input.query,
    ranked.slice(0, 30),
  );
  const lastUsed = lastSearch.current;
  const more: ShelfMore | undefined = lastUsed?.cursor
    ? {
        query: lastUsed.query,
        category: lastUsed.category,
        min_price: input.min_price,
        max_price: input.max_price,
        cursor: lastUsed.cursor,
      }
    : undefined;
  return { products: [...reorderedHead, ...ranked.slice(30)], more };
}

/** Emit the shelf / spotlight for an already-searched product set. `more` (when
 *  present) lets the shelf paginate the next page via a "View more" button. */
export async function emitProducts(
  emit: EmitFn,
  products: Product[],
  input: DiscoveryInput,
  more?: ShelfMore,
): Promise<void> {
  if (!products.length) return;
  // Feature the top pick as a spotlight when the router asks for it OR when the
  // result set is rich enough to warrant a hero (unless it explicitly opted out).
  const showSpotlight =
    input.spotlight === true ||
    (input.spotlight !== false && products.length >= 4);

  if (showSpotlight && products[0]) {
    emit({ type: "tool", name: "snoonu_get_product", status: "running" });
    const detail = await getProduct(products[0].id).catch(() => null);
    emit({ type: "tool", name: "snoonu_get_product", status: "done" });
    const hero = detail ? toProductFromDetail(detail) : products[0];

    emit({
      type: "ui",
      directive: { kind: "spotlight", product: hero, gated: input.gated },
    });
    const rest = products.slice(1);
    if (rest.length) {
      emit({
        type: "ui",
        directive: {
          kind: "shelf",
          title: input.title || "More like this",
          sub: input.sub,
          products: rest,
          more,
          gated: input.gated,
        },
      });
    }
  } else {
    emit({
      type: "ui",
      directive: {
        kind: "shelf",
        title: input.title || titleFor(input.query),
        sub: input.sub,
        products,
        more,
        gated: input.gated,
      },
    });
  }
}

/** Search and emit in one go (used by graceful-degradation fallbacks). */
export async function runDiscovery(
  emit: EmitFn,
  input: DiscoveryInput,
): Promise<Product[]> {
  const { products, more } = await searchAndRank(emit, input);
  await emitProducts(emit, products, input, more);
  return products;
}

/**
 * Safety net: search the raw text and show a shelf ONLY if the catalog strongly
 * matches (so genuine chit-chat never triggers a random shelf). Returns whether
 * products were shown. Used when the router fails to search a product message.
 */
export async function runDiscoveryIfRelevant(
  emit: EmitFn,
  query: string,
  opts?: {
    /** Render blurred behind an age-confirm gate (flagged-explicit text). */
    gated?: boolean;
    /** Shelf title shown instead of echoing the (possibly flagged) raw query. */
    title?: string;
  },
): Promise<boolean> {
  let raw;
  try {
    raw = await searchProducts({ query, limit: 48 });
  } catch {
    return false;
  }
  const ranked = rankByRelevance(
    dedupeById(raw.results.map(toProductFromSearch)),
    query,
  );
  if (strongMatchCount(ranked, query) < 2) return false; // not confidently a product query
  emit({ type: "tool", name: "snoonu_search_products", status: "done" });
  emit({
    type: "ui",
    directive: {
      kind: "shelf",
      title: opts?.title || titleFor(query),
      products: ranked, // show all matches; the shelf's filters narrow them
      gated: opts?.gated,
    },
  });
  return true;
}

/** Does a product belong to the identified product type? Generic substring
 *  match (type word, its stem and plural) across the product's name / category /
 *  brand — no hardcoded vocabulary. e.g. type "phone" matches "iPhone 15", and
 *  an orange / diaper / spray (which don't contain "phone") is dropped. */
function matchesType(product: Product, type: string): boolean {
  const word = type.toLowerCase().trim();
  if (!word) return true;
  const haystack =
    `${product.name} ${product.category ?? ""} ${product.brand ?? ""}`.toLowerCase();
  const stem = word.replace(/s$/, "");
  return (
    haystack.includes(word) ||
    haystack.includes(stem) ||
    haystack.includes(`${stem}s`)
  );
}

/** LLM-written, in-character note for when a photographed item has no match in
 *  Snoonu's range. Falls back to the vision note (also LLM, never hardcoded)
 *  if the model is unavailable. */
async function composeNoMatchNote(
  productType: string,
  hint: string | undefined,
  fallback: string,
  lang: Lang,
): Promise<string> {
  if (!activeProviderConfigured()) return fallback;
  try {
    const response = await getProvider().generate({
      fast: true,
      system:
        "You are Hala, a warm, witty shopping concierge. The shopper shared a photo and you recognised the item, but Snoonu has NO close match for it. Reply in ONE warm, genuine sentence (vary your wording; an emoji is fine): acknowledge what they showed, gently say you couldn't find it, and invite them to share a budget/occasion or browse a category. Never invent products or prices. Output only the sentence. " +
        "Write the sentence in English.",
      messages: [
        {
          role: "user",
          content: `Item type: ${productType || "this"}.${hint ? ` They also said: "${hint}".` : ""}`,
        },
      ],
      temperature: 0.7,
      maxTokens: langTokens(90, lang),
    });
    return response.text.trim() || fallback;
  } catch {
    return fallback;
  }
}

/** Derive a Snoonu search query (+ a friendly note) from one or more uploaded
 *  images, optionally guided by what the shopper typed alongside them. Shared
 *  by the plain photo-match path (`runVisionDiscovery` below) and autobuy's
 *  image-aware turn (`runAutobuyTurn` in autobuy.ts), so a photo means the
 *  same thing in both. */
export async function deriveVisionQuery(
  images: string[],
  hint?: string,
  lang: Lang = "en",
): Promise<{ query: string; productType: string; note: string }> {
  let query = "gift";
  let productType = "";
  let note = "Here's what caught my eye in your photo 👀";
  const cleanHint = hint
    ?.trim()
    .replace(/find something like this/i, "")
    .trim();
  const many = images.length > 1;
  const noteLang = `Write "note" in English.`;
  try {
    const res = await getProvider().generate({
      system: VISION_QUERY_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            (cleanHint
              ? `What ${many ? "products are these" : "product is this"}? The shopper also says: "${cleanHint}". Give a Snoonu search query that matches BOTH the image${many ? "s" : ""} and their request.`
              : `What ${many ? "products are these" : "product is this"}? Give a Snoonu search query.`) +
            ` ${noteLang}`,
        },
      ],
      images,
      json: true,
      maxTokens: langTokens(200, lang),
    });
    const parsed = JSON.parse(
      res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1),
    );
    if (parsed?.q) query = String(parsed.q);
    if (parsed?.type) productType = String(parsed.type);
    if (parsed?.note) note = String(parsed.note);
  } catch {
    /* fall back to generic query */
  }
  return { query, productType, note };
}

/** Derive a search query from one or more uploaded images (optionally guided by
 *  what the shopper typed alongside them), then search + emit matches. */
export async function runVisionDiscovery(
  emit: EmitFn,
  images: string[],
  hint?: string,
  lang: Lang = "en",
): Promise<{ note: string; products: Product[] }> {
  const visionResult = await deriveVisionQuery(images, hint, lang);
  const { query, productType } = visionResult;
  let note = visionResult.note;
  const cleanHint = hint?.trim().replace(/find something like this/i, "").trim();

  emit({ type: "tool", name: "snoonu_search_products", status: "running" });
  const raw = await searchProducts({ query, limit: 48 });
  emit({ type: "tool", name: "snoonu_search_products", status: "done" });
  let products = rankByRelevance(
    dedupeById(raw.results.map(toProductFromSearch)),
    query,
  );

  // Understand WHAT it is, then keywords: keep only products that are actually
  // the identified KIND of item. This drops things that merely share a colour
  // or word — e.g. a phone photo surfacing oranges, OR a "macbook" search
  // matching "book" → English/board books.
  if (productType) {
    const ofType = products.filter((product) =>
      matchesType(product, productType),
    );
    if (ofType.length) {
      products = ofType;
    } else {
      // Snoonu genuinely has no match for this kind of item. Showing the
      // keyword-noise that slipped through would be worse than being honest —
      // so return nothing and let an LLM-written note invite another route.
      products = [];
      note = await composeNoMatchNote(productType, cleanHint, note, lang);
    }
  }

  // The orchestrator emits the warm note first, then the photo_match card, so
  // the reply bubble renders above the results (same order as a text search).
  // The card itself (header + grid) is unchanged.
  return { note, products };
}

/** Runs a full intent="discovery" turn: build the search input from the
 *  router's decision, search, then emit either the warm intro + shelf/
 *  spotlight (found) or an honest no-match message (not found). Owns the
 *  whole turn so the orchestrator's switch stays a thin dispatcher. */
export async function runDiscoveryTurn(
  emit: EmitFn,
  opts: {
    userText: string;
    lang: Lang;
    message: string;
    search?: RouterSearch;
    spotlight?: boolean;
    flag: "explicit" | "profanity" | null;
    explicitGate: boolean;
  },
): Promise<void> {
  const { search } = opts;
  // Guarantee a search: the model sometimes routes to discovery but omits
  // "search" — fall back to the user's own words.
  const query = search?.query?.trim() ? search.query.trim() : opts.userText.trim();
  const input: DiscoveryInput = {
    query,
    // The shopper's own words drive the intent-aware re-rank.
    intent: opts.userText,
    // When the router recognises a catalog category (e.g. a popular-category
    // tap, or "browse flowers"), filter by it so results stay strictly
    // on-topic instead of relying on keyword overlap alone.
    category: search?.category?.trim() ? search.category.trim() : undefined,
    min_price:
      search?.min_price && search.min_price > 0 ? search.min_price : undefined,
    max_price:
      search?.max_price && search.max_price > 0 ? search.max_price : undefined,
    quantity:
      search?.quantity && search.quantity > 0 ? search.quantity : undefined,
    in_stock: search?.in_stock === true ? true : undefined,
    spotlight: opts.spotlight,
    gated: opts.explicitGate,
    // Never echo flagged raw text as the shelf title.
    title: opts.flag ? "Top picks for you" : undefined,
  };
  const { products, more } =
    query.length >= 2
      ? await searchAndRank(emit, input)
      : { products: [], more: undefined };

  if (products.length) {
    // Found → warm intro first, then the shelf/spotlight below it.
    await emitMessage(emit, opts.message, opts.lang);
    await emitProducts(emit, products, input, more);
  } else {
    // Nothing found → ONE honest message (no misleading "let's find…" first).
    await emitMessage(
      emit,
      "Aiyo, I couldn't find a match for that 🙈 — tell me a little more (a colour, budget, occasion or something else) and I'll have another go.",
      opts.lang,
    );
  }
}

/** Runs the fallback turn for intent="chat" (and any unrecognized intent):
 *  if the text is flagged, still try a real search (gated/blurred for
 *  explicit content) rather than a blind decline; otherwise, a safety net
 *  in case the router mislabeled an actual product message as chat. */
export async function runChatFallbackTurn(
  emit: EmitFn,
  opts: {
    userText: string;
    lang: Lang;
    message: string;
    flag: "explicit" | "profanity" | null;
    explicitGate: boolean;
  },
): Promise<void> {
  if (opts.flag) {
    // Flagged text still gets a real catalog search — never decline outright
    // just because the words are explicit/profane; Snoonu may genuinely
    // carry a match. The message reflects the actual outcome (found vs not)
    // instead of a pre-written decline, so a "sorry, can't help" reply never
    // sits next to a shown shelf.
    const shown = await runDiscoveryIfRelevant(emit, opts.userText, {
      gated: opts.explicitGate,
      title: "Top picks for you",
    });
    if (!shown) await emitMessage(emit, opts.message, opts.lang);
  } else if (looksLikeProductQuery(opts.userText)) {
    // Safety net: the router sometimes mislabels a product message as chat
    // (or asks instead of showing). Try a search and show results only when
    // the catalog strongly matches.
    await runDiscoveryIfRelevant(emit, opts.userText);
  }
}
