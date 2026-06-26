import { nextId } from "../../ids";
import type { SliceCreator } from "../../types";
import type { UiSlice } from "./types";

export const createUiSlice: SliceCreator<UiSlice> = (set, get) => ({
  bannerForced: null,
  setBannerForced: (bannerForced) => set({ bannerForced }),

  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  ordersOpen: false,
  setOrdersOpen: (ordersOpen) => set({ ordersOpen }),
  skuProduct: null,
  setSkuProduct: (skuProduct) => set({ skuProduct }),

  toast: null,
  showToast: (text) => {
    set({ toast: text });
    setTimeout(
      () => set((store) => (store.toast === text ? { toast: null } : store)),
      2200,
    );
  },

  composerDraft: null,
  setComposerDraft: (composerDraft) => set({ composerDraft }),

  compareItems: [],
  toggleCompare: (product) =>
    set((store) => {
      const exists = store.compareItems.some((item) => item.id === product.id);
      if (exists)
        return {
          compareItems: store.compareItems.filter(
            (item) => item.id !== product.id,
          ),
        };
      if (store.compareItems.length >= 4) return store; // cap at 4
      return { compareItems: [...store.compareItems, product] };
    }),
  clearCompare: () => set({ compareItems: [] }),

  saveCompareResult: (messageId, detail, comparison) =>
    set((store) => ({
      messages: store.messages.map((message) =>
        message.id === messageId &&
        message.kind === "attach" &&
        message.directive.kind === "compare"
          ? {
              ...message,
              directive: { ...message.directive, detail, comparison },
            }
          : message,
      ),
    })),

  pushAttach: (directive, photos) =>
    get().addMessage({ id: nextId(), kind: "attach", directive, photos }),

  pushOrderPlaced: (order) => {
    // Re-placing an order (after editing delivery/items) should UPDATE the
    // existing "Order placed" window, not stack another. Drop any current one,
    // then show the fresh order. A genuinely new turn just gets a new card.
    for (const message of get().messages)
      if (message.kind === "attach" && message.directive.kind === "checkout")
        get().removeMessage(message.id);
    get().pushAttach({ kind: "checkout", order });
    // The order is real now — a later message should never be misread as
    // feedback on an autobuy pick that's already been bought, and the now-
    // ordered items shouldn't carry into a future, unrelated autobuy flow.
    get().patchConv({ autobuyRequest: null, autobuyKept: null });
  },

  recordOrderSuccess: (order) => {
    get().patchConv({ lastOrder: order });
    get().addOrder(order); // remember for one-tap reordering
    // The order now tracks these items — leaving them in the cart too would
    // just accumulate stale clutter across every future order.
    get().removeItems(order.items.map((item) => item.id));
    get().pushOrderPlaced(order);
  },

  startDelivery: () => {
    if (!get().cart.length) {
      get().showToast("Add something lovely first 🌸");
      return;
    }
    // Reuse a single checkout card — drop any existing one so we never stack
    // duplicates. The form reads the cart live, so one card always reflects
    // edits made anywhere (cart drawer, quantity steppers, etc.).
    for (const message of get().messages)
      if (message.kind === "attach" && message.directive.kind === "checkout_form")
        get().removeMessage(message.id);
    get().pushAttach({ kind: "checkout_form" });
  },

  giftSelectionIds: null,
  setGiftSelection: (giftSelectionIds) => set({ giftSelectionIds }),
  startGiftCheckout: (ids) => {
    set({ giftSelectionIds: ids });
    get().startDelivery();
  },

  startTracking: () => {
    // One live tracker at a time — same dedupe as startDelivery/checkout.
    for (const message of get().messages)
      if (message.kind === "attach" && message.directive.kind === "tracking")
        get().removeMessage(message.id);
    get().pushAttach({
      kind: "tracking",
      order: get().conv.lastOrder ?? undefined,
    });
  },

  pushWatchlistUpdate: () => {
    // Drop any existing watchlist card before pushing a fresh one — otherwise
    // every background price/stock refresh (app open) stacks another card in
    // the thread, even though each one already shows live data.
    for (const message of get().messages)
      if (message.kind === "attach" && message.directive.kind === "watchlist")
        get().removeMessage(message.id);
    get().pushAttach({ kind: "watchlist" });
  },

  handleChip: (chip) => {
    const store = get();
    switch (chip.action) {
      case "open_cart":
        store.setCartOpen(true);
        break;
      case "to_delivery":
      case "checkout":
        store.startDelivery();
        break;
      case "track":
        store.startTracking();
        break;
      case "concierge":
        store.pushAttach({ kind: "surprise" });
        break;
      default:
        void store.userSend(chip.payload || chip.label);
    }
  },
});
