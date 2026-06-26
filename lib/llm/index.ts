/**
 * LLM provider factory. Selects the primary provider from config
 * (`DEFAULT_LLM_PROVIDER`) and, when the other provider's key is also configured, wraps
 * it in a resilient fallback so a quota/outage on one transparently uses the
 * other. Both real keys (Gemini + Groq) are therefore put to use.
 */
import "server-only";
import { config } from "@/configs/env";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { makeFallback } from "./fallback";
import type { LlmProvider } from "./types";

export function getProvider(): LlmProvider {
  const primaryName = config.defaultLLmProvider;
  const primary = primaryName === "groq" ? groqProvider : geminiProvider;
  const secondary = primaryName === "groq" ? geminiProvider : groqProvider;

  const secondaryKey =
    primaryName === "groq" ? config.gemini.apiKey : config.groq.apiKey;
  // Only add a fallback when the other provider is actually configured.
  return secondaryKey ? makeFallback(primary, secondary) : primary;
}

/** Gemini is usable with an API key, OR in Vertex mode with a GCP project. */
export function geminiConfigured(): boolean {
  return (
    Boolean(config.gemini.apiKey) ||
    (config.gemini.useVertex && Boolean(config.gemini.project))
  );
}

export function groqConfigured(): boolean {
  return Boolean(config.groq.apiKey);
}

/** True if at least one LLM provider is configured (fallback can use either). */
export function activeProviderConfigured(): boolean {
  return geminiConfigured() || groqConfigured();
}

export type { LlmProvider } from "./types";
