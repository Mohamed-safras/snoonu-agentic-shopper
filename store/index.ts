/**
 * Central state-management entry point. Composes the per-domain slices (see
 * ./slices/*) into one persisted zustand store, the way Redux combines reducers.
 * Components import everything they need from "@/store".
 */
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TrovaState } from "./types";
import { createI18nSlice } from "./slices/i18n";
import { createThemeSlice } from "./slices/theme";
import { createCatalogSlice } from "./slices/catalog";
import { createChatSlice } from "./slices/chat";
import { createAgentSlice } from "./slices/agent";
import { createCartSlice } from "./slices/cart";
import { createOrdersSlice } from "./slices/orders";
import { createConversationSlice } from "./slices/conversation";
import { createPrefsSlice } from "./slices/prefs";
import { createUiSlice } from "./slices/ui";

export const useTrova = create<TrovaState>()(
  persist(
    (...a) => ({
      ...createI18nSlice(...a),
      ...createThemeSlice(...a),
      ...createCatalogSlice(...a),
      ...createChatSlice(...a),
      ...createCartSlice(...a),
      ...createOrdersSlice(...a),
      ...createConversationSlice(...a),
      ...createPrefsSlice(...a),
      ...createAgentSlice(...a),
      ...createUiSlice(...a),
    }),
    {
      name: "trova-chat",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : (undefined as unknown as Storage),
      ),
      // Manual rehydration (see hydrateTrova) avoids SSR/client mismatch.
      skipHydration: true,
      // Bump when a translation-cache shape/quality change means OLD persisted
      // translations must be dropped (not just merged) so they retranslate
      // fresh instead of staying stuck with stale/lower-quality cached text.
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as TrovaState;
        if (version < 2) {
          state.i18n = {};
          state.uiTranslations = {};
          state.messages = state.messages?.map((message) =>
            "tx" in message ? { ...message, tx: undefined } : message,
          );
        }
        // v3: Tanglish ("tl") removed + Arabic ("ar") added — drop any cache
        // built before that switch (the old translator prompt assumed a Sri
        // Lankan audience and could mis-translate the new "ar" target into
        // Singlish instead of Arabic).
        if (version < 3) {
          state.i18n = {};
          state.uiTranslations = {};
          state.messages = state.messages?.map((message) =>
            "tx" in message ? { ...message, tx: undefined } : message,
          );
        }
        return state;
      },
      // Persist only durable state. Banners + dynamic suggestions are never
      // stored (regenerated live); chip messages are dropped (stale actions);
      // uploaded photos are stripped (size).
      partialize: (store) => ({
        lang: store.lang,
        // Cache fetched translations so the language tab switches instantly on
        // return visits (no re-fetch, no flash of English).
        i18n: store.i18n,
        uiTranslations: store.uiTranslations,
        cart: store.cart,
        conv: store.conv,
        favorites: store.favorites,
        dislikes: store.dislikes,
        ageConfirmed: store.ageConfirmed,
        orders: store.orders,
        checkoutName: store.checkoutName,
        deliveryProfile: store.deliveryProfile,
        speak: store.speak,
        voiceByLanguage: store.voiceByLanguage,
        watches: store.watches,
        messages: store.messages
          .filter((message) => message.kind !== "chips")
          .map((message) =>
            message.kind === "attach" && message.photos
              ? { ...message, photos: undefined }
              : message,
          ),
      }),
    },
  ),
);

/** Rehydrate the persisted store on the client (call once on mount). */
export function hydrateTrova() {
  void useTrova.persist.rehydrate();
}

export { nextId } from "./ids";
export type { TrovaState } from "./types";
export type { SendOptions } from "./slices/agent/types";
export type { ChatMessage, Chip, UiDirective } from "@/types";
