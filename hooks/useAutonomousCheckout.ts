"use client";
import { useState } from "react";
import { findEarliestDate } from "@/lib/checkout/findEarliestDate";
import { submitOrder } from "@/lib/checkout/submitOrder";
import { useHala } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";
import type { DeliveryProfile } from "@/store/slices/prefs/types";
import type { Product } from "@/types";

/** Places a REAL order with zero manual checkout form — automatically finds
 *  the earliest available delivery date, then submits via the same
 *  submitOrder() path the manual CheckoutForm uses. Shared by autobuy's
 *  "confirm" action (a known saved profile) and its first-time mini delivery
 *  form (a freshly-typed one) so both stay on one code path. Saves the
 *  profile on success so the NEXT autobuy is fully autonomous too. */
export function useAutonomousCheckout() {
  const translate = useTranslate();
  const addProduct = useHala((store) => store.addProduct);
  const removeItems = useHala((store) => store.removeItems);
  const pushOrderPlaced = useHala((store) => store.pushOrderPlaced);
  const addOrder = useHala((store) => store.addOrder);
  const patchConv = useHala((store) => store.patchConv);
  const setDeliveryProfile = useHala((store) => store.setDeliveryProfile);
  const showToast = useHala((store) => store.showToast);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  async function place(
    products: Product[],
    profile: DeliveryProfile,
    // When the delivery profile was ALREADY known (no form shown this turn),
    // the pay tab opening automatically is confirmation enough — skip the
    // "Order placed" card too so confirming doesn't double up on UI. The
    // first-time delivery-form path still wants the card (it has no other
    // success state of its own beyond a one-line message).
    opts: { showCard?: boolean } = {},
  ): Promise<boolean> {
    const showCard = opts.showCard ?? true;
    setPlacing(true);
    setError("");
    const earliest = await findEarliestDate(profile.city, products[0].id);
    if (!earliest) {
      setError(
        translate(
          "Couldn't confirm a delivery date automatically — let's finish it together.",
        ),
      );
      setPlacing(false);
      return false;
    }
    products.forEach((product) => addProduct(product));
    const cartItems = useHala
      .getState()
      .cart.filter((item) =>
        products.some((product) => product.id === item.id),
      );
    const result = await submitOrder({
      cart: cartItems,
      recipientName: profile.recipientName,
      recipientPhone: profile.phone,
      address: profile.address,
      city: profile.city,
      date: earliest.iso,
      dateLabel: earliest.label,
      locationType: profile.locationType,
      instructions: profile.instructions,
      // `senderName` can legitimately be empty on a saved profile — the
      // manual CheckoutForm hides/doesn't require that field for a "for
      // myself" order. Snoonu's create_order rejects an empty sender name
      // outright (zod: sender.name must be >= 1 char), so fall back to the
      // recipient's own name (always validated non-empty) rather than ever
      // submitting blank.
      senderName: profile.senderName?.trim() || profile.recipientName,
      anonymous: false,
      giftMessage: "",
      forSelf: false,
    });
    if (!result.order) {
      setError(translate(result.error));
      setPlacing(false);
      return false;
    }
    // Autobuy is meant to be hands-off end to end — once the order is
    // confirmed, jump straight to the real Snoonu pay page instead of
    // making the shopper find and tap a link or scan a QR (that only makes
    // sense for the manual flow, where someone else might pay from a
    // different device). `autoOpened` tells the order-placed card to skip
    // that panel since there's nothing left to scan.
    const opened = Boolean(
      result.order.payUrl &&
      window.open(result.order.payUrl, "_blank", "noopener,noreferrer"),
    );
    const order = { ...result.order, autoOpened: opened };
    setDeliveryProfile(profile);
    patchConv({ lastOrder: order });
    addOrder(order);
    // The order now tracks these items — leaving them in the cart too would
    // just accumulate stale clutter across every future autobuy order.
    removeItems(order.items.map((item) => item.id));
    if (showCard) {
      pushOrderPlaced(order);
    } else {
      // pushOrderPlaced's other job — clearing the autobuy continuity flag
      // and kept-items carry-over so a later message is never misread as
      // feedback on a pick that's already been bought — still needs to
      // happen even without the card.
      patchConv({ autobuyRequest: null, autobuyKept: null });
      showToast(
        translate(
          opened
            ? "Order placed 🎉 — pay page opened in a new tab"
            : "Order placed 🎉",
        ),
      );
    }
    setPlacing(false);
    return true;
  }

  return { place, placing, error };
}
