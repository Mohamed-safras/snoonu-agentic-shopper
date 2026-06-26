/**
 * UI chrome strings for the 4 supported languages. Conversational replies come
 * from the LLM; these cover static labels, the greeting, and quick-start chips.
 */
import type { Lang } from "@/types";

export interface LangDef {
  code: Lang;
  label: string;
  name: string;
}

export const LANGS: LangDef[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "ar", label: "عربي", name: "Arabic" },
  { code: "si", label: "සිං", name: "Sinhala" },
  { code: "ta", label: "தமி", name: "Tamil" },
];

export interface Strings {
  online: string;
  cart: string;
  empty_cart: string;
  subtotal: string;
  delivery: string;
  total: string;
  checkout: string;
  add: string;
  free: string;
  greet_title: string;
  greet_body: string;
  suggest: string;
  chips: [string, string, string, string];
  order_placed: string;
}

/**
 * English is the SINGLE source of truth. All other languages are produced by
 * the real LLM translator (lib/agents/translate.ts) at runtime and cached — no
 * translations are hand-authored here.
 */
export const enStrings: Strings = {
  online: "Online · replies instantly",
  cart: "Cart",
  empty_cart: "Your cart is empty",
  subtotal: "Subtotal",
  delivery: "Delivery",
  total: "Total",
  checkout: "Checkout",
  add: "Add to cart",
  free: "FREE",
  greet_title: "Marhaba! I'm Trova 👋",
  greet_body:
    "Your personal shopping concierge for all of Qatar. Tell me who it's for and the moment you're celebrating — I'll find something perfect and get it to checkout.",
  suggest: "Or tap a quick start:",
  chips: [
    "🎁 Father's Day gift for Dad",
    "🎂 Birthday surprise, same-day",
    "🌹 Romantic anniversary gift",
    "🤔 I'm not sure — help me pick",
  ],
  order_placed: "Order confirmed",
};

/** Only the English source ships in code; `T.en` is the translation source. */
export const T: { en: Strings } = { en: enStrings };

export function strings(): Strings {
  return enStrings;
}
