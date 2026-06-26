/** Shared types for the agent layer (server-side). */
import type {
  CartItem,
  ChatTurn,
  Conversation,
  Lang,
  AgentEvent,
} from "@/types";

export interface AgentContext {
  lang: Lang;
  messages: ChatTurn[];
  userText: string;
  cart: CartItem[];
  conv: Conversation;
  images?: string[];
  /** Shopper already confirmed they're 18+ this session — skip re-asking. */
  ageConfirmed?: boolean;
}

/** Sink the orchestrator/specialists push NDJSON events into. */
export type EmitFn = (event: AgentEvent) => void;
