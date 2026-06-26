/** Builds and POSTs the real /api/checkout request body — the one place this
 *  happens, shared by the manual CheckoutForm and autobuy's autonomous
 *  hand-off so both stay byte-for-byte consistent with the live Kapruka API. */
import type { CartItem, Order } from "@/types";

export interface SubmitOrderInput {
  cart: CartItem[];
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  date: string | null;
  dateLabel: string | null;
  locationType: "house" | "apartment" | "office" | "other";
  instructions: string;
  pin?: { lat: number; lng: number } | null;
  senderName: string;
  anonymous: boolean;
  giftMessage: string;
  forSelf: boolean;
}

export type SubmitOrderResult =
  | { order: Order; error?: undefined }
  | { order?: undefined; error: string };

export async function submitOrder(
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cart: input.cart,
        recipient: {
          name: input.recipientName.trim(),
          phone: input.recipientPhone.trim(),
        },
        delivery: {
          // Normalize the address line so it composes cleanly (consistent
          // comma + space, no doubled/edge punctuation or whitespace).
          address: input.address
            .trim()
            .replace(/\s*,\s*/g, ", ")
            .replace(/\s{2,}/g, " ")
            .replace(/^[\s,;-]+|[\s,;-]+$/g, ""),
          city: input.city,
          date: input.date,
          location_type: input.locationType,
          // The MCP has no coordinate field, so a confirmed map pin rides
          // along in the instructions. Raw lat,lng (NOT a URL) because
          // Kapruka uppercases instructions and strips ":" / "/", which would
          // break a link — coordinates survive and the courier can map them.
          instructions:
            [
              input.instructions.trim(),
              input.pin
                ? `Exact GPS location ${input.pin.lat.toFixed(6)}, ${input.pin.lng.toFixed(6)}`
                : "",
            ]
              .filter(Boolean)
              .join(" — ")
              .slice(0, 250) || null,
        },
        // For "myself" orders the sender IS the recipient and there's no
        // gift card, so reuse their name and drop the note / anonymity.
        sender: {
          name: (input.forSelf ? input.recipientName : input.senderName).trim(),
          anonymous: input.forSelf ? false : input.anonymous,
        },
        giftMessage: input.forSelf ? null : input.giftMessage.trim() || null,
        forSelf: input.forSelf,
        dateLabel: input.dateLabel,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Checkout failed — please try again." };
    return { order: data.order as Order };
  } catch {
    return { error: "Network error — please try again." };
  }
}
