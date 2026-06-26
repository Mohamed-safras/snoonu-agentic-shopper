"use client";
import { useMemo, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { fmtPrice } from "@/lib/format/money";
import { enqueueSpeech, stopSpeaking, warmUpSpeech } from "@/lib/speech/speak";
import { useTrova } from "@/store";
import type { Bundle, BundleSlot } from "@/lib/agents/bundles/bundle";
import type { Product } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

/** A short, natural spoken summary of a built kit, for read-aloud. */
function describeKit(kit: Bundle, goal: string): string {
  const labels = kit.slots.map((slot) => slot.label).join(", ");
  return `Here's a ${kit.slots.length}-item kit for ${goal}, including ${labels}. The total comes to ${fmtPrice(kit.total, kit.currency)}.`;
}

// A few example goals to spark ideas (UX prompts, not catalog data).
const GOAL_EXAMPLES = [
  "power-cut ready",
  "study setup",
  "new-baby essentials",
  "monsoon kit",
  "home office desk",
];

/** Index of each slot's chosen `selected` within its alternatives, so the pick
 *  shows the (budget-optimised) selected item, not just the most-relevant one. */
function selectedPicks(slots: BundleSlot[]): number[] {
  return slots.map((slot) => {
    const index = slot.alternatives.findIndex(
      (product) => product.id === slot.selected.id,
    );
    return index >= 0 ? index : 0;
  });
}

/**
 * Smart Kit ("shop by goal"): the shopper describes a need + budget, the agent
 * assembles a complete set of real Snoonu products that solves it. Swap/lock
 * any item, fine-tune the budget, then add the kit to the cart or buy it.
 */
export function KitBuilder() {
  const addProduct = useTrova((store) => store.addProduct);
  const showToast = useTrova((store) => store.showToast);
  const startGiftCheckout = useTrova((store) => store.startGiftCheckout);
  const setSkuProduct = useTrova((store) => store.setSkuProduct);
  const speak = useTrova((store) => store.speak);
  const language = useTrova((store) => store.lang);
  const translate = useTranslate();

  const [goalInput, setGoalInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [kit, setKit] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<number[]>([]);
  const [locked, setLocked] = useState<boolean[]>([]);
  const [fitBudget, setFitBudget] = useState(0);

  const budget = Number(budgetInput.replace(/[^\d]/g, ""));
  const validBudget = budget >= 500;
  const goal = goalInput.trim();
  const canBuild = validBudget && goal.length >= 3;

  async function build() {
    if (!canBuild || loading) return;
    setLoading(true);
    if (speak) {
      stopSpeaking(); // drop any prior queued speech before a fresh build
      warmUpSpeech(); // warm TTS while the kit is assembled
    }
    const keptSlots: Record<number, BundleSlot> = {};
    if (kit) {
      locked.forEach((isLocked, index) => {
        const slot = kit.slots[index];
        if (!isLocked || !slot) return;
        const product = slot.alternatives[picks[index]] ?? slot.selected;
        keptSlots[index] = {
          ...slot,
          selected: product,
          alternatives: [product],
        };
      });
    }
    setKit(null);
    try {
      const query = new URLSearchParams({
        goal,
        budget: String(budget),
        nonce: String(Date.now()),
      });
      const result = (await fetch("/api/kit?" + query.toString()).then(
        (response) => response.json(),
      )) as Bundle;

      const lockedIndexes = Object.keys(keptSlots).map(Number);
      const length = Math.max(
        result.slots?.length ?? 0,
        ...lockedIndexes.map((index) => index + 1),
        0,
      );
      const mergedSlots: BundleSlot[] = [];
      for (let index = 0; index < length; index++) {
        const slot = keptSlots[index] ?? result.slots?.[index];
        if (slot) mergedSlots.push(slot);
      }

      const built = mergedSlots.length
        ? { ...result, slots: mergedSlots }
        : null;
      setKit(built);
      setPicks(built ? selectedPicks(built.slots) : []);
      setLocked(
        built ? built.slots.map((_, index) => Boolean(keptSlots[index])) : [],
      );
      setFitBudget(budget);
      if (built) {
        if (speak) enqueueSpeech(describeKit(built, goal), language);
      } else {
        showToast(
          translate("Couldn't build a kit for that — try a higher budget."),
        );
      }
    } catch {
      setKit(null);
      showToast(translate("Kit build failed — please try again."));
    }
    setLoading(false);
  }

  function chosen(slotIndex: number): Product | null {
    const slot = kit?.slots[slotIndex];
    if (!slot) return null;
    return slot.alternatives[picks[slotIndex]] ?? slot.selected;
  }

  function swap(slotIndex: number) {
    if (locked[slotIndex]) return;
    const slot = kit?.slots[slotIndex];
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

  const items = kit ? kit.slots.map((_, index) => chosen(index)) : [];
  const currency = kit?.currency || "LKR";
  const total = items.reduce((sum, product) => sum + (product?.price ?? 0), 0);
  const overBudget = fitBudget ? total > fitBudget : false;

  const fitRange = useMemo(() => {
    if (!kit) return { min: 0, max: 0 };
    let min = 0;
    let max = 0;
    kit.slots.forEach((slot, index) => {
      if (locked[index]) {
        const price =
          slot.alternatives[picks[index]]?.price ?? slot.selected.price;
        min += price;
        max += price;
        return;
      }
      const prices = slot.alternatives.map((product) => product.price);
      min += prices.length ? Math.min(...prices) : slot.selected.price;
      max += prices.length ? Math.max(...prices) : slot.selected.price;
    });
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [kit, locked, picks]);

  function refit(target: number) {
    if (!kit) return;
    const next = [...picks];
    const unlocked = kit.slots
      .map((_, index) => index)
      .filter((index) => !locked[index]);
    let remaining = target;
    kit.slots.forEach((slot, index) => {
      if (locked[index])
        remaining -=
          slot.alternatives[picks[index]]?.price ?? slot.selected.price;
    });
    remaining = Math.max(0, remaining);
    unlocked.forEach((index, position) => {
      const alternatives = kit.slots[index].alternatives;
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
    showToast(translate("Added {n}-item kit 🧰", { n: items.length }));
  }

  function buyThese() {
    const ids: string[] = [];
    items.forEach((product) => {
      if (product) {
        addProduct(product);
        ids.push(product.id);
      }
    });
    startGiftCheckout(ids); // checkout with only the kit items pre-selected
  }

  return (
    <div className="hamper">
      <div className="hamper-h">
        <span className="hamper-h-icon">
          <Icon name="spark" size={18} />
        </span>
        <div className="hamper-h-text">
          <span className="hamper-h-lbl">{translate("Smart kit")}</span>
          <h4>{translate("Tell me the goal — I'll assemble it")}</h4>
        </div>
      </div>

      <div className="hamper-fields">
        <label className="hamper-field hamper-field-full">
          <span>{translate("What do you need?")}</span>
          <input
            className="hamper-input"
            value={goalInput}
            onChange={(event) => setGoalInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") build();
            }}
            placeholder={translate(
              "e.g. power-cut ready, study setup, new-baby essentials",
            )}
          />
        </label>
        <label className="hamper-field hamper-field-full">
          <span>{translate("Budget (Rs)")}</span>
          <input
            className="hamper-input"
            inputMode="numeric"
            value={budgetInput}
            onChange={(event) => setBudgetInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") build();
            }}
            placeholder={translate("e.g. 30000")}
          />
        </label>
      </div>

      {!kit && (
        <div className="kit-examples">
          {GOAL_EXAMPLES.map((example) => (
            <button
              key={example}
              className="kit-example"
              onClick={() => setGoalInput(example)}
            >
              {translate(example)}
            </button>
          ))}
        </div>
      )}

      <button
        className="hamper-build"
        onClick={build}
        disabled={!canBuild || loading}
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
            {translate(kit ? "Rebuild kit" : "Build kit")}
          </>
        )}
      </button>

      {kit && (
        <>
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
            {kit.slots.map((slot, slotIndex) => {
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
              <button className="hamper-add" onClick={buyThese}>
                <Icon name="arrow" size={16} /> {translate("Buy these")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
