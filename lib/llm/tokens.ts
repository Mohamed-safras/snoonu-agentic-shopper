import type { Lang } from "@/types";

/**
 * Sinhala, Tamil and Arabic text encodes to far more tokens than the same
 * English content (their characters fall outside the BPE merges tuned for
 * Latin), so an English-tuned budget cuts replies off mid-sentence. Scale the
 * budget up generously for those languages (extra headroom — the model stops
 * on its own when the thought is complete, so a higher ceiling never wastes
 * tokens, it just prevents truncation).
 */
const NON_LATIN_TOKEN_MULTIPLIER = 5;

export function langTokens(baseTokens: number, lang: Lang): number {
  return lang === "si" || lang === "ta" || lang === "ar"
    ? Math.round(baseTokens * NON_LATIN_TOKEN_MULTIPLIER)
    : baseTokens;
}
