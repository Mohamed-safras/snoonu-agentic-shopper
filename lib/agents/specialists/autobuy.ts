/**
 * Autonomous purchase agent — a small, bounded ReAct loop: search the real
 * catalog (Act), have the LLM evaluate the candidates and decide whether to
 * pick / refine and search again / stop (Reason), repeat. Always terminates
 * within a few iterations and never invents a pick — every id returned must
 * come from that iteration's real search results.
 */
import "server-only";
import { getProvider } from "@/lib/llm";
import { activeProviderConfigured } from "@/lib/llm";
import { searchAndRank, runDiscoveryIfRelevant } from "./discovery";
import { tokenize } from "@/lib/catalog/products";
import { emitMessage, emitChips, emitStep } from "../core/emit";
import type { ModerationFlag } from "../core/moderate";
import type { EmitFn } from "../core/context";
import type { Lang, Product } from "@/types";

const MAX_CANDIDATES_PER_STEP = 16;
// How many runner-ups (beyond the picked candidate at index 0) to surface as
// "You may also like" in the confirm card.
const MAX_ALTERNATES = 12;
// Hard ceiling regardless of what the reasoning step returns — "fits the
// budget" is not by itself a reason to grab a pile of items; this bounds the
// damage from an over-eager decision even if the prompt guidance is ignored.
const MAX_PICKS_PER_DECISION = 3;

/** True when the request carries NO product/category/preference signal at all
 *  (e.g. "pick and order something for me under 3000") — just a verb + a
 *  budget, handing the agent total discretion. Reusing the catalog's own
 *  `tokenize` (drops stopwords like "gift"/"something"/"pick") means a real
 *  hint ("flowers", "a watch") always counts as NOT wide-open, so this only
 *  fires for genuinely contentless requests, never blocking a real one. */
function isWideOpen(requestText: string): boolean {
  const tokens = tokenize(requestText).filter((token) => !/^\d+$/.test(token));
  return tokens.length === 0;
}

// Plurality cues — only an EXPLICIT signal like these means the shopper
// actually wants several distinct items. Anything else (including just
// having budget left over) defaults to ONE solid pick, since prompt guidance
// alone wasn't reliable enough at stopping the loop from padding out a
// singular request just because there was room left in the budget.
const MULTI_ITEM_RE =
  /\b(a few|some|several|multiple|a couple|couple of|few things|few small|each|everyone|every(one|body)|all my|all of|both|not only|also|and (also|a|some)|two|three|four|five|\d+\s*(things|items|gifts|presents))\b/i;

function wantsMultipleItems(requestText: string): boolean {
  if (MULTI_ITEM_RE.test(requestText)) return true;
  // A bare "and" isn't itself a signal — the boilerplate verb phrase ("pick
  // AND order...") always contributes one, so testing for ANY "and" would
  // make every request look multi-item. But a SECOND "and" (e.g. "pick and
  // order a ring and flowers for me") almost always joins two distinct
  // product asks, since the verb phrase only ever contributes the first one.
  const andCount = (requestText.match(/\band\b/gi) || []).length;
  return andCount >= 2;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface AutobuyOptions {
  requestText: string;
  /** Clean catalog keywords to seed the FIRST search with (e.g. the router's
   *  own distilled "search.q"). `requestText` is often a longer, folded
   *  string built for the reasoning step's context ("Under Rs 3000 — but
   *  flower") — that reads fine to an LLM but makes a poor literal keyword
   *  search, so the loop searches with this instead when given, falling back
   *  to `requestText` only when no cleaner seed is available. */
  seedQuery?: string;
  budget: number;
  lang: Lang;
  /** Items the shopper already settled on in an EARLIER turn of this same
   *  autobuy flow (the confirm card's "kept" set, including any swaps/adds
   *  they made by hand) — carried in so giving more feedback APPENDS new
   *  picks on top of these instead of discarding them and starting over.
   *  Counted against the budget and excluded from new candidates up front,
   *  same as if they'd just been picked this run. */
  carriedPicks?: Product[];
}

export interface AutobuyResult {
  picks: Product[];
  totalPrice: number;
  /** A few real, in-budget runner-ups from the final search that weren't
   *  picked — shown as "You may also like" so the shopper can swap one in
   *  without re-running the whole loop. */
  alternates: Product[];
  /** Set when the reasoning step needs human input to proceed confidently —
   *  the loop stops immediately and the turn asks this instead of picking. */
  question?: string;
}

interface ReasonDecision {
  action: "pick" | "search_again" | "done" | "ask";
  pickIds: string[];
  nextQuery?: string;
  /** Only present when action="ask" — ONE short clarifying question. */
  question?: string;
}

/** One fast-tier JSON-mode LLM call: given the request, picks so far, and this
 *  iteration's candidates, decide what to do next. Never invents ids — the
 *  caller only honors ids that actually appear in this iteration's candidates. */
async function reason(
  requestText: string,
  budget: number,
  remainingBudget: number,
  picks: Product[],
  candidates: Product[],
): Promise<ReasonDecision> {
  // No LLM, or nothing to reason about — fall back to the top candidate (same
  // graceful-degradation style as discovery's semanticRerank).
  const fallback: ReasonDecision = candidates.length
    ? { action: "pick", pickIds: [candidates[0].id] }
    : { action: "done", pickIds: [] };
  if (!activeProviderConfigured() || !candidates.length) return fallback;

  const pickedList = picks.length
    ? picks
        .map(
          (product) =>
            `- ${product.name} (${product.price} ${product.currency})`,
        )
        .join("\n")
    : "(none yet)";
  const candidateList = candidates
    .map(
      (product, index) =>
        `${index}: id=${product.id} ${product.name} — ${product.price} ${product.currency}`,
    )
    .join("\n");

  try {
    const response = await getProvider().generate({
      fast: true,
      system:
        "You are a careful shopping agent deciding what to buy for someone, from REAL catalog search results only. " +
        "Given the shopper's request, the total budget, what's already picked, and the latest search candidates, decide ONE action: " +
        '"pick" (the BEST single candidate genuinely fits the request and budget — list just its id; only list more than one id if the request explicitly asks for SEVERAL distinct things, e.g. "a few small gifts" or "one thing for each of my kids" — fitting the budget is never by itself a reason to pick more than one). ' +
        'IMPORTANT for COMPOUND requests naming several distinct product types (e.g. "a ring AND flowers", "not only a ring, also flowers"): when these candidates match ONE of the named types, PICK the best one for that type NOW (don\'t wait for a single search to magically return both types at once — it won\'t), AND set "nextQuery" to a fresh search for the type(s) still missing (e.g. picked the ring → nextQuery="flowers") so the next round searches for what\'s still needed. Only move to "done" once every named type has a pick. ' +
        '"search_again" (none of these fit well enough for what you\'re currently searching for — give a different/refined search query), ' +
        '"done" (the request is satisfied — for a request asking for ONE thing, this is true the moment you have ONE solid pick; don\'t keep the loop going just because budget remains), or ' +
        '"ask" (the candidates span genuinely different directions and you cannot judge which fits without the shopper\'s input — e.g. practical vs. sentimental, or which of two very different categories). ' +
        'Prefer your own best judgment over asking — only use "ask" when truly stuck, and ask exactly ONE short, concrete question. ' +
        "NEVER invent a product id — only use ids shown in the candidate list. Stay strictly within the remaining budget for any pick. " +
        'Return ONLY JSON: {"action":"pick|search_again|done|ask","pickIds":["..."],"nextQuery":"...","question":"..."}',
      messages: [
        {
          role: "user",
          content: `Request: "${requestText}"\nTotal budget: ${budget}\nRemaining budget: ${remainingBudget}\nAlready picked:\n${pickedList}\n\nCandidates:\n${candidateList}`,
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
    const action = parsed?.action;
    if (
      action === "pick" ||
      action === "search_again" ||
      action === "done" ||
      action === "ask"
    ) {
      const question =
        typeof parsed.question === "string" ? parsed.question.trim() : "";
      // "ask" without an actual question is useless — fall back rather than
      // stop the loop on an empty prompt.
      if (action === "ask" && !question) return fallback;
      return {
        action,
        pickIds: Array.isArray(parsed.pickIds)
          ? parsed.pickIds.map(String)
          : [],
        nextQuery:
          typeof parsed.nextQuery === "string" ? parsed.nextQuery : undefined,
        question: question || undefined,
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * ReAct loop: search → reason → (pick and/or refine and search again, or
 * stop). No hardcoded iteration cap — it keeps going as long as it's making
 * real progress, and stops itself the moment any genuine convergence signal
 * fires: a solid pick for a singular request, the model saying "done", the
 * budget running out, nothing left to search for, or a proposed search that
 * was already tried (no new ground left to cover). Returns whatever was
 * picked (possibly empty) — never throws, never invents a product, and never
 * exceeds the budget (enforced both by the search's max_price filter and a
 * hard per-pick check here).
 */
export async function runAutobuyLoop(
  emit: EmitFn,
  opts: AutobuyOptions,
): Promise<AutobuyResult> {
  // Seeding `picks`/`pickedIds`/`remainingBudget` with the carry-over makes
  // every later check (the "already picked" list shown to the reasoning
  // step, the singular-request stop, the budget remaining) treat them
  // exactly like a pick made THIS run — no special-casing needed below.
  const picks: Product[] = [...(opts.carriedPicks || [])];
  const pickedIds = new Set<string>(picks.map((product) => product.id));
  // Divergence guard: only matters for "search_again" — repeating the SAME
  // refined query means the reasoning step isn't proposing real progress, so
  // we stop rather than spin through the remaining iterations on a repeat.
  // (A "pick" continuing with an unchanged query is normal/intentional — it's
  // how multi-item picks surface more candidates after the first is removed.)
  const triedQueries = new Set<string>([opts.requestText.trim().toLowerCase()]);
  let remainingBudget =
    opts.budget - picks.reduce((sum, product) => sum + product.price, 0);
  let query = (opts.seedQuery || opts.requestText).trim();
  // The best real candidate seen across every search this loop ran — a
  // last-resort fallback so the shopper gets a genuine, in-budget option
  // instead of a "couldn't find anything" dead end if the reasoning step
  // never confidently committed to a pick.
  let bestSeen: Product | null = null;
  // Runner-ups from EVERY search this loop ran (not just the last one), one
  // array per iteration — surfaced as "You may also like" alongside the
  // final pick(s). Kept per-iteration (rather than one flat deduped set) so
  // the final list can prioritize the LATEST, most-refined search's
  // candidates over an earlier, broader query's — see the alternates
  // assembly after the loop.
  const alternatesByRound: Product[][] = [];
  // Generous circuit breaker — NOT a tuning knob for normal runs (those
  // always stop themselves via budget/candidates/convergence well before
  // this), just a backstop against a pathological case where the reasoning
  // step keeps proposing genuinely distinct, never-repeated queries without
  // ever picking anything.
  const SAFETY_ITERATION_CAP = 25;
  let iteration = 0;

  // No iteration cap in normal operation — every branch below either makes
  // real progress or `break`s/`return`s, so this always terminates on its
  // own: budget runs out (picks subtract from it), candidates run out, a
  // singular request gets its one solid pick, the model says "done", or a
  // proposed query repeats one already in `triedQueries`.
  for (;;) {
    if (remainingBudget <= 0) break;
    if (++iteration > SAFETY_ITERATION_CAP) {
      await emitStep(emit, "🤔 Wrapping up with what I've got.", opts.lang);
      break;
    }

    // Narrate each step live as its own interactive step list — never mixed
    // into the reply bubble's text — so the shopper sees the agent actually
    // searching/reasoning, not just a silent wait.
    await emitStep(emit, `🔍 Searching for "${query}"…`, opts.lang);

    let products: Product[];
    try {
      // One retry on a transient failure (most commonly the MCP free tier's
      // shared 60 req/min cap, which an autobuy session can plausibly hit
      // mid-loop) — without this, an error here used to throw all the way
      // out to the orchestrator's generic fallback, discarding any picks
      // already made in earlier iterations.
      ({ products } = await searchAndRank(emit, {
        query,
        intent: opts.requestText,
        max_price: remainingBudget,
      }));
    } catch {
      await sleep(1500);
      try {
        ({ products } = await searchAndRank(emit, {
          query,
          intent: opts.requestText,
          max_price: remainingBudget,
        }));
      } catch {
        // Still failing — stop here and hand back whatever's already been
        // found instead of losing it to an uncaught throw.
        await emitStep(
          emit,
          "🤔 Having trouble searching right now — wrapping up with what I've got.",
          opts.lang,
        );
        break;
      }
    }
    // Never re-offer something already picked.
    const candidates = products
      .filter((product) => !pickedIds.has(product.id))
      .slice(0, MAX_CANDIDATES_PER_STEP);
    if (!candidates.length) {
      await emitStep(emit, "🤔 Nothing else fits — wrapping up.", opts.lang);
      break;
    }
    // Most-refined search so far → most relevant top candidate; keep it as
    // the fallback in case nothing ever gets a confident "pick".
    bestSeen = candidates[0];
    alternatesByRound.push(candidates.slice(1));

    await emitStep(
      emit,
      `🤔 Found ${candidates.length} option(s), checking the best fit…`,
      opts.lang,
    );

    const decision = await reason(
      opts.requestText,
      opts.budget,
      remainingBudget,
      picks,
      candidates,
    );

    if (decision.action === "pick") {
      const byId = new Map(candidates.map((product) => [product.id, product]));
      const before = picks.length;
      for (const id of decision.pickIds.slice(0, MAX_PICKS_PER_DECISION)) {
        const product = byId.get(id);
        if (product && !pickedIds.has(id) && product.price <= remainingBudget) {
          picks.push(product);
          pickedIds.add(id);
          remainingBudget -= product.price;
        }
      }
      const justPicked = picks.slice(before);
      // Said "pick" but nothing actually qualified (bad id / over budget) —
      // stop rather than risk looping without ever making progress. Checked
      // against THIS iteration's additions, not `picks.length` overall —
      // carry-over from an earlier turn already makes that non-zero even
      // when nothing new qualifies here.
      if (!justPicked.length) break;
      await emitStep(
        emit,
        `✅ Picked: ${justPicked.map((product) => product.name).join(", ")}.`,
        opts.lang,
      );
      // No LLM available means `reason()` is just picking the top candidate
      // each time with no real judgment of "is this enough" — stop after one
      // safe pick instead of blindly accumulating up to MAX_ITERATIONS
      // unrelated items.
      if (!activeProviderConfigured()) break;
      // Deterministic stop for a singular request: prompt guidance alone
      // wasn't reliable at resisting "there's still budget left, pick more"
      // — a request with no explicit plurality cue ("a few", "two", "each"…)
      // is done the moment ONE solid pick exists, regardless of what's left.
      if (picks.length >= 1 && !wantsMultipleItems(opts.requestText)) {
        await emitStep(emit, "👍 That's the one — finalizing.", opts.lang);
        break;
      }
    }

    if (decision.action === "done") {
      await emitStep(emit, "👍 That's a solid set — finalizing.", opts.lang);
      break;
    }
    if (decision.action === "ask" && decision.question) {
      // Genuine human-in-the-loop: the candidates span directions the agent
      // can't judge alone — stop and hand back the question instead of
      // guessing. The next user turn re-enters autobuy with that answer.
      return {
        picks,
        totalPrice: picks.reduce((sum, product) => sum + product.price, 0),
        alternates: [],
        question: decision.question,
      };
    }
    if (decision.action === "search_again") {
      const nextQuery = decision.nextQuery?.trim();
      if (nextQuery && triedQueries.has(nextQuery.toLowerCase())) {
        // Proposing a query we've already searched isn't real progress —
        // stop here instead of burning the remaining iterations on a repeat.
        await emitStep(
          emit,
          "🤔 Nothing new to try — wrapping up with what I've got.",
          opts.lang,
        );
        break;
      }
      if (nextQuery)
        await emitStep(
          emit,
          `🔁 Not quite right — let me try "${nextQuery}" instead…`,
          opts.lang,
        );
    }
    query = decision.nextQuery?.trim() || query;
    triedQueries.add(query.toLowerCase());
  }

  // Genuinely real options existed at some point but the reasoning step never
  // confidently committed — better to hand back the closest real match than
  // a dead end. Still 100% real and in-budget (every candidate ever held in
  // `bestSeen` passed the search's max_price filter).
  if (!picks.length && bestSeen) {
    await emitStep(emit, `✅ Going with: ${bestSeen.name}.`, opts.lang);
    picks.push(bestSeen);
  }

  const totalPrice = picks.reduce((sum, product) => sum + product.price, 0);
  // Build the final alternates list newest-round-first — the last search the
  // loop ran is the most refined one (closest to whatever it actually ended
  // up picking), so its runner-ups are more relevant than an earlier,
  // broader query's. Earlier rounds only fill in if the latest one didn't
  // have enough on its own.
  const alternates: Product[] = [];
  const seenAlternateIds = new Set<string>(pickedIds);
  outer: for (const round of [...alternatesByRound].reverse()) {
    for (const product of round) {
      if (seenAlternateIds.has(product.id)) continue;
      seenAlternateIds.add(product.id);
      alternates.push(product);
      if (alternates.length >= MAX_ALTERNATES) break outer;
    }
  }
  return { picks, totalPrice, alternates };
}

/** Runs a full intent="autobuy" turn: flagged content falls back to a real
 *  (gated) search instead of auto-picking; otherwise a budget is required
 *  (never guessed) before running the ReAct loop, then either the confirm
 *  card or an honest no-match message is emitted. Owns the whole turn so the
 *  orchestrator's switch stays a thin dispatcher. */
export async function runAutobuyTurn(
  emit: EmitFn,
  opts: {
    userText: string;
    /** Clean catalog keywords (router's "search.q") to seed the loop's first
     *  search with, instead of the (often longer, folded) `userText`. */
    searchQuery?: string;
    lang: Lang;
    message: string;
    maxPrice?: number;
    flag: ModerationFlag;
    explicitGate: boolean;
    carriedPicks?: Product[];
  },
): Promise<void> {
  if (opts.flag) {
    // Never auto-pick/confirm a purchase for flagged content — same honest
    // fallback as the chat branch (lib/agents/specialists/discovery.ts).
    const shown = await runDiscoveryIfRelevant(emit, opts.userText, {
      gated: opts.explicitGate,
      title: "Top picks for you",
    });
    if (!shown) await emitMessage(emit, opts.message, opts.lang);
    return;
  }

  if (!opts.maxPrice || opts.maxPrice <= 0) {
    // Hard server-side gate: never guess a budget, even if the model somehow
    // emitted intent="autobuy" without one.
    await emitMessage(
      emit,
      "Aiyo, I'd love to pick something for you — what's the budget so I don't overshoot? 💸",
      opts.lang,
    );
    await emitChips(
      emit,
      [
        { label: "💸 Under Rs 1000", action: "chat" },
        { label: "💸 Under Rs 3000", action: "chat" },
        { label: "💸 Under Rs 5000", action: "chat" },
      ],
      opts.lang,
    );
    return;
  }

  if (isWideOpen(opts.userText)) {
    // Total discretion ("pick and order something for me") with zero hint of
    // WHAT — rather than let the loop grab whatever generic "gift" search
    // turns up, ask one light, fully skippable question. Any real answer
    // ("flowers") restates the request with a hint next turn; "Surprise me"
    // carries its own non-stopword signal so it never re-triggers this gate.
    await emitMessage(
      emit,
      "Aiyo, love that you're trusting me with this one! Anything they're into, or should I just surprise them? 🎲",
      opts.lang,
    );
    await emitChips(
      emit,
      [
        {
          label: "🌹 Flowers",
          action: "chat",
          payload: "pick and order flowers for me",
        },
        {
          label: "🍫 Chocolates",
          action: "chat",
          payload: "pick and order chocolates for me",
        },
        {
          label: "🎂 Cake",
          action: "chat",
          payload: "pick and order a cake for me",
        },
        {
          label: "📱 Tech",
          action: "chat",
          payload: "pick and order a tech gadget for me",
        },
        {
          label: "🎲 Surprise me",
          action: "chat",
          payload: "pick and order a surprise for me",
        },
      ],
      opts.lang,
    );
    return;
  }

  // Show the warm intro FIRST, then narrate the loop live underneath it, so
  // the shopper sees "Let me find the perfect thing for you 🎁" immediately
  // followed by real-time search/reasoning steps rather than a silent wait.
  await emitMessage(emit, opts.message, opts.lang);

  const { picks, alternates, question } = await runAutobuyLoop(emit, {
    requestText: opts.userText,
    seedQuery: opts.searchQuery,
    budget: opts.maxPrice,
    lang: opts.lang,
    carriedPicks: opts.carriedPicks,
  });

  if (question) {
    // Human-in-the-loop: the agent genuinely needs the shopper's input to
    // proceed confidently — ask and stop, rather than guess. Replying
    // continues the same autobuy request with the budget already known.
    await emitMessage(emit, question, opts.lang);
    return;
  }

  if (picks.length) {
    // Keep the carry-over in sync with what's ACTUALLY shown now — the next
    // round of feedback (if any) should append onto this exact set, not the
    // pre-loop carry-over it started from.
    emit({ type: "patch", conv: { autobuyKept: picks } });
    emit({
      type: "ui",
      directive: {
        kind: "autobuy_confirm",
        products: picks,
        alternates,
        budget: opts.maxPrice,
        currency: picks[0].currency,
      },
    });
  } else {
    await emitMessage(
      emit,
      "Aiyo, I couldn't find a confident match within that budget 🙈 — tell me a little more and I'll have another go.",
      opts.lang,
    );
  }
}
