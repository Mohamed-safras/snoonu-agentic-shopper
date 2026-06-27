"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { isGenericCategory, tokenize } from "@/lib/catalog/products";
import { fmtPrice } from "@/lib/format/money";
import { useHala } from "@/store";
import { useAutonomousCheckout } from "@/hooks/useAutonomousCheckout";
import { useTranslate } from "@/hooks/useTranslate";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { Product } from "@/types";

/** The agent's final autobuy pick(s), shown for explicit confirmation before
 *  any cart/checkout action runs. The shopper can drop any pick they don't
 *  want before confirming. When a delivery profile is already saved (from a
 *  past order), confirming places the REAL order autonomously — zero manual
 *  form, pay link opened automatically. The very first time (no profile
 *  yet), this card turns INLINE into the same full checkout form any other
 *  order uses (pre-selected to just these picks) — no separate card appears
 *  further down the thread, it's the same card transitioning in place.
 *  Placing from there still auto-opens the pay link instead of showing the
 *  QR/manual-link panel, since autobuy is always meant to be hands-off. Once
 *  submitted, the profile is saved so every later autobuy skips the form
 *  entirely. Nothing is charged until the genuine Snoonu pay link is tapped. */
export function AutobuyConfirm({
  products,
  alternates,
  budget,
  currency,
}: {
  products: Product[];
  /** Real, in-budget runner-ups from the same search, not picked — offered as
   *  "You may also like" so the shopper can add one without re-running the
   *  whole loop. */
  alternates?: Product[];
  budget: number;
  currency: string;
}) {
  const translate = useTranslate();
  const setSkuProduct = useHala((store) => store.setSkuProduct);
  const showToast = useHala((store) => store.showToast);
  const deliveryProfile = useHala((store) => store.deliveryProfile);
  const conv = useHala((store) => store.conv);
  const addToCart = useHala((store) => store.addToCart);
  const setGiftSelection = useHala((store) => store.setGiftSelection);
  const recordOrderSuccess = useHala((store) => store.recordOrderSuccess);
  const patchConv = useHala((store) => store.patchConv);
  const { place, placing, error } = useAutonomousCheckout();

  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [droppedIds, setDroppedIds] = useState<Set<string>>(new Set());
  const [addedAlternateIds, setAddedAlternateIds] = useState<Set<string>>(
    new Set(),
  );
  const addedAlternates = (alternates || []).filter((product) =>
    addedAlternateIds.has(product.id),
  );
  const kept = [...products, ...addedAlternates].filter(
    (product) => !droppedIds.has(product.id),
  );
  const suggestions = (alternates || []).filter(
    (product) => !addedAlternateIds.has(product.id),
  );

  // Keep the remembered "kept" set in sync with every drop/add the shopper
  // makes by hand — if they then give more free-text feedback instead of
  // tapping a button here, the next loop run carries forward exactly what's
  // shown right now, not the server's original pick list.
  useEffect(() => {
    patchConv({ autobuyKept: kept });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only on actual user interaction (drop/add), not every render
  }, [droppedIds, addedAlternateIds]);

  // Which still-kept original pick an alternate would replace if swapped in.
  // Multi-item carts (e.g. a ring + flowers) need this matched by CONTENT,
  // not just "whichever pick happens to be first" — otherwise a flower
  // alternate could end up replacing the ring instead of the flower pick.
  // Token overlap with the product name (brand/category words score the
  // strongest, since they're the most distinctive) picks the closest match;
  // falls back to the first still-kept pick when nothing overlaps at all
  // (the common single-item case, or genuinely unrelated alternates).
  function swapTargetFor(alternate: Product): Product | undefined {
    const stillKept = products.filter((product) => !droppedIds.has(product.id));
    if (!stillKept.length) return undefined;
    const altTokens = new Set(tokenize(alternate.name));
    if (alternate.category)
      tokenize(alternate.category).forEach((t) => altTokens.add(t));
    let best: Product | undefined;
    let bestScore = 0;
    for (const product of stillKept) {
      const tokens = tokenize(product.name);
      if (product.category) tokens.push(...tokenize(product.category));
      const score = tokens.filter((token) => altTokens.has(token)).length;
      if (score > bestScore) {
        bestScore = score;
        best = product;
      }
    }
    return best ?? stillKept[0];
  }

  // "You may also like" defaults to a SWAP, not an add-on-top — tapping one
  // replaces the original pick it's most similar to (the most common case is
  // "I don't like the suggested item, use this one instead"). If every
  // original pick has already been swapped/dropped, there's nothing left to
  // replace, so it just adds — matching a genuinely multi-item request.
  function pickAlternate(alternate: Product) {
    setAddedAlternateIds((current) => new Set(current).add(alternate.id));
    const toReplace = swapTargetFor(alternate);
    if (toReplace) drop(toReplace.id);
  }

  const total = kept.reduce((sum, product) => sum + product.price, 0);
  const remaining = Math.max(budget - total, 0);
  const usedPct = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;
  const canAutoCheckout = Boolean(
    deliveryProfile?.recipientName &&
    deliveryProfile?.phone &&
    deliveryProfile?.address &&
    deliveryProfile?.city,
  );

  function drop(id: string) {
    setDroppedIds((current) => new Set(current).add(id));
  }

  async function confirm() {
    if (placing) return;
    if (!canAutoCheckout || !deliveryProfile) {
      // No saved profile yet — make sure the picks are actually in the cart
      // (the checkout form reads the cart, not these picks directly), then
      // turn THIS card inline into the same full checkout form any other
      // order uses, pre-selected to just these. Placing from there still
      // auto-opens the pay link (CheckoutForm's `autobuy` prop) — no separate
      // card appears further down the thread.
      kept.forEach((product) => addToCart(product));
      setGiftSelection(kept.map((product) => product.id));
      setShowCheckoutForm(true);
      return;
    }
    // Fully autonomous: known delivery details + an automatically found
    // earliest available date → place the REAL order, no form at all. The
    // pay tab opening automatically (in the hook) is confirmation enough —
    // skip the "Order placed" card so this doesn't double up on UI.
    await place(kept, deliveryProfile, { showCard: false });
  }

  function addToCartOnly() {
    kept.forEach((product) => addToCart(product));
    showToast(translate("Added to cart 🛒"));
  }

  if (showCheckoutForm)
    return (
      <CheckoutForm
        cityName={conv.city}
        dateISO={conv.date}
        dateLabel={conv.dateLabel}
        gift={conv.gift}
        onOrder={recordOrderSuccess}
        autobuy
      />
    );

  return (
    <div className="autobuy-confirm">
      <div className="autobuy-confirm-head">
        <span className="autobuy-confirm-badge">
          <Icon name="spark" size={16} />
        </span>
        <div className="autobuy-confirm-head-text">
          <span className="autobuy-confirm-title">
            {translate("Here's what I picked for you ✨")}
          </span>
        </div>
      </div>

      <div className="autobuy-confirm-items">
        {kept.map((product, index) => (
          <div className="autobuy-confirm-item" key={product.id + index}>
            <button
              type="button"
              className="autobuy-confirm-item-main"
              onClick={() => setSkuProduct(product)}
            >
              <ProductImage product={product} />
              <div className="autobuy-confirm-item-info">
                <span className="autobuy-confirm-item-name">
                  {product.name}
                </span>
                {product.brand && !isGenericCategory(product.brand) && (
                  <span className="autobuy-confirm-item-brand">
                    {product.brand}
                  </span>
                )}
                {typeof product.rating === "number" && (
                  <span className="autobuy-confirm-item-rating">
                    <Icon name="star" size={11} />
                    {product.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <span className="autobuy-confirm-item-price">
                {fmtPrice(product.price, product.currency)}
              </span>
            </button>
            {/* Always shown, even for the only item — dropping it just
                empties `kept` until an alternate is added back in (or this
                one is re-added isn't possible, but a similar alternate
                usually is), rather than locking the sole pick in place. */}
            <button
              type="button"
              className="autobuy-confirm-item-remove"
              aria-label={translate("Drop this item")}
              onClick={() => drop(product.id)}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="autobuy-confirm-budget">
        <div className="autobuy-confirm-budget-bar">
          <div
            className="autobuy-confirm-budget-fill"
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <div className="autobuy-confirm-budget-row">
          <span>
            {translate("Total {total}", { total: fmtPrice(total, currency) })}
          </span>
          <span>
            {remaining > 0
              ? translate("{remaining} left of {budget}", {
                  remaining: fmtPrice(remaining, currency),
                  budget: fmtPrice(budget, currency),
                })
              : translate("Right at your {budget} budget", {
                  budget: fmtPrice(budget, currency),
                })}
          </span>
        </div>
      </div>

      <div className="autobuy-confirm-alts">
        <span className="autobuy-confirm-alts-title">
          {translate("✨ You may also like")}
        </span>
        {suggestions.length > 0 ? (
          <div className="autobuy-confirm-alts-row">
            {suggestions.slice(0, 12).map((product) => {
              // Per-alternate, since each one may match a different kept
              // pick (or none) — a SWAP frees up the replaced pick's price
              // too, so it can afford more than the raw remaining budget
              // alone would suggest.
              const swapTarget = swapTargetFor(product);
              const budgetForAlternate = swapTarget
                ? remaining + swapTarget.price
                : remaining;
              return (
                <div className="autobuy-confirm-alt" key={product.id}>
                  <button
                    type="button"
                    className="autobuy-confirm-alt-main"
                    onClick={() => setSkuProduct(product)}
                  >
                    <ProductImage product={product} />
                    <span className="autobuy-confirm-alt-name">
                      {product.name}
                    </span>
                    <span className="autobuy-confirm-alt-price">
                      {fmtPrice(product.price, product.currency)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="autobuy-confirm-alt-add"
                    aria-label={
                      swapTarget
                        ? translate("Use this instead")
                        : translate("Add this item")
                    }
                    title={
                      swapTarget
                        ? translate("Use this instead")
                        : translate("Add this item")
                    }
                    onClick={() => pickAlternate(product)}
                    disabled={product.price > budgetForAlternate}
                  >
                    <Icon name={swapTarget ? "redo" : "plus"} size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="autobuy-confirm-alts-empty">
            {translate("No close matches left.")}
          </p>
        )}
      </div>

      <p className="autobuy-confirm-disclaimer">
        <Icon name="lock" size={12} />
        {canAutoCheckout
          ? translate(
              "Delivering to {recipient} in {city} — I'll place the real order now, no charge until you tap the pay link.",
              {
                recipient: deliveryProfile!.recipientName,
                city: deliveryProfile!.city,
              },
            )
          : translate(
              "I'll just need a delivery address — no charge until you tap the real pay link.",
            )}
      </p>

      {error && <div className="sl-warning">{error}</div>}

      <div className="autobuy-confirm-actions">
        <button
          className="btn-primary autobuy-confirm-go"
          onClick={confirm}
          disabled={!kept.length || placing}
        >
          {placing
            ? translate("Placing your order…")
            : kept.length === 1
              ? translate("✅ Order this for me")
              : translate("✅ Order these for me")}
        </button>
        <button
          className="btn-ghost autobuy-confirm-other"
          onClick={addToCartOnly}
          disabled={!kept.length || placing}
        >
          {translate("🛒 Add to cart")}
        </button>
      </div>
    </div>
  );
}
