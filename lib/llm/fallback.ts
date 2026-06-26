/**
 * Resilient provider: tries the primary LLM, and on any failure (quota/429,
 * network, bad output) transparently falls back to the secondary. Lets us wire
 * both real keys (Gemini + Groq) so the app self-heals if one is unavailable.
 */
import "server-only";
import type { GenerateOptions, LlmProvider, LlmResponse } from "./types";

export function makeFallback(primary: LlmProvider, secondary: LlmProvider): LlmProvider {
  return {
    name: `${primary.name}->${secondary.name}`,

    async generate(opts: GenerateOptions): Promise<LlmResponse> {
      try {
        return await primary.generate(opts);
      } catch (err) {
        console.warn(`[llm] ${primary.name} failed, falling back to ${secondary.name}:`, err instanceof Error ? err.message : err);
        return secondary.generate(opts);
      }
    },

    async *stream(opts: GenerateOptions): AsyncIterable<string> {
      try {
        // Buffer the first chunk so a primary failure falls back cleanly.
        const it = primary.stream(opts)[Symbol.asyncIterator]();
        const first = await it.next();
        if (!first.done) yield first.value as string;
        let next = await it.next();
        while (!next.done) {
          yield next.value as string;
          next = await it.next();
        }
      } catch (err) {
        console.warn(`[llm] ${primary.name} stream failed, falling back to ${secondary.name}:`, err instanceof Error ? err.message : err);
        yield* secondary.stream(opts);
      }
    },
  };
}
