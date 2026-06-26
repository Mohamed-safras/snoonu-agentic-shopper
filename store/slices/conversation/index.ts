import type { Conversation } from "@/types";
import type { SliceCreator } from "../../types";
import type { ConversationSlice } from "./types";

const emptyConv: Conversation = {
  city: null,
  cityName: null,
  date: null,
  dateLabel: null,
  sameDay: false,
  gift: null,
  occasion: null,
  lastOrder: null,
  budget: null,
  autobuyRequest: null,
  autobuyKept: null,
};

export const createConversationSlice: SliceCreator<ConversationSlice> = (
  set,
) => ({
  conv: emptyConv,
  patchConv: (patch) =>
    set((store) => ({ conv: { ...store.conv, ...patch } })),
});
