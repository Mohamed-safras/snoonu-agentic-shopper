/** Agent protocol: UI directives, chips, streamed events, and chat-message UI. */
import type { Product, CartItem } from "./product";
import type { Order } from "./order";
import type { Conversation, ChatTurn } from "./conversation";
import type { Lang } from "./i18n";

/** Continuation handle for a shelf so a "View more" button can fetch the next
 *  page of results via the MCP cursor (true pagination, not a re-search). */
export interface ShelfMore {
  query: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  /** Cursor for the NEXT page; the shelf hides "View more" once it's empty. */
  cursor: string;
}

export type UiDirective =
  | {
      kind: "shelf";
      title: string;
      sub?: string;
      products: Product[];
      /** Present when more pages exist — drives the "View more" button. */
      more?: ShelfMore;
      /** Flagged-explicit results awaiting age confirmation — render blurred
       *  behind a confirm gate instead of showing images outright. */
      gated?: boolean;
    }
  | { kind: "spotlight"; product: Product; gated?: boolean }
  | { kind: "delivery" }
  | { kind: "dates" }
  | { kind: "gift" }
  | { kind: "checkout_form" }
  | { kind: "checkout"; order: Order }
  | { kind: "tracking"; order?: Order; orderNumber?: string }
  | { kind: "surprise" }
  | { kind: "hamper" }
  | { kind: "kit" }
  | { kind: "countdown" }
  | {
      kind: "compare";
      products: Product[];
      /** Computed once, then cached on the directive so the card renders the
       *  saved result on reload instead of re-running the comparison. */
      detail?: Product[];
      comparison?: ProductComparison | null;
    }
  | { kind: "watchlist" }
  | { kind: "photo_match"; products: Product[]; gated?: boolean }
  | {
      kind: "autobuy_confirm";
      products: Product[];
      /** A few real, in-budget runner-ups not picked — shown as "You may
       *  also like" so the shopper can swap one in without re-running the loop. */
      alternates?: Product[];
      budget: number;
      currency: string;
    };

/** LLM side-by-side product comparison (values aligned to product order). */
export interface ProductComparison {
  criteria: {
    label: string;
    values: string[];
    /** Index of the product that wins this row, or -1 for a tie / not-applicable. */
    winnerIndex?: number;
  }[];
  recommendationIndex: number;
  reason: string;
  bestValueIndex: number;
  /** Per-product verdict (aligned to product order): who it's best for, plus a
   *  one-line strength and watch-out. */
  verdicts?: { bestFor: string; pro: string; con: string }[];
  /** Whether the picks are genuinely head-to-head comparable. When false, the
   *  card warns (with `context`) and only crowns a winner if the shopper insists. */
  comparable?: boolean;
  /** One-line framing shown when the picks are quite different (e.g. a phone vs
   *  chocolates) — explains how they're being compared. */
  context?: string;
}

export type ChipAction =
  | "occasion"
  | "browse"
  | "concierge"
  | "to_delivery"
  | "checkout"
  | "track"
  | "open_cart"
  | "add"
  | "chat"
  | "city"
  | "date";

export interface Chip {
  label: string;
  action?: ChipAction;
  payload?: string;
  primary?: boolean;
}

/** NDJSON events streamed from the orchestrator to the client. */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; status: "running" | "done" }
  | { type: "ui"; directive: UiDirective }
  | { type: "chips"; items: Chip[] }
  | { type: "occasion"; value: string }
  | { type: "patch"; conv: Partial<Conversation> }
  | { type: "warning"; reason: "profanity" }
  /** A live agentic-loop narration line (e.g. autobuy's search/reason steps)
   *  — rendered as its own interactive step list, never mixed into the
   *  reply's text bubble. */
  | { type: "step"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

/** A rendered message in the chat thread (client UI state). */
export type ChatMessage =
  | {
      id: string;
      kind: "text";
      role: "user" | "hala";
      lead?: boolean;
      /** Currently-displayed text (may be a translation of `original`). */
      text: string;
      photos?: string[];
      /** Epoch ms when the message was created (shown as a bubble timestamp). */
      at?: number;
      /** The text in the language it was first written (source for re-translation). */
      original?: string;
      /** Cached translations by language code, so switching back is instant. */
      tx?: Record<string, string>;
    }
  | { id: string; kind: "typing" }
  | { id: string; kind: "thinking" }
  | { id: string; kind: "chips"; items: Chip[] }
  | { id: string; kind: "warning"; reason: "profanity" }
  /** Live agentic-loop narration (e.g. autobuy) — one growing list of short
   *  step lines, rendered as its own interactive timeline. */
  | { id: string; kind: "steps"; items: string[]; done?: boolean }
  | {
      id: string;
      kind: "attach";
      directive: UiDirective;
      /** Uploaded image(s) tied to this card (e.g. a visual-search query). */
      photos?: string[];
    };

/** Request body for POST /api/chat. */
export interface ChatRequest {
  messages: ChatTurn[];
  lang: Lang;
  cart: CartItem[];
  conv: Conversation;
  images?: string[];
  /** Shopper already confirmed they're 18+ this session — skip re-asking. */
  ageConfirmed?: boolean;
}
