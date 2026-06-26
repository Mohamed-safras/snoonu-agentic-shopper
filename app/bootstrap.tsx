"use client";
import { useEffect } from "react";
import { useTrova, hydrateTrova } from "@/store";
import {
  warmUpSpeech,
  registerSpeechSessionGesture,
} from "@/lib/speech/speak";
import { useReadAloud } from "@/hooks/useReadAloud";
import { refreshWatchlist } from "@/lib/catalog/watch";

/**
 * Bootstrap — the single client-side startup point (rendered once in the root
 * layout). It wires the app's app-wide concerns; the heavy logic for each lives
 * in its own module (read-aloud → useReadAloud, watchlist → refreshWatchlist).
 */
export function Bootstrap() {
  const lang = useTrova((store) => store.lang);
  const loadSuggestions = useTrova((store) => store.loadSuggestions);

  // 1) Restore persisted state + theme on mount; prefetch translations; warm TTS;
  //    refresh the watchlist; track OS theme changes.
  useEffect(() => {
    hydrateTrova();
    useTrova.getState().initTheme();
    // Warm ALL languages in the background so switching the language tab is
    // instant + accurate (no flash of English while a fetch resolves).
    const { loadLang } = useTrova.getState();
    (["ar", "si", "ta"] as const).forEach(
      (language) => void loadLang(language),
    );
    // Warm the TTS connection so the first read-aloud reply isn't delayed by a
    // cold connection (first synthesis is ~3s, later ones ~250ms).
    if (useTrova.getState().speak) warmUpSpeech();
    // After rehydration settles, refresh the watchlist (price drop / restock).
    const watchTimer = setTimeout(() => void refreshWatchlist(), 1500);

    // Mark the speech session active on the first real gesture, so auto-spoken
    // cards restored on reload stay silent until the shopper actually interacts.
    const releaseGesture = registerSpeechSessionGesture();

    return () => {
      clearTimeout(watchTimer);
      releaseGesture();
    };
  }, []);

  // 2) Hands-free read-aloud (own module).
  useReadAloud();

  // 3) Dynamic suggestions: initial load + on language change.
  useEffect(() => {
    void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return null;
}
