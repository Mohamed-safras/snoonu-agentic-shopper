/**
 * Central state shape, composed from focused slices (the zustand equivalent of
 * Redux slices). `HalaState` is the intersection of every slice; each slice
 * creator is typed against the whole state, so any slice can call another
 * slice's actions through `get()`.
 */
import type { StateCreator } from "zustand";
import type { I18nSlice } from "./slices/i18n/types";
import type { ThemeSlice } from "./slices/theme/types";
import type { CatalogSlice } from "./slices/catalog/types";
import type { ChatSlice } from "./slices/chat/types";
import type { AgentSlice } from "./slices/agent/types";
import type { CartSlice } from "./slices/cart/types";
import type { OrdersSlice } from "./slices/orders/types";
import type { ConversationSlice } from "./slices/conversation/types";
import type { PrefsSlice } from "./slices/prefs/types";
import type { UiSlice } from "./slices/ui/types";

export type HalaState = I18nSlice &
  ThemeSlice &
  CatalogSlice &
  ChatSlice &
  AgentSlice &
  CartSlice &
  OrdersSlice &
  ConversationSlice &
  PrefsSlice &
  UiSlice;

/** Middleware tuple — the store is wrapped in `persist`. */
export type StoreMutators = [["zustand/persist", unknown]];

/** A slice creator typed against the full state (so `get()` sees everything). */
export type SliceCreator<TSlice> = StateCreator<
  HalaState,
  StoreMutators,
  [],
  TSlice
>;
