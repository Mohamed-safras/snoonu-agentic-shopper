/**
 * Checkout specialist — validates and creates a REAL Snoonu guest-checkout
 * order via MCP, returning a genuine click-to-pay link. Rate-guarded so a
 * runaway loop can never spam live orders.
 */
import "server-only";
import { createOrder } from "@/lib/mcp/tools";
import { buildOrder } from "@/lib/mcp/adapters";
import { canCreateOrder, recordOrderCreated } from "@/lib/mcp/order-guard";
import { quoteDelivery } from "./delivery";
import type { CreateOrderInput } from "@/lib/mcp/schemas";
import type { CartItem, Order } from "@/types";

export interface CheckoutRequest {
  cart: CartItem[];
  recipient: { name: string; phone: string };
  delivery: {
    address: string;
    city: string;
    date: string; // YYYY-MM-DD
    location_type?: "house" | "apartment" | "office" | "other";
    instructions?: string | null;
  };
  sender: { name: string; anonymous?: boolean };
  giftMessage?: string | null;
  /** True when the shopper is ordering for themselves (not gifting). */
  forSelf?: boolean;
  dateLabel?: string | null;
  /** Optional per-product cake message, keyed by product id. */
  icing?: Record<string, string>;
}

export class OrderRateLimitError extends Error {
  constructor() {
    super("order-rate-limited");
    this.name = "OrderRateLimitError";
  }
}

/** Create a real order and return the display Order (with pay link). */
export async function placeOrder(
  checkoutRequest: CheckoutRequest,
): Promise<Order> {
  if (!canCreateOrder()) throw new OrderRateLimitError();

  // Authoritative delivery fee for the totals shown on the receipt.
  const quote = await quoteDelivery(
    checkoutRequest.delivery.city,
    checkoutRequest.delivery.date,
    checkoutRequest.cart[0]?.id,
  ).catch(() => null);

  const input: CreateOrderInput = {
    cart: checkoutRequest.cart.map(({ id, quantity }) => ({
      product_id: id,
      quantity: quantity,
      icing_text: checkoutRequest.icing?.[id]?.trim() || null,
    })),
    recipient: checkoutRequest.recipient,
    delivery: {
      address: checkoutRequest.delivery.address,
      city: checkoutRequest.delivery.city,
      location_type: checkoutRequest.delivery.location_type ?? "house",
      date: checkoutRequest.delivery.date,
      instructions: checkoutRequest.delivery.instructions ?? null,
    },
    sender: {
      name: checkoutRequest.sender.name,
      anonymous: checkoutRequest.sender.anonymous ?? false,
    },
    gift_message: checkoutRequest.giftMessage ?? null,
    currency: "QAR",
  };

  const raw = await createOrder(input);
  recordOrderCreated();

  const order = buildOrder(raw, {
    items: checkoutRequest.cart,
    currency: "QAR",
    city: checkoutRequest.delivery.city,
    dateLabel: checkoutRequest.dateLabel,
    gift: checkoutRequest.giftMessage,
    forSelf: checkoutRequest.forSelf ?? false,
    recipientName: checkoutRequest.recipient.name,
    fee: quote?.fee ?? 0,
  });

  // A guest order is only actionable with a working pay link. If Snoonu returned
  // no link — or one that's already expired — surface an error so the caller can
  // tell the shopper to retry, instead of showing a broken "Order placed" card
  // with no way to pay.
  if (!order.payUrl) {
    throw new Error(
      "Snoonu didn't return a payment link for this order. Please try placing it again in a moment.",
    );
  }
  if (order.expiresAt) {
    const expiryTime = new Date(order.expiresAt).getTime();
    if (Number.isFinite(expiryTime) && expiryTime <= Date.now()) {
      throw new Error(
        "The payment link from Snoonu has already expired. Please try placing the order again.",
      );
    }
  }

  return order;
}
