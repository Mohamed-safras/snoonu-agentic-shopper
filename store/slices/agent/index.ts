import { nextId } from "../../ids";
import type { SliceCreator } from "../../types";
import type { AgentSlice } from "./types";
import type { AgentEvent, ChatMessage, ChatTurn } from "@/types";

// The in-flight request's abort controller (one turn at a time), kept outside
// store state so toggling it never triggers a re-render.
let activeController: AbortController | null = null;

export const createAgentSlice: SliceCreator<AgentSlice> = (set, get) => ({
  // Drives a conversational turn: POSTs to /api/chat and streams the NDJSON
  // AgentEvent protocol back into the store (text deltas, tool activity, UI
  // directives, chips, occasion). Operates entirely on store state.
  send: async (text, opts = {}) => {
    const store = get();
    if (store.playing) return;

    const images = (opts.images ?? []).filter(Boolean);
    const trimmed = text.trim();
    if (!trimmed && !images.length) return;

    const history: ChatTurn[] = store.messages
      .filter(
        (message): message is Extract<ChatMessage, { kind: "text" }> =>
          message.kind === "text",
      )
      .map((message) => ({
        role: message.role === "user" ? "user" : "assistant",
        content: message.text,
      }));
    // On a replay the user message is already in `messages` (and thus history);
    // pushing/adding it again would duplicate the turn.
    if (trimmed && !opts.replay) history.push({ role: "user", content: trimmed });

    if ((trimmed || images.length) && !opts.silent && !opts.replay) {
      store.addMessage({
        id: nextId(),
        kind: "text",
        role: "user",
        text: trimmed,
        photos: images.length ? images : undefined,
        at: Date.now(),
      });
    }
    store.setPlaying(true);
    const thinkingId = store.addMessage({ id: nextId(), kind: "thinking" });

    const controller = new AbortController();
    activeController = controller;

    let assistantId: string | null = null;
    const ensureBubble = () => {
      if (assistantId) return assistantId;
      get().removeMessage(thinkingId);
      assistantId = nextId();
      get().addMessage({
        id: assistantId,
        kind: "text",
        role: "trova",
        lead: true,
        text: "",
        at: Date.now(),
      });
      return assistantId;
    };

    // A live agentic-loop narration (e.g. autobuy) gets its OWN message —
    // never mixed into the reply bubble's text — so it renders as an
    // interactive step list instead of a wall of plain text.
    let stepsId: string | null = null;
    const ensureSteps = () => {
      if (stepsId) return stepsId;
      stepsId = nextId();
      get().addMessage({ id: stepsId, kind: "steps", items: [] });
      return stepsId;
    };

    const handle = (agentEvent: AgentEvent) => {
      const live = get();
      switch (agentEvent.type) {
        case "text":
          // The first real reply text after some steps marks them complete —
          // collapses the live list into its finished state.
          if (stepsId) live.finishSteps(stepsId);
          live.appendText(ensureBubble(), agentEvent.delta);
          break;
        case "step":
          live.appendStep(ensureSteps(), agentEvent.text);
          break;
        case "tool":
          if (agentEvent.status === "running") live.flashTool(agentEvent.name);
          break;
        case "ui":
          // The success path emits a UI card straight after the loop with no
          // trailing text — finish the step list here too, not just on "text".
          if (stepsId) live.finishSteps(stepsId);
          // These are singleton cards (one live "Track an order" / delivery
          // form / watchlist / checkout panel at a time) — drop any earlier
          // one of the same kind first, same as startDelivery/startTracking/
          // addToWatchlist already do when triggered directly, so asking
          // twice in chat (e.g. "where is my order?" again) updates the
          // existing card instead of stacking a new one underneath it.
          for (const message of live.messages)
            if (
              message.kind === "attach" &&
              message.directive.kind === agentEvent.directive.kind
            )
              live.removeMessage(message.id);
          live.addMessage({
            id: nextId(),
            kind: "attach",
            directive: agentEvent.directive,
            photos: images.length ? images : undefined,
          });
          break;
        case "chips":
          if (agentEvent.items.length)
            live.addMessage({
              id: nextId(),
              kind: "chips",
              items: agentEvent.items,
            });
          break;
        case "occasion":
          live.patchConv({ occasion: agentEvent.value });
          break;
        case "warning":
          live.addMessage({
            id: nextId(),
            kind: "warning",
            reason: agentEvent.reason,
          });
          break;
        case "patch":
          live.patchConv(agentEvent.conv);
          break;
        case "error":
        case "done":
          break;
      }
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history,
          lang: store.lang,
          cart: store.cart,
          conv: store.conv,
          images,
          ageConfirmed: store.ageConfirmed,
        }),
      });
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            try {
              handle(JSON.parse(trimmedLine) as AgentEvent);
            } catch {
              /* ignore partial frame */
            }
          }
        }
      }
    } catch (error) {
      // A deliberate stop isn't an error — just leave whatever streamed so far.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        get().appendText(
          ensureBubble(),
          "Aiyo, the connection dropped — mind trying again?",
        );
      }
    } finally {
      if (activeController === controller) activeController = null;
      get().removeMessage(thinkingId);
      get().setPlaying(false);
    }
  },

  userSend: async (text, opts) => {
    // Any user-initiated turn collapses the promo banner — chat takes over.
    get().setBannerForced("closed");
    await get().send(text, opts);
  },

  // "Try again": discard this assistant reply and everything generated after it
  // (its cards/chips), then re-run the turn from the preceding user message.
  regenerate: async (assistantId) => {
    const store = get();
    if (store.playing) return;
    const messages = store.messages;
    const index = messages.findIndex((message) => message.id === assistantId);
    if (index < 0) return;

    // Find the user message that prompted this reply.
    let userText = "";
    let userPhotos: string[] | undefined;
    for (let cursor = index - 1; cursor >= 0; cursor--) {
      const message = messages[cursor];
      if (message.kind === "text" && message.role === "user") {
        userText = message.text;
        userPhotos = message.photos;
        break;
      }
    }
    if (!userText && !(userPhotos && userPhotos.length)) return;

    // Drop the old reply (and any cards/chips that followed it), keeping the
    // user message in place, then replay the turn.
    store.removeMessagesFrom(assistantId);
    await store.send(userText, { images: userPhotos, replay: true });
  },

  // "Try again" on a user bubble: drop everything generated after that message
  // (its reply + cards), keep the message itself, then re-run the turn.
  resendUserMessage: async (userMessageId) => {
    const store = get();
    if (store.playing) return;
    const messages = store.messages;
    const index = messages.findIndex((message) => message.id === userMessageId);
    if (index < 0) return;
    const message = messages[index];
    if (message.kind !== "text" || message.role !== "user") return;

    set({ messages: messages.slice(0, index + 1) });
    await store.send(message.text, {
      images: message.photos,
      replay: true,
    });
  },

  stopGeneration: () => {
    activeController?.abort();
  },
});
