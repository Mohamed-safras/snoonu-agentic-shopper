/**
 * Orchestrator — coordinates a single conversational turn. It routes free text
 * via the LLM (intent.ts), delegates to the discovery specialist for product
 * search, and emits UI directives that trigger the structured flow cards
 * (delivery / gift / checkout / tracking) which fetch their own data via the
 * dedicated API endpoints. Emits NDJSON AgentEvents through `emit`.
 */
import "server-only";
import { runRouter } from "./routing/intent";
import { toChips } from "./routing/decision";
import { extractBudgetHint } from "./routing/budget";
import { emitMessage, emitChips } from "./core/emit";
import { detectModerationFlag } from "./core/moderate";
import {
  runDiscovery,
  runDiscoveryTurn,
  runChatFallbackTurn,
  runVisionDiscovery,
  deriveVisionQuery,
} from "./specialists/discovery";
import { runAutobuyTurn } from "./specialists/autobuy";
import { friendlyMcpError, isRateLimit } from "@/lib/mcp/errors";
import type { AgentContext, EmitFn } from "./core/context";

const FALLBACK =
  "Hey, I'm getting a lot of love right now and need a quick breather 🙏 — please try again in a moment. Meanwhile you can browse flowers, cakes, chocolates, hampers, groceries, electronics, and much more.";

// Only this many feedback segments stack onto the original ask — past this,
// the oldest feedback drops off. Without a cap, several rounds of refinement
// ("flower" → "for 5000" → "cheaper" → "more colourful" …) snowball into a
// long run-on string ("X — but Y — but Z — but W…") that degrades both the
// literal search keywords and the reasoning step's read of what's wanted.
const MAX_AUTOBUY_FEEDBACK_SEGMENTS = 3;

/** Fold one more round of feedback onto the remembered autobuy request,
 *  keeping the original ask plus only the most recent few feedback segments
 *  (see MAX_AUTOBUY_FEEDBACK_SEGMENTS). Repeating the exact same feedback
 *  (e.g. the shopper resends "for 5000" after a "couldn't find a match" reply)
 *  is a no-op rather than appending a duplicate. */
function foldAutobuyFeedback(previous: string, feedback: string): string {
  const trimmedFeedback = feedback.trim();
  const [base, ...deltas] = previous.split(" — but ");
  const last = deltas[deltas.length - 1];
  if (last && last.toLowerCase() === trimmedFeedback.toLowerCase())
    return previous;
  const kept = [...deltas, trimmedFeedback].slice(
    -MAX_AUTOBUY_FEEDBACK_SEGMENTS,
  );
  return [base, ...kept].join(" — but ");
}

export async function orchestrate(
  context: AgentContext,
  emit: EmitFn,
): Promise<void> {
  try {
    // Deterministic check, independent of the LLM, so a flagged request is
    // always caught regardless of how the model chooses to reply. Never
    // blocks the turn — profanity gets a standalone tone reminder up front;
    // explicit content has no separate banner because the blurred shelf/
    // spotlight gate (below) already carries the same confirm prompt right
    // where the content would appear, instead of a redundant bubble while
    // the search is still loading.
    const flag = detectModerationFlag(context.userText);
    if (flag === "profanity") emit({ type: "warning", reason: flag });
    // Explicit content awaiting confirmation: never block the search itself,
    // but the shelf/spotlight renders blurred until the shopper taps confirm.
    const explicitGate = flag === "explicit" && !context.ageConfirmed;

    const hasImages = Boolean(context.images && context.images.length);
    const decision = await runRouter(context);
    if (decision.occasion) emit({ type: "occasion", value: decision.occasion });
    // Remember a stated budget durably (in `conv`, not just this turn's raw
    // text) so it survives once the turn that mentioned it scrolls out of the
    // windowed history sent to the router on later turns.
    if (decision.search?.max_price && decision.search.max_price > 0)
      emit({ type: "patch", conv: { budget: decision.search.max_price } });

    // Visual search path (one or more uploaded photos) — EXCEPT when the
    // shopper explicitly asked the agent to pick-and-place-the-order itself
    // ("buy this for me, under 3000" + a photo): that goes through autobuy
    // below instead, using the photo to seed its search the same way text
    // would, rather than always stopping at a browse-it-yourself shelf.
    if (hasImages && decision.intent !== "autobuy") {
      const { note, products } = await runVisionDiscovery(
        emit,
        context.images!,
        context.userText,
        context.lang,
      );
      // Reply bubble first, then the matches grid (same order as text search).
      await emitMessage(emit, note, context.lang);
      if (products.length)
        emit({
          type: "ui",
          directive: { kind: "photo_match", products, gated: explicitGate },
        });
      await emitChips(
        emit,
        [
          { label: "🔍 Refine", action: "concierge" },
          { label: "🚚 Send a gift", action: "to_delivery", primary: true },
        ],
        context.lang,
      );
      emit({ type: "done" });
      return;
    }
    // For discovery we hold the warm intro until we KNOW there are results, so we
    // never promise products then show none. Other intents reply up front.
    // "autobuy" always holds it too — runAutobuyTurn owns exactly when (and
    // whether) to emit it, same self-contained timing as discovery. Flagged
    // "chat" replies are also held — the safety-net search below decides
    // whether a decline or a found-shelf message is the truthful one to show.
    const holdsMessage =
      decision.intent === "discovery" ||
      decision.intent === "autobuy" ||
      (flag && decision.intent === "chat");
    if (!holdsMessage) await emitMessage(emit, decision.message, context.lang);

    // Each non-trivial intent delegates to its own specialist-owned turn
    // handler — this switch just dispatches, it doesn't implement anything.
    switch (decision.intent) {
      case "discovery":
        await runDiscoveryTurn(emit, {
          userText: context.userText,
          lang: context.lang,
          message: decision.message,
          search: decision.search,
          spotlight: decision.spotlight,
          flag,
          explicitGate,
        });
        break;
      case "autobuy": {
        let autobuyText = context.userText;
        // Continuing an active flow: feedback on a shown pick ("don't like
        // it, something more colorful", "under 5000 instead") almost never
        // restates the original product/recipient/occasion — fold the
        // remembered request back in so the loop searches with full context
        // instead of just the feedback fragment. This used to be skipped
        // whenever the new message ALSO happened to contain a budget number
        // (treating that as "must be a fresh, unrelated request") — but a
        // continuation message restating/adjusting the budget is extremely
        // common ("for 5000", "red flower under 5000") and that heuristic
        // was dropping the carried-over picks/context for exactly those
        // messages. The router's own AUTOBUY CONTINUATION rule is what
        // actually decides fresh-vs-continuation now (it already runs
        // before this point) — by the time we're in this case at all with
        // an active `autobuyRequest`, trust that and always fold/carry.
        if (context.conv.autobuyRequest) {
          autobuyText = foldAutobuyFeedback(
            context.conv.autobuyRequest,
            context.userText,
          );
        }
        // A photo attached to a "buy this for me" request — derive what the
        // catalog would call it and weave that into the request text, so the
        // loop's search/reasoning sees the same product hint a typed
        // description would have given it.
        if (hasImages) {
          const vision = await deriveVisionQuery(
            context.images!,
            context.userText,
            context.lang,
          );
          autobuyText = `${autobuyText} (photo shows: ${vision.query})`.trim();
        }
        // Remember this as the active request so a LATER free-text rejection
        // (no verb, no budget) still continues this same flow instead of
        // falling through to plain discovery/chat — cleared once an order is
        // actually placed (store/slices/ui's pushOrderPlaced).
        emit({ type: "patch", conv: { autobuyRequest: autobuyText } });
        await runAutobuyTurn(emit, {
          userText: autobuyText,
          // The router's own distilled keywords (e.g. "red flower bouquet")
          // make a far better catalog search seed than the full folded
          // request text above, which carries conversational filler ("but",
          // "for 5000") that was only ever meant for the reasoning step's
          // context, not literal keyword search.
          searchQuery: decision.search?.query,
          lang: context.lang,
          message: decision.message,
          // Fall back, in order: the remembered budget (`conv.budget`, e.g.
          // tapping a category chip after the wide-open clarifying question,
          // which carries the category but not the budget already
          // established earlier), then a deterministic regex re-read of this
          // turn's own text — the model's own extraction is sampled (some
          // temperature > 0), so it occasionally drops a number it clearly
          // saw; this catches that without ever overriding what it DID find.
          maxPrice:
            decision.search?.max_price ||
            context.conv.budget ||
            extractBudgetHint(context.userText) ||
            undefined,
          // Carry forward whatever the shopper already settled on in an
          // earlier turn of THIS flow (including any swaps/adds they made by
          // hand on the confirm card) so giving more feedback appends new
          // picks instead of discarding them.
          carriedPicks: context.conv.autobuyKept || undefined,
          flag,
          explicitGate,
        });
        break;
      }
      case "delivery":
      case "gift":
      case "checkout":
        // One self-contained form gathers city + date + recipient + address +
        // gift, so delivery / gift / checkout intents all open the same card —
        // the user never enters delivery details twice.
        emit({ type: "ui", directive: { kind: "checkout_form" } });
        break;
      case "track":
        emit({
          type: "ui",
          directive: {
            kind: "tracking",
            order: context.conv.lastOrder ?? undefined,
          },
        });
        break;
      case "concierge":
        emit({ type: "ui", directive: { kind: "surprise" } });
        break;
      case "chat":
      default:
        await runChatFallbackTurn(emit, {
          userText: context.userText,
          lang: context.lang,
          message: decision.message,
          flag,
          explicitGate,
        });
        break;
    }

    await emitChips(emit, toChips(decision), context.lang);
    emit({ type: "done" });
  } catch (err) {
    emit({
      type: "error",
      message: err instanceof Error ? err.message : "unknown error",
    });
    // A rate-limit needs an honest "try again shortly" — don't bother retrying
    // the search (it would just hit the same limit).
    if (isRateLimit(err)) {
      await emitMessage(emit, friendlyMcpError(err), context.lang);
      emit({ type: "done" });
      return;
    }
    // Graceful degradation: if the LLM is unavailable, still run a real keyword
    // search from the raw message so the user sees products, not just an error.
    let shown = false;
    const query = context.userText.trim();
    if (query.length >= 3 && !context.images?.length) {
      try {
        const products = await runDiscovery(emit, { query });
        shown = products.length > 0;
      } catch (retryErr) {
        // If the retry also rate-limits, prefer the friendly retry message.
        if (isRateLimit(retryErr)) {
          await emitMessage(emit, friendlyMcpError(retryErr), context.lang);
          emit({ type: "done" });
          return;
        }
      }
    }
    await emitMessage(
      emit,
      shown ? "Dear, here are some options I found for you 🌸" : FALLBACK,
      context.lang,
    );
    emit({ type: "done" });
  }
}
