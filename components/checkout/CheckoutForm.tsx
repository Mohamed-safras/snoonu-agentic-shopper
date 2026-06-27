"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MapTabs } from "@/components/map/MapTabs";
import { ProductImage } from "@/components/product/ProductImage";
import { DatePicker } from "./DatePicker";
import { useCitySearch } from "@/hooks/useCitySearch";
import { useAddressMap } from "@/hooks/useAddressMap";
import { useGiftNote } from "@/hooks/useGiftNote";
import { useHala } from "@/store";
import { submitOrder } from "@/lib/checkout/submitOrder";
import { findEarliestDate } from "@/lib/checkout/findEarliestDate";
import { fmtPrice } from "@/lib/format/money";
import type { Order } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";
import { isValidPhone } from "@/lib/checkout/validate";

export interface CheckoutFormProps {
  cityName: string | null;
  dateISO: string | null;
  dateLabel: string | null;
  gift: string | null;
  onOrder: (order: Order) => void;
  /** Opened from autobuy's "no saved delivery profile yet" hand-off —
   *  placing the order auto-opens the real pay link instead of just
   *  returning to chat, matching autobuy's hands-off, known-profile path. */
  autobuy?: boolean;
}

/**
 * Self-contained guest checkout: resolves the delivery city (live MCP), picks a
 * date (live feasibility), captures recipient + address + a map confirm-pin, and
 * creates a REAL Snoonu order — all in ONE form (no separate delivery step).
 * City search, address/map handling, and the AI gift-note writer each live in
 * their own hook (hooks/useCitySearch, useAddressMap, useGiftNote) so this
 * component stays focused on the checkout activity itself.
 */
export function CheckoutForm({
  cityName,
  dateISO,
  dateLabel,
  gift,
  onOrder,
  autobuy,
}: CheckoutFormProps) {
  // Read the cart live from the store so items added (from anywhere) while the
  // checkout card is open show up in "Choose items" immediately.
  const cart = useHala((store) => store.cart);
  const setQty = useHala((store) => store.setQty);
  const setSkuProduct = useHala((store) => store.setSkuProduct);
  const lang = useHala((store) => store.lang);
  const translate = useTranslate();
  const occasion = useHala((store) => store.conv.occasion);
  // Saved from the last successful order — pre-fills recipient/address/etc.
  // below so a repeat checkout (and autobuy's hand-off into this form) never
  // has to ask for the same details twice.
  const savedProfile = useHala.getState().deliveryProfile;
  // Stage 1: pick which cart items to order. Stage 2: delivery + payment form.
  const [stage, setStage] = useState<"select" | "form">("select");
  // Track only DEselected ids — anything not here (incl. newly added items)
  // is selected by default. A "send as gift" of a specific set (giftSelectionIds)
  // opens with ONLY those items ticked — everything else starts deselected.
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(() => {
    const selection = useHala.getState().giftSelectionIds;
    if (selection && selection.length) {
      const keep = new Set(selection);
      return new Set(
        useHala
          .getState()
          .cart.filter((item) => !keep.has(item.id))
          .map((item) => item.id),
      );
    }
    return new Set();
  });

  // Consume the one-shot gift selection so a later direct checkout defaults to
  // "all selected" again.
  useEffect(() => {
    if (useHala.getState().giftSelectionIds)
      useHala.getState().setGiftSelection(null);
  }, []);

  // Who the order is for — a gift to someone else, or the shopper themselves.
  // Drives which fields show (sender/gift-note only make sense for a gift).
  const [orderFor, setOrderFor] = useState<"gift" | "self">("gift");

  const {
    city,
    setCity,
    citySearch,
    setCitySearch,
    cityResults,
    setCityResults,
    cityLoading,
  } = useCitySearch(cityName || savedProfile?.city || "");

  const [date, setDate] = useState<string | null>(dateISO);
  const [dateText, setDateText] = useState<string | null>(dateLabel);

  // Pre-fill recipient/phone/sender/location-type/instructions from the
  // delivery profile saved after the shopper's last successful order (autobuy
  // and repeat checkouts both benefit — never asked twice once known).
  const [recipientName, setRecipientName] = useState(
    () => savedProfile?.recipientName || "",
  );
  const [phone, setPhone] = useState(() => savedProfile?.phone || "");
  const [senderName, setSenderName] = useState(
    () => savedProfile?.senderName || useHala.getState().checkoutName || "",
  );
  const [locationType, setLocationType] = useState<
    "house" | "apartment" | "office" | "other"
  >(() => savedProfile?.locationType || "house");
  // The house/apartment/office NUMBER, kept separate from the broader
  // street/area "Delivery address" field below — a dedicated slot for it is
  // clearer than asking the shopper to remember to fold it into one long
  // free-text address. Composed back into a single string at submit time
  // (Snoonu's API and the saved profile both just take one address line).
  const [unitNumber, setUnitNumber] = useState("");
  const [instructions, setInstructions] = useState(
    () => savedProfile?.instructions || "",
  );
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Snapshot of what was actually ordered, once placement succeeds. The form
  // reads `cart` LIVE, and a successful order removes those items from the
  // cart (so they don't linger forever) — without this snapshot, the form
  // would immediately re-render to "0 items selected, Rs 0" right under the
  // shopper, looking like it broke instead of like it succeeded. Showing this
  // snapshot — with a one-tap "order these again" — is the success state.
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const {
    address,
    setAddress,
    pin,
    mapAddress,
    showMap,
    setShowMap,
    locating,
    locateError,
    addrResults,
    setAddrResults,
    pickAddress,
    // Aliased — calling the original name inside a nested function (the
    // autobuy auto-geolocation effect below) trips eslint's hook-naming
    // heuristic (`use*`), even though this is a plain callback, not a hook.
    useMyLocation: locateMe,
    handlePinPick,
  } = useAddressMap({ city, setCity });

  // The address hook owns its own state, so seed it from the saved profile
  // once on mount rather than via a constructor arg (keeps the hook generic).
  useEffect(() => {
    if (savedProfile?.address && !address) setAddress(savedProfile.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydration
  }, []);

  // Autobuy's hand-off has no human expected to fill this in manually — try
  // geolocation automatically instead of waiting for a "use my location" tap.
  // Only when there's no address to seed from already (a saved profile);
  // it won't override an already-known city (useAddressMap's
  // fillAddressFromPin only sets the city when none is set yet), so this is
  // safe to fire even when the agent already resolved a city this turn.
  // Falls back to the existing manual address field untouched if permission
  // is denied or unavailable.
  useEffect(() => {
    if (autobuy && !savedProfile?.address) locateMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, autobuy hand-off only
  }, []);

  const { giftMsg, setGiftMsg, notesLoading, writeNote } = useGiftNote(
    gift || "",
    lang,
    occasion,
  );

  const isSelected = (id: string) => !deselectedIds.has(id);
  const selectedCart = cart.filter((item) => isSelected(item.id));
  const currency = cart[0]?.currency || "LKR";
  const sub = selectedCart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );
  const firstItemId = selectedCart[0]?.id;

  // Autobuy's hand-off skips the DatePicker tap too — once a city is known
  // (typed, geolocated, or already resolved this turn) resolve the earliest
  // available date automatically, the same way the known-profile autonomous
  // path already does. Manual checkout is unaffected — the shopper picks a
  // date themselves via the grid below, same as always.
  const [resolvingDate, setResolvingDate] = useState(false);
  useEffect(() => {
    if (!autobuy || !city || date || !firstItemId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- immediate "resolving…" feedback before the async lookup settles
    setResolvingDate(true);
    findEarliestDate(city, firstItemId).then((earliest) => {
      if (!alive) return;
      if (earliest) {
        setDate(earliest.iso);
        setDateText(earliest.label);
      }
      setResolvingDate(false);
    });
    return () => {
      alive = false;
    };
  }, [autobuy, city, date, firstItemId]);

  function toggleItem(id: string) {
    setDeselectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isGift = orderFor === "gift";
  // The unit-number field's label/placeholder follows whatever address type
  // is selected, instead of one generic "No." that doesn't say what kind.
  const unitLabel =
    locationType === "apartment"
      ? translate("Apartment / unit no.")
      : locationType === "office"
        ? translate("Office / suite no.")
        : locationType === "house"
          ? translate("House no.")
          : translate("Unit / house no.");
  // Per-field validity (drives inline errors + the submit gate).
  const phoneValid = isValidPhone(phone);
  const nameValid = recipientName.trim().length >= 2;
  const addressValid = address.trim().length >= 5;
  const senderValid = !isGift || senderName.trim().length >= 2;
  const ready =
    selectedCart.length > 0 &&
    Boolean(city) &&
    Boolean(date) &&
    nameValid &&
    phoneValid &&
    addressValid &&
    senderValid;

  // Either source (checkout submission, or the address/map hook's geolocation
  // failure) shows in the same single error slot near the submit button.
  const displayedError = err || locateError;

  // Unit number + street/area as one line — the only place these two fields
  // get combined, so both submitOrder and the saved profile always see a
  // single, complete address.
  const fullAddress = [unitNumber.trim(), address.trim()]
    .filter(Boolean)
    .join(", ");

  async function place() {
    if (!ready || busy) return;
    setBusy(true);
    setErr("");
    const result = await submitOrder({
      cart: selectedCart,
      recipientName,
      recipientPhone: phone,
      address: fullAddress,
      city,
      date,
      dateLabel: dateText,
      locationType,
      instructions,
      pin,
      senderName,
      anonymous,
      giftMessage: isGift ? giftMsg : "",
      forSelf: !isGift,
    });
    if (!result.order) {
      setErr(translate(result.error));
    } else {
      useHala.getState().setCheckoutName(senderName.trim());
      // Remember these details so the next checkout (manual or autobuy's
      // hand-off into this form) is pre-filled instead of asked again.
      useHala.getState().setDeliveryProfile({
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        address: fullAddress,
        city,
        locationType,
        instructions: instructions.trim(),
        senderName: senderName.trim(),
      });
      // Autobuy's hand-off into this form is still meant to be hands-off —
      // jump straight to the real pay page instead of leaving the shopper to
      // find and tap a link (or scan its QR, which only makes sense for the
      // manual flow). `autoOpened` tells the order-placed card to skip that
      // panel; manual checkout is untouched since `autobuy` is never set there.
      const opened = Boolean(
        autobuy &&
        result.order.payUrl &&
        window.open(result.order.payUrl, "_blank", "noopener,noreferrer"),
      );
      const placed = opened
        ? { ...result.order, autoOpened: true }
        : result.order;
      setPlacedOrder(placed);
      onOrder(placed);
    }
    setBusy(false);
  }

  /** Re-add a just-placed order's items to the cart so the shopper can
   *  reorder the same thing without retyping the form — everything else
   *  (delivery profile, dates) is already remembered. */
  function orderAgain() {
    if (!placedOrder) return;
    placedOrder.items.forEach((item) => useHala.getState().addProduct(item));
    setPlacedOrder(null);
  }

  // Autobuy's hand-off only ever needs name + phone typed by hand (geolocation
  // and the earliest date are filled automatically above) — once those plus
  // everything else are valid, place the order immediately instead of also
  // requiring an explicit tap. Fires once per "becomes ready" transition, not
  // on every keystroke, and never retries automatically after a failure —
  // the shopper sees the error and can retry manually after fixing it.
  const autoPlacedRef = useRef(false);
  useEffect(() => {
    if (!autobuy) return;
    if (ready && !busy && !autoPlacedRef.current) {
      autoPlacedRef.current = true;
      place();
    }
    if (!ready) autoPlacedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `place` is intentionally excluded (recreated every render; the ref guards re-firing)
  }, [autobuy, ready, busy]);

  if (placedOrder)
    return (
      <div className="panel">
        <div className="panel-h">
          <span className="pi">
            <Icon name="check" size={17} />
          </span>
          <div style={{ flex: 1 }}>
            <h4>{translate("You're all set 🎁")}</h4>
            <div className="sub">
              {translate("Ref")} <b>{placedOrder.id}</b>
            </div>
          </div>
        </div>
        <div className="checkout-form">
          <div className="cf-picked" style={{ cursor: "default" }}>
            <span className="cf-picked-thumbs">
              {placedOrder.items.slice(0, 4).map((item, index) => (
                <ProductImage key={item.id + "-" + index} product={item} />
              ))}
            </span>
            <span className="cf-picked-txt">
              <b>{translate("{n} items", { n: placedOrder.items.length })}</b> ·{" "}
              {fmtPrice(placedOrder.total, placedOrder.currency)}
            </span>
          </div>
          <div className="sub">
            {translate(
              placedOrder.autoOpened
                ? "Pay page opened in a new tab — see the order-placed card below if you need the link again."
                : "See the pay link in the order-placed card below to finish paying.",
            )}
          </div>
          <button
            className="btn-ghost"
            style={{ justifyContent: "center", width: "100%" }}
            onClick={orderAgain}
          >
            {translate("🔁 Order these again")}
          </button>
        </div>
      </div>
    );

  return (
    <div className="panel">
      <div className="panel-h">
        <span className="pi">
          <Icon name={stage === "select" ? "cart" : "lock"} size={17} />
        </span>
        <div style={{ flex: 1 }}>
          <h4>
            {translate(
              stage === "select" ? "Choose items" : "Delivery & checkout",
            )}
          </h4>
          <div className="sub">
            {translate(
              stage === "select"
                ? "Pick what to send in this order"
                : "Guest checkout · no account needed",
            )}
          </div>
        </div>
      </div>

      {/* ── Stage 1: choose which cart items to order ── */}
      {stage === "select" && (
        <div className="checkout-form">
          <div className="cf-pick-list">
            {cart.map((item, index) => {
              const on = isSelected(item.id);
              return (
                <label
                  key={item.id + "-" + index}
                  className={"cf-pick" + (on ? " on" : "")}
                >
                  <input
                    type="checkbox"
                    className="cf-pick-check"
                    checked={on}
                    onChange={() => toggleItem(item.id)}
                  />
                  {/* Tap the thumbnail to double-check the item in the drawer
                      — preventDefault stops the label toggling the checkbox. */}
                  <button
                    type="button"
                    className="cf-pick-thumb"
                    title={translate("View details")}
                    aria-label={translate("View {name}", { name: item.name })}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSkuProduct(item);
                    }}
                  >
                    <ProductImage product={item} />
                    <span className="cf-pick-zoom" aria-hidden>
                      <Icon name="search" size={12} />
                    </span>
                  </button>
                  <span className="cf-pick-body">
                    <span className="cf-pick-n">{item.name}</span>
                    <span className="cf-pick-meta">
                      <b>{item.quantity}</b>
                      <span className="cf-x">×</span>
                      {fmtPrice(item.price, currency)}
                      <span className="cf-x">=</span>
                      <b>{fmtPrice(item.price * item.quantity, currency)}</b>
                    </span>
                  </span>
                  {/* Quantity stepper — preventDefault stops the label toggling. */}
                  <span className="cf-qty" onClick={(e) => e.preventDefault()}>
                    <button
                      type="button"
                      aria-label={translate("Decrease quantity")}
                      disabled={item.quantity <= 1}
                      onClick={() => setQty(item.id, -1)}
                    >
                      <Icon name="minus" size={13} />
                    </button>
                    <span className="cf-qty-n">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={translate("Increase quantity")}
                      onClick={() => setQty(item.id, 1)}
                    >
                      <Icon name="plus" size={13} />
                    </button>
                  </span>
                  <span className="cf-pick-tick" aria-hidden>
                    <Icon name="check" size={13} />
                  </span>
                </label>
              );
            })}
          </div>
          <div className="totrow grand" style={{ marginTop: 4 }}>
            <span>
              {translate("Selected ({n} of {total})", {
                n: selectedCart.length,
                total: cart.length,
              })}
            </span>
            <span>{fmtPrice(sub, currency)}</span>
          </div>
          <button
            className="btn-primary"
            style={{
              justifyContent: "center",
              width: "100%",
              opacity: selectedCart.length ? 1 : 0.6,
            }}
            disabled={!selectedCart.length}
            onClick={() => setStage("form")}
          >
            {translate("Continue to delivery →")}
          </button>
          {!selectedCart.length && (
            <div className="sub" style={{ textAlign: "center" }}>
              {translate("Select at least one item")}
            </div>
          )}
        </div>
      )}

      {/* ── Stage 2: delivery + payment ── */}
      {stage === "form" && (
        <div className="checkout-form">
          {/* Selected-items summary with an edit affordance */}
          <button className="cf-picked" onClick={() => setStage("select")}>
            <span className="cf-picked-thumbs">
              {selectedCart.slice(0, 4).map((item, index) => (
                <ProductImage key={item.id + "-" + index} product={item} />
              ))}
            </span>
            <span className="cf-picked-txt">
              <b>{translate("{n} items", { n: selectedCart.length })}</b> ·{" "}
              {fmtPrice(sub, currency)}
            </span>
            <span className="cf-picked-edit">{translate("Edit")}</span>
          </button>

          {/* ── Who is this order for? ── */}
          <div className="cf-for">
            <button
              type="button"
              className={"cf-for-opt" + (isGift ? " on" : "")}
              onClick={() => setOrderFor("gift")}
            >
              🎁 {translate("Send as a gift")}
            </button>
            <button
              type="button"
              className={"cf-for-opt" + (!isGift ? " on" : "")}
              onClick={() => setOrderFor("self")}
            >
              🛍️ {translate("For myself")}
            </button>
          </div>

          {/* From you (gift only — printed on the card) ── */}
          {isGift && (
            <>
              <div className="cf-section">{translate("From Whom")}</div>
              <div className="cf-field">
                <label>{translate("Your name (on the gift card)")}</label>
                <input
                  className={
                    "addr-input" +
                    (senderName && !senderValid ? " invalid" : "")
                  }
                  autoComplete="name"
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  placeholder={translate("From…")}
                />
                {senderName.trim() !== "" && !senderValid && (
                  <span className="cf-err">
                    {translate("Enter your name for the card")}
                  </span>
                )}
                <label className="cf-check">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(event) => setAnonymous(event.target.checked)}
                  />
                  {translate(
                    "Keep me anonymous (hide my name from the recipient)",
                  )}
                </label>
              </div>
            </>
          )}

          {/* ── 2) Recipient / your own details ── */}
          <div className="cf-section">
            {translate(isGift ? "Recipient" : "Your details")}
          </div>
          <div className="cf-row">
            <div className="cf-field">
              <label>
                {translate(isGift ? "Recipient name" : "Your name")}
              </label>
              <input
                className={
                  "addr-input" + (recipientName && !nameValid ? " invalid" : "")
                }
                autoComplete={isGift ? undefined : "name"}
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                placeholder={translate(
                  isGift ? "Who receives it" : "Your full name",
                )}
              />
              {recipientName.trim() !== "" && !nameValid && (
                <span className="cf-err">
                  {translate("Enter the full name")}
                </span>
              )}
            </div>
            <div className="cf-field">
              <label>
                {translate(isGift ? "Recipient phone" : "Your phone")}
              </label>
              <input
                className={
                  "addr-input" + (phone && !phoneValid ? " invalid" : "")
                }
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                // Allow only phone characters (digits, +, space, hyphen) — this
                // is what stopped letters like "04t35345" reaching Snoonu.
                onChange={(event) =>
                  setPhone(event.target.value.replace(/[^\d+\s-]/g, ""))
                }
                placeholder="33123456"
              />
              {phone.trim() !== "" && !phoneValid && (
                <span className="cf-err">
                  {translate(
                    "Enter a valid Qatari number — e.g. 33123456 or +97433123456",
                  )}
                </span>
              )}
            </div>
          </div>

          {/* ── 3) Where── */}
          <div className="cf-section">
            {translate("Where & When to Deliver")}
          </div>

          <button
            type="button"
            className="cf-locate"
            onClick={locateMe}
            disabled={locating}
          >
            <Icon name="pin" size={15} />
            {translate(locating ? "Locating you…" : "Use my current location")}
          </button>

          <div className="cf-deliver">
            <div className="cf-field">
              <label>{translate("Address type")}</label>
              <select
                className="cf-select"
                value={locationType}
                onChange={(event) =>
                  setLocationType(
                    event.target.value as
                      | "house"
                      | "apartment"
                      | "office"
                      | "other",
                  )
                }
              >
                <option value="house">{translate("House")}</option>
                <option value="apartment">{translate("Apartment")}</option>
                <option value="office">{translate("Office")}</option>
                <option value="other">{translate("Other")}</option>
              </select>
            </div>

            <div className="cf-field">
              <label>{unitLabel}</label>
              <input
                className="addr-input"
                autoComplete="off"
                value={unitNumber}
                onChange={(event) => setUnitNumber(event.target.value)}
                placeholder={translate("e.g. 12B, 4th Floor")}
              />
            </div>
          </div>

          <div className="cf-addr-city">
            <div className="cf-field cf-addr-field">
              <label>{translate("Delivery address")}</label>
              <input
                className={
                  "addr-input" + (address && !addressValid ? " invalid" : "")
                }
                autoComplete="off"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                onBlur={() => setTimeout(() => setAddrResults([]), 180)}
                placeholder={translate("Street, area, landmark")}
              />
              {addrResults.length > 0 && (
                <div className="cf-addr-suggest">
                  {addrResults.map((result, index) => (
                    <button
                      type="button"
                      key={index}
                      className="cf-addr-opt"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickAddress(result)}
                    >
                      <Icon name="pin" size={13} />
                      <span>{result.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {address.trim() !== "" && !addressValid && (
                <span className="cf-err">
                  {translate("Add a bit more detail to the address")}
                </span>
              )}
            </div>
            <div className="cf-field cf-city-field">
              <label>{translate("Deliver to (city)")}</label>
              {city ? (
                <div className="cf-city-chosen">
                  <Icon name="pin" size={15} />
                  <b>{city}</b>
                  <button
                    className="cf-city-change"
                    onClick={() => {
                      setCity("");
                      setDate(null);
                      setDateText(null);
                    }}
                  >
                    {translate("Change")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="cf-city-input-row">
                    <input
                      className="addr-input"
                      value={citySearch}
                      onChange={(event) => setCitySearch(event.target.value)}
                      placeholder={translate(
                        "Type a city or local name — e.g. Doha, Al Rayyan…",
                      )}
                    />
                    {cityLoading && (
                      <span className="llm-dot cf-city-loading">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                  {cityResults.length > 0 && (
                    // Absolutely positioned (like .cf-addr-suggest) so showing
                    // results doesn't grow this field's box taller than the
                    // address field beside it — both stay the same height
                    // whether or not a dropdown is open.
                    <div className="cf-addr-suggest cf-city-suggest">
                      {cityResults.map((city) => (
                        <button
                          type="button"
                          key={city.key}
                          className="cf-addr-opt"
                          onClick={() => {
                            setCity(city.name);
                            setCitySearch("");
                            setCityResults([]);
                          }}
                        >
                          <Icon name="pin" size={13} />
                          <span>{city.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!cityLoading &&
                    citySearch.trim().length >= 2 &&
                    cityResults.length === 0 && (
                      <span className="cf-err">
                        {translate(
                          "No cities found — try a different spelling",
                        )}
                      </span>
                    )}
                </>
              )}
            </div>
          </div>

          {/* Map: visible once there's a city OR a confirmed pin (so "use my
              location" / a tap opens it even before a city is resolved). */}
          {(city || pin) && (
            <div className="cf-field">
              <button
                type="button"
                className="cf-disclose"
                onClick={() => setShowMap((value) => !value)}
              >
                <Icon name="pin" size={14} />
                {translate(
                  pin
                    ? "Exact location pinned ✓"
                    : "Pin exact location — tap the map or drag the pin",
                )}
                <span className={"cf-disclose-chev" + (showMap ? " open" : "")}>
                  <Icon name="chevron" size={14} />
                </span>
              </button>
              {showMap && (
                <>
                  <MapTabs
                    destName={city}
                    address={mapAddress}
                    pinned={pin}
                    onPick={handlePinPick}
                  />
                  {pin && (
                    <div className="sub" style={{ marginTop: 4, fontSize: 12 }}>
                      📍{" "}
                      {translate(
                        "Location confirmed. the exact spot will be shared with the courier.",
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {city && (
            <div className="cf-field">
              <label>{translate("Delivery date")}</label>
              {autobuy && resolvingDate && !date ? (
                <div className="sub">
                  {translate("Finding the earliest delivery date…")}
                </div>
              ) : (
                <DatePicker
                  cityName={city}
                  selected={date}
                  onPick={(iso, label) => {
                    setDate(iso);
                    setDateText(label);
                  }}
                />
              )}
            </div>
          )}

          <div className="cf-field">
            <label>{translate("Delivery instructions (optional)")}</label>
            <input
              className="addr-input"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder={translate(
                "Gate code, nearest landmark, who to call…",
              )}
            />
          </div>

          {isGift && (
            <div className="cf-field">
              <div className="cf-giftnote-label">
                <label>{translate("Gift message (optional)")}</label>
                <button
                  type="button"
                  className="cf-giftnote-ai"
                  onClick={writeNote}
                  disabled={notesLoading}
                >
                  <Icon name="spark" size={13} />
                  {notesLoading
                    ? translate("Writing…")
                    : giftMsg.trim()
                      ? translate("Rewrite")
                      : translate("Write it for me")}
                </button>
              </div>
              <textarea
                className="addr-input cf-giftnote-input"
                rows={3}
                maxLength={300}
                value={giftMsg}
                onChange={(event) => setGiftMsg(event.target.value)}
                placeholder={translate("A heartfelt note for the card…")}
              />
              <span
                className={
                  "cf-giftnote-count" + (giftMsg.length >= 270 ? " warn" : "")
                }
              >
                {giftMsg.length}/300
              </span>
            </div>
          )}

          {displayedError && <div className="sl-warning">{displayedError}</div>}

          <div className="totrow grand" style={{ marginTop: 4 }}>
            <span>{translate("Items subtotal")}</span>
            <span>{fmtPrice(sub, currency)}</span>
          </div>

          <button
            className="btn-primary"
            style={{
              justifyContent: "center",
              width: "100%",
              opacity: ready ? 1 : 0.6,
            }}
            disabled={!ready || busy}
            onClick={place}
          >
            {busy
              ? translate("Creating your order…")
              : translate(
                  autobuy
                    ? "Place order & pay →"
                    : "Place order & get pay link →",
                )}
          </button>
          {!ready && (
            <div className="sub" style={{ textAlign: "center", fontSize: 12 }}>
              {!city
                ? translate("Pick a delivery city")
                : !date
                  ? translate("Pick a delivery date")
                  : !nameValid
                    ? translate(
                        isGift
                          ? "Enter the recipient's name"
                          : "Enter your name",
                      )
                    : !phoneValid
                      ? translate("Enter a valid phone number")
                      : !addressValid
                        ? translate("Enter the delivery address")
                        : !senderValid
                          ? translate("Enter your name for the gift card")
                          : translate("Fill the details above")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
