"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { fmtPrice } from "@/lib/format/money";
import { enqueueSpeech, stopSpeaking, warmUpSpeech } from "@/lib/speech/speak";
import { useHala } from "@/store";
import type { Hamper, HamperSlot } from "@/lib/agents/bundles/hamper";
import type { Product } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

// Recipient presets (bias the picks). A gift-UX choice, not catalog data — the
// actual products always come live from MCP.
const RECIPIENTS = ["", "Her", "Him", "Kids", "Parents", "A couple"];

/** A short, natural spoken summary of a built hamper, for read-aloud. */
function describeHamper(hamper: Hamper, occasion?: string | null): string {
  const forOccasion = occasion && occasion !== "null" ? ` for ${occasion}` : "";
  const labels = hamper.slots.map((slot) => slot.label).join(", ");
  return `Here's a ${hamper.slots.length}-item gift hamper${forOccasion}, including ${labels}. The total comes to ${fmtPrice(hamper.total, hamper.currency)}.`;
}

/** The index of a slot's chosen `selected` product within its alternatives, so
 *  the initial pick shows the (budget-optimised) selected item, not just the
 *  most-relevant one. */
function selectedPicks(slots: HamperSlot[]): number[] {
  return slots.map((slot) => {
    const index = slot.alternatives.findIndex(
      (product) => product.id === slot.selected.id,
    );
    return index >= 0 ? index : 0;
  });
}

/**
 * Gift Hamper Builder: the shopper sets a budget (+ optional category, theme,
 * recipient and item count), the agent assembles complementary REAL Snoonu
 * products that fit, and they can swap or lock any slot, fine-tune the budget,
 * then add it to the cart or send the whole hamper as a gift.
 */
export function HamperBuilder() {
  const occasion = useHala((store) => store.conv.occasion);
  const addProduct = useHala((store) => store.addProduct);
  const showToast = useHala((store) => store.showToast);
  const startGiftCheckout = useHala((store) => store.startGiftCheckout);
  const setSkuProduct = useHala((store) => store.setSkuProduct);
  const speak = useHala((store) => store.speak);
  const language = useHala((store) => store.lang);
  const translate = useTranslate();

  const [budgetInput, setBudgetInput] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [themeInput, setThemeInput] = useState("");
  const [recipient, setRecipient] = useState("");
  const [hamper, setHamper] = useState<Hamper | null>(null);
  const [loading, setLoading] = useState(false);
  // Per-slot chosen index into that slot's alternatives, and per-slot lock.
  const [picks, setPicks] = useState<number[]>([]);
  const [locked, setLocked] = useState<boolean[]>([]);
  // Live "fine-tune" budget for instant client re-fit (no re-search).
  const [fitBudget, setFitBudget] = useState(0);

  const budget = Number(budgetInput.replace(/[^\d]/g, ""));
  const validBudget = budget >= 500;

  // Real Snoonu categories for the dropdown (snoonu_list_categories via API).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.categories))
          setCategoryOptions(data.categories);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function build() {
    if (!validBudget || loading) return;
    setLoading(true);
    if (speak) {
      stopSpeaking(); // drop any prior queued speech before a fresh build
      warmUpSpeech(); // warm TTS while the hamper is assembled
    }
    // Capture currently-locked picks so a Rebuild keeps them.
    const keptSlots: Record<number, HamperSlot> = {};
    if (hamper) {
      locked.forEach((isLocked, index) => {
        const slot = hamper.slots[index];
        if (!isLocked || !slot) return;
        const product = slot.alternatives[picks[index]] ?? slot.selected;
        // A locked slot is pinned: its only alternative is itself (no swapping).
        keptSlots[index] = {
          ...slot,
          selected: product,
          alternatives: [product],
        };
      });
    }
    setHamper(null);
    try {
      const query = new URLSearchParams({
        budget: String(budget),
        nonce: String(Date.now()),
      });
      if (occasion) query.set("occasion", occasion);
      if (category) query.set("category", category);
      const theme = themeInput.trim();
      if (theme) query.set("name", theme);
      if (recipient) query.set("recipient", recipient);

      const result = (await fetch("/api/hamper?" + query.toString()).then(
        (response) => response.json(),
      )) as Hamper;

      // Merge: keep locked slots at their positions, take new picks elsewhere.
      const lockedIndexes = Object.keys(keptSlots).map(Number);
      const length = Math.max(
        result.slots?.length ?? 0,
        ...lockedIndexes.map((index) => index + 1),
        0,
      );
      const mergedSlots: HamperSlot[] = [];
      for (let index = 0; index < length; index++) {
        const slot = keptSlots[index] ?? result.slots?.[index];
        if (slot) mergedSlots.push(slot);
      }

      const built = mergedSlots.length
        ? { ...result, slots: mergedSlots }
        : null;
      setHamper(built);
      setPicks(built ? selectedPicks(built.slots) : []);
      setLocked(
        built ? built.slots.map((_, index) => Boolean(keptSlots[index])) : [],
      );
      setFitBudget(budget);

      if (built) {
        if (speak) enqueueSpeech(describeHamper(built, occasion), language);
      } else {
        showToast(
          category
            ? translate(
                "No hamper found in {category} for that budget — try a higher budget or fewer filters.",
                { category },
              )
            : translate("Couldn't build a hamper — try a higher budget."),
        );
      }
    } catch {
      setHamper(null);
      showToast(translate("Hamper build failed — please try again."));
    }
    setLoading(false);
  }

  function chosen(slotIndex: number): Product | null {
    const slot = hamper?.slots[slotIndex];
    if (!slot) return null;
    return slot.alternatives[picks[slotIndex]] ?? slot.selected;
  }

  function swap(slotIndex: number) {
    if (locked[slotIndex]) return;
    const slot = hamper?.slots[slotIndex];
    if (!slot || slot.alternatives.length < 2) return;
    setPicks((current) =>
      current.map((pick, index) =>
        index === slotIndex ? (pick + 1) % slot.alternatives.length : pick,
      ),
    );
  }

  function toggleLock(slotIndex: number) {
    setLocked((current) =>
      current.map((value, index) => (index === slotIndex ? !value : value)),
    );
  }

  const items = hamper ? hamper.slots.map((_, index) => chosen(index)) : [];
  const currency = hamper?.currency || "QAR";
  const total = items.reduce((sum, product) => sum + (product?.price ?? 0), 0);
  const overBudget = fitBudget ? total > fitBudget : false;

  // Bounds for the fine-tune slider, from the cheapest/priciest alternatives the
  // unlocked slots already hold (locked slots stay fixed). No re-search needed.
  const fitRange = useMemo(() => {
    if (!hamper) return { min: 0, max: 0 };
    let min = 0;
    let max = 0;
    hamper.slots.forEach((slot, index) => {
      if (locked[index]) {
        const price = chosen(index)?.price ?? slot.selected.price;
        min += price;
        max += price;
        return;
      }
      const prices = slot.alternatives.map((product) => product.price);
      min += prices.length ? Math.min(...prices) : slot.selected.price;
      max += prices.length ? Math.max(...prices) : slot.selected.price;
    });
    return { min: Math.floor(min), max: Math.ceil(max) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hamper, locked, picks]);

  /** Re-pick each unlocked slot from its alternatives to fit `target`, spending
   *  it well (most-relevant within a fair share). Locked slots stay put. */
  function refit(target: number) {
    if (!hamper) return;
    const next = [...picks];
    const unlocked = hamper.slots
      .map((_, index) => index)
      .filter((index) => !locked[index]);
    let remaining = target;
    hamper.slots.forEach((slot, index) => {
      if (locked[index])
        remaining -=
          slot.alternatives[picks[index]]?.price ?? slot.selected.price;
    });
    remaining = Math.max(0, remaining);
    unlocked.forEach((index, position) => {
      const alternatives = hamper.slots[index].alternatives;
      const slotsLeft = unlocked.length - position;
      const share = remaining / slotsLeft;
      let pick = alternatives.findIndex((product) => product.price <= share);
      if (pick < 0)
        pick = alternatives.findIndex((product) => product.price <= remaining);
      if (pick < 0)
        pick = alternatives.reduce(
          (cheapest, product, position2) =>
            product.price < alternatives[cheapest].price ? position2 : cheapest,
          0,
        );
      next[index] = pick;
      remaining = Math.max(0, remaining - alternatives[pick].price);
    });
    setPicks(next);
  }

  function addAll() {
    items.forEach((product) => product && addProduct(product));
    showToast(translate("Added {n}-item hamper 🎁", { n: items.length }));
  }

  function sendAsGift() {
    // Add the hamper to the cart, then open checkout with ONLY the hamper items
    // pre-selected (other cart items stay, just unticked — the shopper can add
    // them back). A direct cart checkout still defaults to everything selected.
    const ids: string[] = [];
    items.forEach((product) => {
      if (product) {
        addProduct(product);
        ids.push(product.id);
      }
    });
    startGiftCheckout(ids);
  }

  return (
    <div className="hamper">
      <div className="hamper-h">
        <span className="hamper-h-icon">
          <Icon name="gift" size={18} />
        </span>
        <div className="hamper-h-text">
          <span className="hamper-h-lbl">{translate("Gift hamper")}</span>
          <h4>{translate("Build a hamper that fits your budget")}</h4>
        </div>
      </div>

      {/* Inputs, paired per row: Budget + Keyword, then Category + For. */}
      <div className="hamper-fields">
        <label className="hamper-field">
          <span>{translate("Budget (Rs)")}</span>
          <input
            className="hamper-input"
            inputMode="numeric"
            value={budgetInput}
            onChange={(event) => setBudgetInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") build();
            }}
            placeholder={translate("e.g. 5000")}
          />
        </label>
        <label className="hamper-field">
          <span>{translate("Keyword (optional)")}</span>
          <input
            className="hamper-input"
            value={themeInput}
            onChange={(event) => setThemeInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") build();
            }}
            placeholder={translate("e.g. tea lover, pastel")}
          />
        </label>
        <label className="hamper-field">
          <span>{translate("Category")}</span>
          <select
            className="hamper-select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{translate("Any category")}</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="hamper-field">
          <span>{translate("For")}</span>
          <select
            className="hamper-select"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          >
            {RECIPIENTS.map((option) => (
              <option key={option} value={option}>
                {option ? translate(option) : translate("Anyone")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        className="hamper-build"
        onClick={build}
        disabled={!validBudget || loading}
      >
        {loading ? (
          <span className="llm-dot">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <>
            <Icon name="spark" size={15} />{" "}
            {translate(hamper ? "Rebuild hamper" : "Build hamper")}
          </>
        )}
      </button>

      {hamper && (
        <>
          {/* Fine-tune the budget and instantly re-fit from fetched options. */}
          {fitRange.max > fitRange.min && (
            <div className="hamper-fit">
              <div className="hamper-fit-label">
                <span>{translate("Fine-tune budget")}</span>
                <b>{fmtPrice(fitBudget, currency)}</b>
              </div>
              <input
                className="hamper-fit-slider"
                type="range"
                min={fitRange.min}
                max={fitRange.max}
                step={50}
                value={Math.min(
                  Math.max(fitBudget, fitRange.min),
                  fitRange.max,
                )}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setFitBudget(value);
                  refit(value);
                }}
              />
            </div>
          )}

          <div className="hamper-slots">
            {hamper.slots.map((slot, slotIndex) => {
              const product = chosen(slotIndex);
              if (!product) return null;
              const isLocked = locked[slotIndex];
              return (
                <div
                  className={"hamper-slot" + (isLocked ? " locked" : "")}
                  key={slotIndex}
                  style={{ "--slot-index": slotIndex } as CSSProperties}
                  onClick={() => setSkuProduct(product)}
                  title={translate("View details")}
                >
                  <span className="hamper-slot-no">{slotIndex + 1}</span>
                  <ProductImage product={product} />
                  <div className="hamper-slot-body">
                    <div className="hamper-slot-label">{slot.label}</div>
                    <div className="hamper-slot-name">{product.name}</div>
                    <div className="hamper-slot-price">
                      {fmtPrice(product.price, currency)}
                    </div>
                  </div>
                  <div className="hamper-slot-actions">
                    <button
                      className={"hamper-lock" + (isLocked ? " on" : "")}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleLock(slotIndex);
                      }}
                      title={translate(
                        isLocked ? "Unlock (allow changes)" : "Lock this pick",
                      )}
                      aria-label={translate(
                        isLocked ? "Unlock slot" : "Lock slot",
                      )}
                      aria-pressed={isLocked}
                    >
                      <Icon name="lock" size={13} />
                    </button>
                    {!isLocked && slot.alternatives.length > 1 && (
                      <button
                        className="hamper-swap"
                        onClick={(event) => {
                          event.stopPropagation();
                          swap(slotIndex);
                        }}
                        title={translate("Swap for another")}
                        aria-label={translate("Swap for another")}
                      >
                        <Icon name="arrow" size={14} /> {translate("Swap")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hamper-foot">
            <div className="hamper-bar" aria-hidden>
              <div
                className={"hamper-bar-fill" + (overBudget ? " over" : "")}
                style={{
                  width: `${Math.min(100, fitBudget ? (total / fitBudget) * 100 : 0)}%`,
                }}
              />
            </div>
            <div className={"hamper-total" + (overBudget ? " over" : "")}>
              <span>
                {translate("{n} items", { n: items.length })} ·{" "}
                {overBudget
                  ? translate("{amount} over", {
                      amount: fmtPrice(total - fitBudget, currency),
                    })
                  : translate("{amount} left of {budget}", {
                      amount: fmtPrice(
                        Math.max(0, fitBudget - total),
                        currency,
                      ),
                      budget: fmtPrice(fitBudget, currency),
                    })}
              </span>
              <b>{fmtPrice(total, currency)}</b>
            </div>
            <div className="hamper-cta-row">
              <button className="hamper-add ghost" onClick={addAll}>
                <Icon name="cart" size={16} /> {translate("Add to cart")}
              </button>
              <button className="hamper-add" onClick={sendAsGift}>
                <Icon name="gift" size={16} /> {translate("Send as gift")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
