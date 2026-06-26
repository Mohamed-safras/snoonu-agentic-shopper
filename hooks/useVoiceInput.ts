/** Web Speech API wrapper for multilingual voice input (en-US/ar-QA/si-LK/ta-LK). */
"use client";
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/types";

type SpeechRecognitionConstructor = typeof window extends {
  SpeechRecognition: infer Constructor;
}
  ? Constructor
  : unknown;

// Auto-stop after this much silence once the user has stopped talking. Long
// enough that natural mid-sentence pauses don't cut the speaker off.
const AUTO_STOP_SILENCE_MS = 2800;

// Drop final chunks the engine is clearly unsure about (likely background
// noise). Engines that don't report confidence return 0 — those we keep.
const MIN_FINAL_CONFIDENCE = 0.35;

/** BCP-47 locale for recognition. */
function recognitionLocaleFor(language: Lang): string {
  if (language === "ar") return "ar-QA";
  if (language === "si") return "si-LK";
  if (language === "ta") return "ta-LK";
  return "en-US";
}

export function useVoiceInput(
  onTranscript: (text: string, isFinal: boolean) => void,
) {
  const recognitionRef = useRef<unknown>(null);
  const finalTranscriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  useEffect(() => {
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    // Client-only feature detection (window is unavailable during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(
      Boolean(
        windowWithSpeech.SpeechRecognition ||
        windowWithSpeech.webkitSpeechRecognition,
      ),
    );
  }, []);

  function startListening(language: Lang) {
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const RecognitionConstructor =
      windowWithSpeech.SpeechRecognition ||
      windowWithSpeech.webkitSpeechRecognition;
    if (!RecognitionConstructor) return;
    const recognition = new RecognitionConstructor();
    // continuous=true keeps listening through natural pauses; a silence timer
    // auto-stops once the user has actually finished (no manual tap needed).
    // The engine finalizes accurately on stop, so the committed text is correct.
    recognition.continuous = true;
    recognition.interimResults = true;
    // A few alternatives let us keep the most confident reading per phrase.
    recognition.maxAlternatives = 3;
    recognition.lang = recognitionLocaleFor(language);
    finalTranscriptRef.current = "";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interimTranscript = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        const recognitionResult = event.results[index];
        const bestAlternative = recognitionResult[0];
        const transcriptChunk = bestAlternative.transcript;
        if (recognitionResult.isFinal) {
          // Skip low-confidence finals (background noise / misfires). A 0 /
          // missing confidence means the engine didn't score it — keep those.
          const confidence = bestAlternative.confidence ?? 0;
          if (confidence === 0 || confidence >= MIN_FINAL_CONFIDENCE)
            finalTranscriptRef.current += transcriptChunk;
        } else interimTranscript += transcriptChunk;
      }
      // Live preview while listening — not "final" until recognition ends.
      onTranscript(
        (finalTranscriptRef.current + interimTranscript).trim(),
        false,
      );

      // Restart the silence countdown on every bit of speech. When the user
      // goes quiet for AUTO_STOP_SILENCE_MS, stop — the engine then emits the
      // accurate final result and onend commits it.
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }, AUTO_STOP_SILENCE_MS);
    };
    recognition.onend = () => {
      // Fires when silence auto-stop / user / engine ends it: commit the
      // accurate accumulated transcript.
      clearSilenceTimer();
      const finalTranscript = finalTranscriptRef.current.trim();
      if (finalTranscript) onTranscript(finalTranscript, true);
      setIsListening(false);
    };
    recognition.onerror = () => {
      clearSilenceTimer();
      setIsListening(false);
    };
    try {
      recognition.start();
      setIsListening(true);
      recognitionRef.current = recognition;
    } catch {
      setIsListening(false);
    }
  }

  function stopListening() {
    clearSilenceTimer();
    try {
      (recognitionRef.current as SpeechRecognitionLike | null)?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
  }

  return {
    active: isListening,
    supported: isSupported,
    start: startListening,
    stop: stopListening,
  };
}

/* Minimal structural types for the Web Speech API (not in TS DOM libs by default). */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: () => void;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    [index: number]: {
      0: { transcript: string; confidence?: number };
      isFinal: boolean;
    };
    length: number;
  };
}
