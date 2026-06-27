/**
 * Text-to-speech for hands-free replies. Speaks in the language the reply is
 * actually written in (Arabic/Sinhala/Tamil script wins, else the UI language).
 *
 * Primary: Microsoft Edge's free neural voices via /api/tts (high, consistent
 * quality on every device). Fallback: the browser's built-in speechSynthesis,
 * used automatically if the TTS request fails or audio playback is blocked.
 *
 * Speech is QUEUED sentence-by-sentence so the reply starts playing the moment
 * its first sentence is ready (instead of waiting for the whole turn + one big
 * synthesis), and clean prose is spoken (markdown/symbols/emoji stripped).
 */
import { detectScriptLang } from "@/lib/i18n/lang";
import { useHala } from "@/store";
import { defaultVoiceForLanguage } from "./voices";
import type { Lang } from "@/types";

// Locale for the browser-synthesis fallback (uses whatever voices are installed).
const FALLBACK_LOCALE: Record<Lang, string> = {
  en: "en-US",
  ar: "ar-QA",
  si: "si-LK",
  ta: "ta-LK",
};

/** Turn reply text into something a voice should actually say: drop markdown,
 *  links/URLs and emoji so they aren't read aloud. The on-screen text keeps all
 *  of this; only the spoken copy is cleaned. */
export function cleanForSpeech(text: string): string {
  return (
    text
      // [label](url) -> label ; ![alt](url) -> alt
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      // bare URLs
      .replace(/https?:\/\/\S+/g, "")
      // markdown emphasis / headings / code / quotes
      .replace(/[*_`#>~|]/g, "")
      // list bullets at line start
      .replace(/^\s*[-•·]\s+/gm, "")
      // emoji + the joiners/flags/keycaps that compose them
      .replace(/\p{Extended_Pictographic}/gu, "")
      .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
      .replace(/[\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, "")
      // tidy whitespace
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s*\n\s*/g, ". ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

interface SpeechItem {
  text: string;
  language: Lang;
  requestToken: number;
  // Synthesis is kicked off the moment the chunk is queued (prefetch), so by the
  // time the previous sentence finishes playing this one's audio is usually
  // already in hand — that's what removes the gap between sentences.
  audio: Promise<Blob | null>;
}

// Whether the shopper has actively interacted (a real gesture) THIS session.
// Auto-spoken UI — like the compare recommendation, which speaks from a mount
// effect — checks this so a card RESTORED from the persisted thread on page
// reload isn't re-read aloud. Module state resets on reload (starts false), and
// only a freshly created card follows a genuine gesture, which is exactly the
// distinction we want. `registerSpeechSessionGesture` arms the one-shot listener.
let speechSessionActive = false;
export function isSpeechSessionActive(): boolean {
  return speechSessionActive;
}
export function registerSpeechSessionGesture(): () => void {
  if (typeof window === "undefined") return () => {};
  const activate = () => {
    speechSessionActive = true;
    // Warm a TTS connection the instant the shopper engages, so the first reply
    // hits a hot pooled connection (~250ms) instead of a cold handshake (~3s).
    if (useHala.getState().speak) warmUpSpeech();
  };
  const events = ["pointerdown", "keydown"] as const;
  for (const eventName of events)
    window.addEventListener(eventName, activate, { once: true });
  return () => {
    for (const eventName of events)
      window.removeEventListener(eventName, activate);
  };
}

let speechQueue: SpeechItem[] = [];
let isSpeaking = false;
let currentAudioPlayer: HTMLAudioElement | null = null;
// Bumped on every stop so any in-flight fetch / queued chunk knows it's stale.
let activeRequestToken = 0;

/** Start Edge synthesis for a chunk immediately. Resolves to the audio blob, or
 *  null if it failed (so playback can fall back to browser speech). */
function synthesizeChunk(text: string, language: Lang): Promise<Blob | null> {
  const { voiceByLanguage } = useHala.getState();
  const voiceId =
    voiceByLanguage[language] ?? defaultVoiceForLanguage(language);
  return fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang: language, voice: voiceId }),
  })
    .then((response) => (response.ok ? response.blob() : null))
    .catch(() => null);
}

/** Split text into sentence-sized chunks so the SHORT first sentence can be
 *  synthesised + played quickly while the rest synthesise in parallel — this is
 *  what removes the "waits, then starts" delay on a whole-answer enqueue. */
function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?…।。！？])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [text];
}

// Each synthesized clip carries a little leading/trailing silence and there's a
// small gap when one <Audio> hands off to the next — so MORE clips = more audible
// "breaths". We therefore GROUP sentences into as few clips as possible: a short
// FIRST clip so playback starts fast, then large clips so the rest flows with
// minimal breaks. Sizes are in characters (a rough proxy for clip duration).
const FIRST_CLIP_MAX_CHARS = 110; // fast time-to-first-audio
const REST_CLIP_MAX_CHARS = 320; // fewer, longer clips → fewer breaths

/** Pack sentences into the fewest clips that respect the per-clip size caps. */
function groupForSpeech(text: string): string[] {
  const sentences = splitSentences(text);
  const clips: string[] = [];
  let buffer = "";
  for (const sentence of sentences) {
    const cap = clips.length === 0 ? FIRST_CLIP_MAX_CHARS : REST_CLIP_MAX_CHARS;
    if (buffer && buffer.length + 1 + sentence.length > cap) {
      clips.push(buffer);
      buffer = sentence;
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer) clips.push(buffer);
  return clips;
}

/** Queue reply text. It's grouped into a few clips and synthesis for EACH begins
 *  right away (prefetch), so the first clip plays quickly and the rest follow
 *  back-to-back with minimal gaps. */
export function enqueueSpeech(text: string, uiLanguage: Lang): void {
  if (typeof window === "undefined") return;
  const cleanedText = cleanForSpeech(text);
  if (!cleanedText) return;
  const language = detectScriptLang(cleanedText) ?? uiLanguage;
  for (const chunk of groupForSpeech(cleanedText)) {
    speechQueue.push({
      text: chunk,
      language,
      requestToken: activeRequestToken,
      audio: synthesizeChunk(chunk, language),
    });
  }
  if (!isSpeaking) {
    isSpeaking = true;
    void playNextInQueue();
  }
}

/** Play the next queued chunk (its audio is already being synthesised), chaining
 *  to the following one the instant it ends. */
async function playNextInQueue(): Promise<void> {
  const nextItem = speechQueue.shift();
  if (!nextItem) {
    isSpeaking = false;
    return;
  }
  const playFollowing = () => {
    if (nextItem.requestToken === activeRequestToken) void playNextInQueue();
  };

  const blob = await nextItem.audio; // usually already resolved (prefetched)
  if (nextItem.requestToken !== activeRequestToken) return; // stopped meanwhile
  if (!blob) {
    speakWithBrowser(
      nextItem.text,
      nextItem.language,
      nextItem.requestToken,
      playFollowing,
    );
    return;
  }
  const audioObjectUrl = URL.createObjectURL(blob);
  const audioPlayer = new Audio(audioObjectUrl);
  currentAudioPlayer = audioPlayer;
  const handlePlaybackEnd = () => {
    URL.revokeObjectURL(audioObjectUrl);
    if (currentAudioPlayer === audioPlayer) currentAudioPlayer = null;
    playFollowing();
  };
  audioPlayer.onended = handlePlaybackEnd;
  audioPlayer.onerror = handlePlaybackEnd;
  await audioPlayer.play().catch(handlePlaybackEnd);
}

/** Browser-native speech synthesis (fallback only). Picks the closest installed
 *  voice; calls `onFinished` when done so the queue continues. */
function speakWithBrowser(
  text: string,
  language: Lang,
  requestToken: number,
  onFinished: () => void,
): void {
  if (!window.speechSynthesis || requestToken !== activeRequestToken) {
    onFinished();
    return;
  }
  const locale = FALLBACK_LOCALE[language];
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.rate = 1;
  utterance.pitch = 1;
  const availableVoices = window.speechSynthesis.getVoices();
  const localePrefix = locale.split("-")[0];
  const matchingVoice =
    availableVoices.find((candidate) => candidate.lang === locale) ||
    availableVoices.find((candidate) =>
      candidate.lang?.startsWith(localePrefix),
    );
  if (matchingVoice) utterance.voice = matchingVoice;
  utterance.onend = onFinished;
  utterance.onerror = onFinished;
  window.speechSynthesis.speak(utterance);
}

/** Play a short sample in a specific voice — used by the voice picker so the
 *  shopper can hear a voice before choosing it. `sampleText` should already be
 *  in `language` (we pass the translated greeting), so Sinhala/Tamil voices
 *  preview with real native text. */
export function previewVoice(
  voiceId: string,
  language: Lang,
  sampleText: string,
): void {
  stopSpeaking();
  const text = cleanForSpeech(sampleText) || "Hello";
  const requestToken = activeRequestToken;
  void (async () => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: language, voice: voiceId }),
      });
      if (!response.ok || requestToken !== activeRequestToken) return;
      const audioObjectUrl = URL.createObjectURL(await response.blob());
      if (requestToken !== activeRequestToken) {
        URL.revokeObjectURL(audioObjectUrl);
        return;
      }
      const audioPlayer = new Audio(audioObjectUrl);
      currentAudioPlayer = audioPlayer;
      const handlePlaybackEnd = () => {
        URL.revokeObjectURL(audioObjectUrl);
        if (currentAudioPlayer === audioPlayer) currentAudioPlayer = null;
      };
      audioPlayer.onended = handlePlaybackEnd;
      audioPlayer.onerror = handlePlaybackEnd;
      await audioPlayer.play().catch(handlePlaybackEnd);
    } catch {
      /* ignore */
    }
  })();
}

/** Stop all speech and clear the queue (new turn, or the shopper muted it). */
export function stopSpeaking(): void {
  activeRequestToken++; // invalidate in-flight + queued items
  speechQueue = [];
  isSpeaking = false;
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer.src = "";
    currentAudioPlayer = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis)
    window.speechSynthesis.cancel();
}

/** Unlock audio playback from a user gesture (browsers block the first play
 *  otherwise). Call this inside the click that enables read-aloud. */
export function primeSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    const silentAudio = new Audio();
    silentAudio.muted = true;
    void silentAudio.play().catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    if (window.speechSynthesis) {
      const warmupUtterance = new SpeechSynthesisUtterance(" ");
      warmupUtterance.volume = 0;
      window.speechSynthesis.speak(warmupUtterance);
    }
  } catch {
    /* ignore */
  }
  warmUpSpeech();
}

// The first TTS request is slow (~3s) because the server opens a cold WS/TLS
// connection to the voice service; later requests are ~250ms. We fire a tiny
// throwaway synthesis ahead of time (no playback) so the first REAL reply hits a
// warm path. Throttled so an idle-cooled connection gets re-warmed.
let lastWarmAt = 0;
export function warmUpSpeech(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastWarmAt < 60_000) return;
  lastWarmAt = now;
  void fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "hi",
      lang: "en",
      voice: defaultVoiceForLanguage("en"),
    }),
  }).catch(() => {});
}
