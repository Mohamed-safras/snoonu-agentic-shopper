import type { SliceCreator } from "../../types";
import type { PrefsSlice } from "./types";
import { DEFAULT_VOICE_BY_LANGUAGE } from "@/lib/speech/voices";

const FAV_KEY = "trova_favs";

function loadFavs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

export const createPrefsSlice: SliceCreator<PrefsSlice> = (set, get) => ({
  favorites: loadFavs(),
  toggleFav: (id) => {
    const next = get().favorites.includes(id)
      ? get().favorites.filter((item) => item !== id)
      : get().favorites.concat(id);
    set({ favorites: next });
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  },

  dislikes: [],
  addDislike: (id) => {
    if (get().dislikes.includes(id)) return;
    set({ dislikes: get().dislikes.concat(id) });
  },

  checkoutName: "",
  setCheckoutName: (checkoutName) => set({ checkoutName }),

  deliveryProfile: null,
  setDeliveryProfile: (deliveryProfile) => set({ deliveryProfile }),

  // Hands-free: read the assistant's replies aloud (TTS) in the user's language.
  // On by default; toggled from the composer voice settings.
  speak: true,
  toggleSpeak: () => set({ speak: !get().speak }),
  voiceByLanguage: { ...DEFAULT_VOICE_BY_LANGUAGE },
  setVoiceForLanguage: (language, voiceId) =>
    set((store) => ({
      voiceByLanguage: { ...store.voiceByLanguage, [language]: voiceId },
    })),

  watches: [],
  toggleWatch: (item) =>
    set((store) => ({
      watches: store.watches.some((watch) => watch.id === item.id)
        ? store.watches.filter((watch) => watch.id !== item.id)
        : [item, ...store.watches].slice(0, 30),
    })),
  removeWatch: (id) =>
    set((store) => ({
      watches: store.watches.filter((watch) => watch.id !== id),
    })),
  updateWatches: (next) => set({ watches: next }),

  ageConfirmed: false,
  confirmAge: () => set({ ageConfirmed: true }),
});
