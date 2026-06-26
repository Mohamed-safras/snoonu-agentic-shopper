import { detectScriptLang } from "@/lib/i18n/lang";
import type { Lang } from "@/types";
import type { SliceCreator } from "../../types";
import type { ChatSlice } from "./types";

/** The language a stored line was originally written in (best-effort). */
const sourceLangOf = (text: string): Lang => detectScriptLang(text) ?? "en";

export const createChatSlice: SliceCreator<ChatSlice> = (set, get) => ({
  messages: [],
  addMessage: (message) => {
    set((store) => ({ messages: store.messages.concat(message) }));
    return message.id;
  },
  appendText: (id, delta) =>
    set((store) => ({
      messages: store.messages.map((message) =>
        message.id === id && message.kind === "text"
          ? { ...message, text: message.text + delta }
          : message,
      ),
    })),
  appendStep: (id, text) =>
    set((store) => ({
      messages: store.messages.map((message) =>
        message.id === id && message.kind === "steps"
          ? { ...message, items: [...message.items, text] }
          : message,
      ),
    })),
  finishSteps: (id) =>
    set((store) => ({
      messages: store.messages.map((message) =>
        message.id === id && message.kind === "steps"
          ? { ...message, done: true }
          : message,
      ),
    })),
  removeMessage: (id) =>
    set((store) => ({
      messages: store.messages.filter((message) => message.id !== id),
    })),
  removeMessagesFrom: (id) =>
    set((store) => {
      const index = store.messages.findIndex((message) => message.id === id);
      return index < 0
        ? store
        : { messages: store.messages.slice(0, index) };
    }),
  clearThread: () => set({ messages: [] }),

  // Re-translate the whole existing thread when the language changes, so old
  // messages match the new language too (not just new replies). Each language
  // is cached per message, so switching back is instant and free.
  retranslateThread: async (target) => {
    // Capture an `original` (source) + cache the source language up front, and
    // immediately show any cached translation for the target.
    set((store) => ({
      messages: store.messages.map((message) => {
        if (message.kind !== "text") return message;
        const original = message.original ?? message.text;
        const tx = { ...(message.tx ?? {}), [sourceLangOf(original)]: original };
        const cached = tx[target];
        return cached
          ? { ...message, original, tx, text: cached }
          : { ...message, original, tx };
      }),
    }));

    // Lines that still need a translation for the target language.
    const pendingSources = get()
      .messages.filter(
        (message): message is Extract<typeof message, { kind: "text" }> =>
          message.kind === "text" &&
          Boolean((message.original ?? message.text).trim()) &&
          !message.tx?.[target],
      )
      .map((message) => message.original ?? message.text);
    if (!pendingSources.length) return;

    // Dedupe identical lines (e.g. repeated confirmations) so each unique
    // string is sent to the translation API once, not once per message. Group
    // by ACTUAL source language too — a thread mixes English replies with
    // Sinhala/Tamil ones (the assistant mirrors whatever the shopper typed), and
    // the MT engine needs the true source per line or it silently fails to
    // translate non-English originals.
    const uniqueSources = [...new Set(pendingSources)];
    const sourcesByLang = new Map<string, string[]>();
    for (const source of uniqueSources) {
      const sourceLang = sourceLangOf(source);
      const bucket = sourcesByLang.get(sourceLang);
      if (bucket) bucket.push(source);
      else sourcesByLang.set(sourceLang, [source]);
    }

    try {
      const translationBySource = new Map<string, string>();
      await Promise.all(
        [...sourcesByLang.entries()].map(async ([sourceLang, sources]) => {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lang: target, sourceLang, texts: sources }),
          }).then((result) => result.json());
          const translated: string[] = Array.isArray(response.texts)
            ? response.texts
            : [];
          sources.forEach((source, index) =>
            translationBySource.set(source, translated[index]),
          );
        }),
      );

      set((store) => ({
        messages: store.messages.map((message) => {
          if (message.kind !== "text") return message;
          const source = message.original ?? message.text;
          const value = translationBySource.get(source);
          if (typeof value !== "string" || !value.trim()) return message;
          // A no-op translation (backend fell back to the original) isn't a real
          // result — don't cache it as one, or this message gets stuck in the
          // wrong language forever (the cache-hit check skips it on every future
          // language switch). Leaving it uncached means the next switch retries.
          if (value === source) return message;
          return {
            ...message,
            tx: { ...(message.tx ?? {}), [target]: value },
            text: value,
          };
        }),
      }));
    } catch {
      /* keep the current text on failure */
    }
  },

  playing: false,
  setPlaying: (playing) => set({ playing }),

  activeTools: [],
  flashTool: (name) => {
    set((store) =>
      store.activeTools.includes(name)
        ? store
        : { activeTools: [...store.activeTools, name] },
    );
    setTimeout(
      () =>
        set((store) => ({
          activeTools: store.activeTools.filter((tool) => tool !== name),
        })),
      3000,
    );
  },
});
