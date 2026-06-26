/** Placed-order shape (returned by create_order). */
import type { CartItem } from "./product";

export interface Order {
  id: string; // order reference returned by create_order
  items: CartItem[];
  currency: string;
  sub: number; // items subtotal in `currency`
  fee: number; // delivery in `currency`
  total: number;
  city?: string | null;
  dateLabel?: string | null;
  sameDay?: boolean;
  gift?: string | null;
  /** True when the shopper ordered for themselves (not gifting someone else). */
  forSelf?: boolean;
  /** Who receives it (recipient for a gift, or the shopper for a self-order). */
  recipientName?: string | null;
  payUrl?: string; // genuine 60-min pay link from MCP
  expiresAt?: string;
  /** True when the pay link was already opened automatically (autobuy's
   *  hands-off checkout) — the order-placed card skips the QR/manual "tap to
   *  pay" panel it'd otherwise show, since there's nothing left to scan. */
  autoOpened?: boolean;
}
