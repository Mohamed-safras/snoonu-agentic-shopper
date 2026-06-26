import type {
  Chip,
  Order,
  Product,
  ProductComparison,
  UiDirective,
} from "@/types";

/** Ephemeral UI: drawers, product detail, promo banner, toast, and the
 *  cross-cutting navigation actions. */
export interface UiSlice {
  /** Promo banner override: explicit open/closed, or null = auto. */
  bannerForced: "open" | "closed" | null;
  setBannerForced: (value: "open" | "closed" | null) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  ordersOpen: boolean;
  setOrdersOpen: (open: boolean) => void;
  skuProduct: Product | null;
  setSkuProduct: (product: Product | null) => void;
  toast: string | null;
  showToast: (text: string) => void;
  /** Text published by an "edit" action for the composer to pick up (resend). */
  composerDraft: string | null;
  setComposerDraft: (text: string | null) => void;
  /** Products staged for side-by-side comparison (max 4). */
  compareItems: Product[];
  toggleCompare: (product: Product) => void;
  clearCompare: () => void;
  /** Cache a computed comparison onto its thread card so a reload renders the
   *  saved result instead of recomputing. */
  saveCompareResult: (
    messageId: string,
    detail: Product[],
    comparison: ProductComparison | null,
  ) => void;
  /** Append a UI card to the thread. */
  pushAttach: (directive: UiDirective, photos?: string[]) => void;
  /** Show the "Order placed" card, replacing any existing one (re-place = update). */
  pushOrderPlaced: (order: Order) => void;
  /** A real order just succeeded — remember it, drop the ordered items from
   *  the cart, and show the "Order placed" card. Shared by the manual
   *  checkout form and autobuy's inline CheckoutForm hand-off so both stay
   *  on one code path. */
  recordOrderSuccess: (order: Order) => void;
  /** Open the self-contained checkout form (guards an empty cart). */
  startDelivery: () => void;
  /** When set, the checkout form pre-selects ONLY these cart item ids (e.g. a
   *  "send as gift" of just a hamper); cleared once the form consumes it. */
  giftSelectionIds: string[] | null;
  setGiftSelection: (ids: string[] | null) => void;
  /** Open checkout with only `ids` pre-selected (the rest of the cart unticked). */
  startGiftCheckout: (ids: string[]) => void;
  /** Open order tracking for the most recent order. */
  startTracking: () => void;
  /** Show the watchlist card, replacing any existing one so background price/
   *  stock refreshes never stack duplicate cards in the thread. */
  pushWatchlistUpdate: () => void;
  /** Handle a quick-reply chip (navigation, or a fresh search). */
  handleChip: (chip: Chip) => void;
}
