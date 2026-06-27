"use client";
import { useEffect } from "react";
import { useHala, hydrateHala } from "@/store";
import { warmUpSpeech, registerSpeechSessionGesture } from "@/lib/speech/speak";
import { useReadAloud } from "@/hooks/useReadAloud";
import { refreshWatchlist } from "@/lib/catalog/watch";

/**
 * Bootstrap — the single client-side startup point (rendered once in the root
 * layout). It wires the app's app-wide concerns; the heavy logic for each lives
 * in its own module (read-aloud → useReadAloud, watchlist → refreshWatchlist).
 */
export function Bootstrap() {
  const lang = useHala((store) => store.lang);
  const loadSuggestions = useHala((store) => store.loadSuggestions);

  // 1) Restore persisted state + theme on mount; prefetch translations; warm TTS;
  //    refresh the watchlist; track OS theme changes.
  useEffect(() => {
    hydrateHala();
    useHala.getState().initTheme();
    // Warm ALL languages in the background so switching the language tab is
    // instant + accurate (no flash of English while a fetch resolves).
    const { loadLang } = useHala.getState();
    (["ar", "si", "ta"] as const).forEach(
      (language) => void loadLang(language),
    );
    // Warm the TTS connection so the first read-aloud reply isn't delayed by a
    // cold connection (first synthesis is ~3s, later ones ~250ms).
    if (useHala.getState().speak) warmUpSpeech();
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

  // 4) Sync <html lang> with the active language (for `:lang()` CSS font
  //    selectors + accessibility). Deliberately NOT setting `dir="rtl"` here —
  //    that would mirror every flex row app-wide (icon order, button order,
  //    chip rows), and this CSS uses hardcoded physical left/right positioning
  //    in many places that wouldn't follow, producing a half-mirrored mess.
  //    Arabic TEXT direction is handled per-element via dir="auto" instead
  //    (see MessageView.tsx, Intro.tsx), which right-aligns/flows Arabic
  //    content correctly without flipping the surrounding layout.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}
