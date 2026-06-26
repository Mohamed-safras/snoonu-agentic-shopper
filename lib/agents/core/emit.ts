/** Streaming-reply helpers for the orchestrator (emit NDJSON AgentEvents).
 *  MT-first: the agent composes everything in English; these helpers machine-
 *  translate the user-facing text to Arabic/Sinhala/Tamil before emitting, so
 *  the LLM is never burdened with those scripts. */
import "server-only";
import {
  machineTranslate,
  machineTranslationConfigured,
} from "@/lib/i18n/machine-translation";
import type { EmitFn } from "./context";
import type { Chip, Lang } from "@/types";

/** True when the text should be machine-translated into `lang`. */
function shouldTranslate(lang: Lang): boolean {
  return (
    (lang === "ar" || lang === "si" || lang === "ta") &&
    machineTranslationConfigured()
  );
}

/** Emit a message as a few sentence-sized deltas (streaming feel). Translates to
 *  `lang` first when it's Arabic/Sinhala/Tamil. */
export async function emitMessage(
  emit: EmitFn,
  message: string,
  lang: Lang,
): Promise<void> {
  const text = message.trim();
  if (!text) return;
  const out = shouldTranslate(lang)
    ? (await machineTranslate([text], lang))[0] || text
    : text;
  const parts = out.match(/[^.!?]+[.!?]*\s*/g) ?? [out];
  for (const part of parts) emit({ type: "text", delta: part });
}

/** Emit one live agentic-loop narration line (e.g. autobuy's search/reason
 *  steps) as its own "step" event — rendered as an interactive step list,
 *  never mixed into the reply's text bubble. Translates to `lang` first when
 *  it's Arabic/Sinhala/Tamil, same as emitMessage. */
export async function emitStep(
  emit: EmitFn,
  text: string,
  lang: Lang,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const out = shouldTranslate(lang)
    ? (await machineTranslate([trimmed], lang))[0] || trimmed
    : trimmed;
  emit({ type: "step", text: out });
}

/** Emit quick-reply chips, translating their labels to `lang` (ar/si/ta) first. */
export async function emitChips(
  emit: EmitFn,
  chips: Chip[],
  lang: Lang,
): Promise<void> {
  if (!chips.length) return;
  let items = chips;
  if (shouldTranslate(lang)) {
    const labels = await machineTranslate(
      chips.map((chip) => chip.label),
      lang,
    );
    items = chips.map((chip, index) => ({
      ...chip,
      label: labels[index] ?? chip.label,
    }));
  }
  emit({ type: "chips", items });
}
