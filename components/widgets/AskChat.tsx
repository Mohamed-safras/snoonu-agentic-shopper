"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useTrova } from "@/store";
import { enqueueSpeech, stopSpeaking, warmUpSpeech } from "@/lib/speech/speak";
import { useTranslate } from "@/hooks/useTranslate";

export interface AskTurn {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessage {
  role: "user" | "trova";
  text: string;
}

/** Index just past the last sentence-ending punctuation in `text` (0 if none). */
function lastSentenceEnd(text: string): number {
  const matcher = /[.!?…।。！？\n]+/g;
  let end = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) end = match.index + match[0].length;
  return end;
}

/**
 * A compact, multi-turn Q&A chat. It POSTs to `endpoint` (body from `buildBody`)
 * and STREAMS the plain-text reply into the bubble as it arrives — and, when
 * read-aloud is on, speaks each sentence the moment it completes (the speech
 * queue serialises them, so they never collide). Reused for "ask about this
 * product" and "ask about the comparison".
 */
export function AskChat({
  endpoint,
  buildBody,
  placeholder,
  starters = [],
}: {
  endpoint: string;
  buildBody: (question: string, history: AskTurn[]) => Record<string, unknown>;
  placeholder: string;
  starters?: string[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const speak = useTrova((store) => store.speak);
  const language = useTrova((store) => store.lang);
  const translate = useTranslate();

  const scrollToEnd = () =>
    requestAnimationFrame(() =>
      threadRef.current?.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: "smooth",
      }),
    );

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput("");
    const history: AskTurn[] = messages.map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    }));
    // Add the user turn + an empty assistant bubble we stream into.
    setMessages((previous) => [
      ...previous,
      { role: "user", text: question },
      { role: "trova", text: "" },
    ]);
    setBusy(true);
    // Drop any speech still queued from the previous answer so this new reply
    // isn't spoken behind a backlog.
    if (speak) {
      stopSpeaking();
      warmUpSpeech(); // warm TTS during the reply's think-time
    }

    const setAnswer = (value: string) =>
      setMessages((previous) => {
        const copy = [...previous];
        copy[copy.length - 1] = { role: "trova", text: value };
        return copy;
      });

    let full = "";
    let spokenLen = 0;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(question, history)),
      });
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setAnswer(full);
          // Speak each complete sentence as it streams in.
          if (speak) {
            const cut = lastSentenceEnd(full.slice(spokenLen));
            if (cut > 0) {
              enqueueSpeech(full.slice(spokenLen, spokenLen + cut), language);
              spokenLen += cut;
            }
          }
          scrollToEnd();
        }
      } else {
        full = await response.text();
        setAnswer(full);
      }
      if (speak && full.length > spokenLen)
        enqueueSpeech(full.slice(spokenLen), language); // tail sentence
    } catch {
      setAnswer(translate("Sorry, I couldn't answer that — please try again."));
    }
    setBusy(false);
    scrollToEnd();
  }

  return (
    <div className="askchat">
      {messages.length > 0 && (
        <div className="askchat-thread" ref={threadRef}>
          {messages.map((message, index) => (
            <div key={index} className={"askchat-msg " + message.role}>
              {message.role === "trova" && !message.text ? (
                <span className="llm-dot">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                message.text
              )}
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && starters.length > 0 && (
        <div className="askchat-starters">
          {starters.map((starter) => (
            <button
              key={starter}
              className="askchat-starter"
              onClick={() => send(starter)}
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      <div className="askchat-row">
        <Icon name="spark" size={15} className="askchat-ask-icon" />
        <input
          className="addr-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          placeholder={placeholder}
        />
        <button
          className="askchat-send"
          onClick={() => send()}
          disabled={busy || !input.trim()}
          aria-label={translate("Send")}
        >
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </div>
  );
}
