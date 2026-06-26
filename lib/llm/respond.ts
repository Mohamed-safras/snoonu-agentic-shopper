/** HTTP helpers for plain-text LLM replies — stream the model's output straight
 *  to the client so the answer appears (and can be read aloud) as it's generated,
 *  instead of waiting for the whole completion. */
import "server-only";
import { getProvider } from "./index";
import {
  machineTranslate,
  machineTranslationConfigured,
} from "@/lib/i18n/machine-translation";
import type { GenerateOptions } from "./types";
import type { Lang } from "@/types";

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
};

/**
 * Language directive for MT-first Q&A prompts. The model must UNDERSTAND the
 * shopper's question whatever language it's in and answer the content — it must
 * never refuse or say "I can only respond in English" just because the question
 * isn't English (a Sinhala/Tamil/Arabic/romanized question is NOT out of
 * scope). It always writes in English; si/ta/ar replies are machine-translated
 * afterwards.
 */
export function replyLanguageDirective(): string {
  return "The shopper may ask in ANY language (English, Arabic, Sinhala, Tamil, or romanized) — always understand their question and answer its content; NEVER refuse or say you can only respond in English just because they didn't write in English. Write your reply in clear, natural English (it will be shown as-is or machine-translated for them)";
}

/** A plain-text Response delivered in one chunk — for fallbacks / errors. */
export function textResponse(text: string): Response {
  return new Response(text, { headers: TEXT_HEADERS });
}

/** Stream the LLM's plain-text reply as the response body (token by token). */
export function streamTextResponse(opts: GenerateOptions): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of getProvider().stream(opts))
          controller.enqueue(encoder.encode(delta));
      } catch {
        controller.enqueue(
          encoder.encode("Sorry, I couldn't answer that — please try again."),
        );
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: TEXT_HEADERS });
}

/**
 * MT-first reply: the model writes the answer in ENGLISH, then Google Translate
 * converts it to the target language — so the LLM is never burdened with
 * Sinhala/Tamil/Arabic. English streams token-by-token as usual; si/ta/ar
 * are generated whole, translated, then returned in one chunk. `opts` should
 * already instruct the model to answer in English.
 */
export function replyResponse(opts: GenerateOptions, lang: Lang): Response {
  const translateTo =
    lang === "si" || lang === "ta" || lang === "ar" ? lang : null;
  if (!translateTo || !machineTranslationConfigured())
    return streamTextResponse(opts);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { text } = await getProvider().generate(opts);
        const [translated] = await machineTranslate([text], translateTo);
        controller.enqueue(encoder.encode(translated || text));
      } catch {
        controller.enqueue(
          encoder.encode("Sorry, I couldn't answer that — please try again."),
        );
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: TEXT_HEADERS });
}
