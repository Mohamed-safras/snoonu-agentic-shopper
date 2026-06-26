/**
 * Intent routing — the orchestrator's "brain" step: one LLM turn that classifies
 * the conversation and returns a structured, validated decision (persona reply +
 * intent + search + chips + occasion). Also exposes a cheap heuristic used by the
 * chat-fallback path. Parsing/validation lives with the schema in decision.ts.
 */
import "server-only";
import { getProvider } from "@/lib/llm";
import { langTokens } from "@/lib/llm/tokens";
import { buildOrchestratorSystem } from "../core/prompts";
import { parseDecision, type RouterDecision } from "./decision";
import type { AgentContext } from "../core/context";

// Older turns cost tokens on EVERY future request without adding much signal
// once the conversation runs long — durable facts (budget, city, occasion)
// live in the `Conversation` object instead, so the router doesn't need the
// full transcript to stay coherent. Last ~4 exchanges is plenty of working
// context for resolving "it / that one / same as before".
const MAX_HISTORY_TURNS = 8;

/** Run the routing LLM and parse its response into a validated decision. */
export async function runRouter(
  agentContext: AgentContext,
): Promise<RouterDecision> {
  const provider = getProvider();
  const response = await provider.generate({
    system: buildOrchestratorSystem(agentContext),
    messages: agentContext.messages.slice(-MAX_HISTORY_TURNS).map(
      ({ role, content }) => ({
        role,
        content,
      }),
    ),
    json: true,
    // This is a classification + extraction task (intent, budget, search
    // query), not creative writing — sampling at temperature > 0 was the
    // actual cause of the same request routing differently turn to turn
    // (autobuy vs. plain discovery vs. asking for a budget it already had).
    // 0 makes that deterministic; the "message" text still varies naturally
    // call to call since the input (history, userText) varies.
    temperature: 0,
    // Sinhala/Tamil need a bigger budget so the reply JSON isn't cut mid-sentence.
    maxTokens: langTokens(700, agentContext.lang),
  });
  return parseDecision(response.text);
}

/**
 * Heuristic: a short, non-question phrase that could be a product search.
 * Permissive on purpose — questions and longer phrasings ("do you have red
 * roses?", "a birthday cake for amma") are valid product requests. We only rule
 * out obvious greetings / thanks / meta-questions; the catalog strong-match gate
 * (runDiscoveryIfRelevant) stops genuine chit-chat from triggering a shelf, so a
 * false positive here is harmless.
 */
export function looksLikeProductQuery(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 3) return false;
  return !/^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening|night)|thanks|thank you|thank|ok|okay|cool|nice|great|bye|see you|how are you|who are you|what('?| i)s your name|what can you do|help|test)\b/.test(
    trimmed,
  );
}
