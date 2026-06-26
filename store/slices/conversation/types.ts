import type { Conversation } from "@/types";

/** Conversation context (city, dates, gift, occasion, last order). */
export interface ConversationSlice {
  conv: Conversation;
  patchConv: (patch: Partial<Conversation>) => void;
}
