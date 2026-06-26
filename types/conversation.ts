/** Conversation context + one LLM-facing turn. */
import type { Order } from "./order";
import type { Product } from "./product";

export interface Conversation {
  city: string | null;
  cityName?: string | null;
  date: string | null;
  dateLabel: string | null;
  sameDay: boolean;
  gift: string | null;
  occasion: string | null;
  lastOrder: Order | null;
  budget: number | null;
  autobuyRequest: string | null;
  autobuyKept: Product[] | null;
}

/** One LLM-facing conversation turn (what we POST to /api/chat). */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
