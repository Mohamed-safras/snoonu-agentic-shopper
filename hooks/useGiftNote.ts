"use client";
import { useState } from "react";
import type { Lang } from "@/types";

/** AI gift-card writer: writes a heartfelt note (LLM, in the shopper's
 *  language) straight into the message box. Extracted out of CheckoutForm so
 *  the form itself stays focused on checkout activity. */
export function useGiftNote(
  initial: string,
  lang: Lang,
  occasion: string | null | undefined,
) {
  const [giftMsg, setGiftMsg] = useState(initial);
  const [notesLoading, setNotesLoading] = useState(false);

  // Tapping again rewrites it.
  async function writeNote() {
    setNotesLoading(true);
    try {
      const query = new URLSearchParams({ lang });
      if (occasion) query.set("occasion", occasion);
      const response = await fetch("/api/gift-notes?" + query.toString()).then(
        (result) => result.json(),
      );
      const note = Array.isArray(response.notes) ? response.notes[0] : null;
      if (typeof note === "string" && note.trim()) setGiftMsg(note.trim());
    } catch {
      /* keep whatever's in the box */
    }
    setNotesLoading(false);
  }

  return { giftMsg, setGiftMsg, notesLoading, writeNote };
}
