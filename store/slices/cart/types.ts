import type { CartItem, Product } from "@/types";

/** The shopping cart. */
export interface CartSlice {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  /** Add to the cart and flash a toast. */
  addProduct: (product: Product) => void;
  setQty: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  /** Drop several items at once — used to clear ordered items out of the cart
   *  once a checkout actually succeeds (they're tracked via the Order now,
   *  not the cart). */
  removeItems: (ids: string[]) => void;
}
