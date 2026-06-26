"use client";
import { useTranslate } from "@/hooks/useTranslate";
import { useTrova } from "@/store";
import React, { RefObject, SetStateAction, useEffect, useState } from "react";

export interface TextInputProps {
  input: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  setTextInput: (value: SetStateAction<string>) => void;
  setTextInputFocused: (value: SetStateAction<boolean>) => void;
  handleSend(text?: string): void;
}

const FALLBACK_PLACEHOLDER = "Ask me anything — I know the catalog 🛍️";
// One fixed example mixed into the rotation so shoppers discover the autobuy
// feature from the placeholder itself, not just docs/chips.
const AUTOBUY_EXAMPLE = "pick and order a birthday gift";

export const TextInput: React.FC<TextInputProps> = ({
  input,
  inputRef,
  setTextInput,
  setTextInputFocused,
  handleSend,
}) => {
  const [phIdx, setPhIdx] = useState(0);
  const placeholders = useTrova((store) => store.placeholders);
  const translate = useTranslate();

  // Placeholder rotates through crisp LLM-phrased example queries (dynamic),
  // shown as a search-style hint: Try "…". Falls back to a neutral hint.

  // Mix the fixed autobuy example into the dynamic rotation so shoppers
  // discover it from the placeholder itself, without dropping any of the
  // catalog-driven examples.
  const rotation = [...placeholders, AUTOBUY_EXAMPLE];
  const phrase = rotation[phIdx % rotation.length];
  const placeholder = phrase
    ? translate('Try "{phrase}…"', { phrase })
    : translate(FALLBACK_PLACEHOLDER);

  useEffect(() => {
    const interval = setInterval(() => setPhIdx((i) => i + 1), 4500);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="input-stack">
      <textarea
        ref={inputRef}
        rows={1}
        value={input}
        placeholder={placeholder}
        onFocus={() => setTextInputFocused(true)}
        onBlur={() => setTimeout(() => setTextInputFocused(false), 150)}
        onChange={(event) => {
          setTextInput(event.target.value);
          event.target.style.height = "auto";
          event.target.style.height =
            Math.min(110, event.target.scrollHeight) + "px";
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
          }
        }}
      />
    </div>
  );
};

export default TextInput;
