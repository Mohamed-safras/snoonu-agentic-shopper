/**
 * Hands-free read-aloud. Subscribes to the store and, while "speak" is on, reads
 * each assistant reply aloud AS IT STREAMS — flushing each complete sentence the
 * instant it's ready so playback starts immediately (not after the whole turn).
 * Persisted messages restored on reload are never re-spoken. One hook, mounted
 * once by Bootstrap.
 */
"use client";
import { useEffect } from "react";
import { useTrova } from "@/store";
import { enqueueSpeech, stopSpeaking, warmUpSpeech } from "@/lib/speech/speak";
import type { ChatMessage } from "@/types";

/** Index just past the last sentence-ending punctuation in `text` (0 if none). */
function lastSentenceEndIndex(text: string): number {
  const sentenceTerminator = /[.!?…।。！？\n]+/g;
  let endIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = sentenceTerminator.exec(text)))
    endIndex = match.index + match[0].length;
  return endIndex;
}

export function useReadAloud(): void {
  useEffect(() => {
    let wasPlaying = useTrova.getState().playing;
    let spokenMessageId: string | null = null; // assistant message we're voicing
    let spokenCharCount = 0; // chars of it already queued
    // Only speak replies from turns that actually run THIS session.
    let hasStartedTurnThisSession = false;

    return useTrova.subscribe((state) => {
      // A new turn started → stop anything playing and reset progress. Warm the
      // TTS path (throttled) during think-time so a cooled connection still
      // starts promptly.
      if (!wasPlaying && state.playing) {
        stopSpeaking();
        spokenMessageId = null;
        spokenCharCount = 0;
        hasStartedTurnThisSession = true;
        if (state.speak) warmUpSpeech();
      }

      if (state.speak && hasStartedTurnThisSession) {
        // Find the latest user message and the latest assistant reply. Only a
        // reply AFTER the last user message belongs to the current turn (during
        // "thinking" the last trova message is the PREVIOUS reply — don't re-speak).
        let lastUserMessageIndex = -1;
        let latestReplyIndex = -1;
        let latestReply: Extract<ChatMessage, { kind: "text" }> | null = null;
        for (
          let messageIndex = state.messages.length - 1;
          messageIndex >= 0;
          messageIndex--
        ) {
          const message = state.messages[messageIndex];
          if (message.kind !== "text") continue;
          if (message.role === "user" && lastUserMessageIndex === -1)
            lastUserMessageIndex = messageIndex;
          else if (message.role === "trova" && latestReplyIndex === -1) {
            latestReplyIndex = messageIndex;
            latestReply = message;
          }
          if (lastUserMessageIndex !== -1 && latestReplyIndex !== -1) break;
        }

        if (latestReply && latestReplyIndex > lastUserMessageIndex) {
          if (latestReply.id !== spokenMessageId) {
            spokenMessageId = latestReply.id;
            spokenCharCount = 0;
          }
          if (latestReply.text.length > spokenCharCount) {
            const pendingText = latestReply.text.slice(spokenCharCount);
            if (state.playing) {
              // Still streaming → speak only the complete sentences so far.
              const sentenceEnd = lastSentenceEndIndex(pendingText);
              if (sentenceEnd > 0) {
                enqueueSpeech(pendingText.slice(0, sentenceEnd), state.lang);
                spokenCharCount += sentenceEnd;
              }
            } else {
              // Turn finished → speak whatever remains (the tail sentence).
              enqueueSpeech(pendingText, state.lang);
              spokenCharCount = latestReply.text.length;
            }
          }
        }
      }

      wasPlaying = state.playing;
    });
  }, []);
}
