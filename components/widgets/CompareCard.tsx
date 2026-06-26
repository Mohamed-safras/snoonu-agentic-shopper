"use client";
import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { AskChat } from "@/components/widgets/AskChat";
import { fmtPrice } from "@/lib/format/money";
import { COMPARE_PRIORITIES } from "@/lib/compare/priorities";
import {
  enqueueSpeech,
  stopSpeaking,
  warmUpSpeech,
  isSpeechSessionActive,
} from "@/lib/speech/speak";
import { useTrova } from "@/store";
import type { Product, ProductComparison } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

type CriteriaRow = ProductComparison["criteria"][number];

/** Basic criteria from product fields, used until/if the LLM comparison loads.
 *  Price is intentionally omitted — it's already shown in each column header. */
function fallbackCriteria(products: Product[]): CriteriaRow[] {
  return [
    {
      label: "Category",
      values: products.map(
        (product) => product.category || product.brand || "—",
      ),
    },
    {
      label: "Availability",
      values: products.map((product) =>
        product.inStock === false ? "Out of stock" : "In stock",
      ),
    },
  ];
}

/** Price is shown in the header already, so drop any price/cost criterion the
 *  LLM returns (it sometimes crams all prices into one cell → single column). */
function withoutPriceRow(criteria: CriteriaRow[]): CriteriaRow[] {
  return criteria.filter((row) => !/\b(price|cost)\b/i.test(row.label));
}

/** True when every cell in the row is the same — those rows don't help the
 *  decision, so we mute them. */
function rowIsIdentical(values: string[]): boolean {
  const first = (values[0] ?? "").trim().toLowerCase();
  return values.every((value) => (value ?? "").trim().toLowerCase() === first);
}

/** Up to 5 stars reflecting a 0–5 rating (rounded), with the number alongside. */
function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <span className="cmp-stars" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Icon
          key={index}
          name="star"
          size={11}
          className={index < filled ? "on" : ""}
        />
      ))}
      <b>{rating.toFixed(1)}</b>
    </span>
  );
}

/**
 * Compare & decide — a side-by-side of 2–4 products with LLM-written criteria
 * (a per-row winner), per-product verdicts (best-for / strength / watch-out), a
 * recommendation and a best-value pick (grounded in real detail). "What matters
 * most?" lenses re-bias the pick. Falls back to a basic table if the LLM is
 * unavailable, and caches its result so a reload renders it without recomputing.
 */
export function CompareCard({
  messageId,
  products,
  savedDetail,
  savedComparison,
}: {
  /** Thread card id — when set, the computed result is cached on the directive
   *  so a reload renders it. Omitted for the ephemeral in-drawer compare. */
  messageId?: string;
  products: Product[];
  savedDetail?: Product[];
  savedComparison?: ProductComparison | null;
}) {
  const addProduct = useTrova((store) => store.addProduct);
  const setSkuProduct = useTrova((store) => store.setSkuProduct);
  const saveCompareResult = useTrova((store) => store.saveCompareResult);
  const lang = useTrova((store) => store.lang);
  const translate = useTranslate();
  // A card whose comparison was already computed carries it on the directive, so
  // a reload renders the SAVED result — no re-fetch, no loader, no re-speaking.
  const hasSaved = savedComparison !== undefined;
  const [detail, setDetail] = useState<Product[]>(savedDetail ?? products);
  const [comparison, setComparison] = useState<ProductComparison | null>(
    savedComparison ?? null,
  );
  // Decision lens. Selecting one re-runs the comparison biased to it.
  const [priority, setPriority] = useState("");
  // When the picks aren't really comparable we warn instead of crowning a winner;
  // the shopper can still force a head-to-head with "Compare anyway".
  const [forceCompare, setForceCompare] = useState(false);

  const currentIds = products.map((product) => product.id).join(",");
  // Key the loaded result by ids + lens + language, so changing the lens OR the
  // UI language re-runs the comparison (re-rendered in the new language). A saved
  // card starts already "loaded" for the current language + balanced lens.
  const currentKey = currentIds + "|" + priority + "|" + lang;
  const [loadedKey, setLoadedKey] = useState(
    hasSaved ? currentIds + "||" + lang : "",
  );
  const loading = loadedKey !== currentKey;
  const showFullLoader = loading && !comparison; // nothing to show yet
  const refining = loading && Boolean(comparison); // refreshing an existing table

  useEffect(() => {
    const ids = products.map((product) => product.id).join(",");
    const key = ids + "|" + priority + "|" + lang;
    // Already have this exact result (saved card on mount, or unchanged) → skip.
    if (key === loadedKey) return;
    let cancelled = false;
    if (useTrova.getState().speak) {
      stopSpeaking(); // clear any prior queued speech before this comparison
      warmUpSpeech(); // warm TTS during the compare call
    }
    const url =
      "/api/compare?ids=" +
      encodeURIComponent(ids) +
      (priority ? "&priority=" + encodeURIComponent(priority) : "") +
      (lang !== "en" ? "&lang=" + encodeURIComponent(lang) : "");
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        let resolved = products;
        if (Array.isArray(data.products) && data.products.length >= 2) {
          setDetail(data.products);
          resolved = data.products;
        }
        if (data.comparison) {
          setComparison(data.comparison);
          // Cache only the BASE (balanced) result on the thread card so a reload
          // renders it instead of recomputing. Lens refinements stay ephemeral.
          if (messageId && !priority)
            saveCompareResult(messageId, resolved, data.comparison);
          // Read the recommendation aloud once — only for a card driven by a real
          // gesture this session, never one restored on a page reload.
          const { speak, lang: spokenLang } = useTrova.getState();
          const recommended = resolved[data.comparison.recommendationIndex];
          if (
            speak &&
            isSpeechSessionActive() &&
            data.comparison.reason &&
            recommended &&
            data.comparison.comparable !== false // don't crown unrelated picks aloud
          ) {
            const bestFor =
              data.comparison.verdicts?.[data.comparison.recommendationIndex]
                ?.bestFor;
            enqueueSpeech(
              `I'd go with the ${recommended.name}. ${data.comparison.reason}` +
                (bestFor ? ` Best for ${bestFor}.` : ""),
              spokenLang,
            );
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, priority, lang]);

  function pickPriority(id: string) {
    if (loading || id === priority) return;
    setPriority(id);
  }

  // While the FIRST comparison is being computed, show a single calm loader —
  // the real panel appears only once, fully formed.
  if (showFullLoader) {
    return (
      <div className="cmp cmp-loading">
        <div className="cmp-loading-thumbs">
          {products.map((product) => (
            <span className="cmp-loading-thumb" key={product.id}>
              <ProductImage product={product} />
            </span>
          ))}
        </div>
        <div className="cmp-loading-text">
          <span className="llm-dot">
            <i />
            <i />
            <i />
          </span>
          <span className="cmp-loading-line">
            {translate(
              "Comparing {n} picks and finding the best one for you…",
              {
                n: products.length,
              },
            )}
          </span>
        </div>
      </div>
    );
  }

  const columns = detail.length;
  const verdicts = comparison?.verdicts;
  // Verdict-driven strength / watch-out rows lead the table (most decision-useful),
  // followed by the LLM criteria (or the basic fallback).
  const verdictRows: CriteriaRow[] = verdicts
    ? [
        { label: "Strength", values: verdicts.map((v) => v.pro || "—") },
        { label: "Watch-out", values: verdicts.map((v) => v.con || "—") },
      ]
    : [];
  const rows: CriteriaRow[] = [
    ...verdictRows,
    ...(comparison
      ? withoutPriceRow(comparison.criteria)
      : fallbackCriteria(detail)),
  ];
  // Different kinds of products → warn, and hold the winner back until the
  // shopper forces a head-to-head.
  const notComparable = comparison?.comparable === false;
  const recIndex = comparison?.recommendationIndex ?? -1;
  const recProduct = recIndex >= 0 ? detail[recIndex] : undefined;
  const showRecommendation = Boolean(
    recProduct && comparison?.reason && (!notComparable || forceCompare),
  );
  const isRec = (index: number) =>
    index === recIndex && (!notComparable || forceCompare);
  const isValue = (index: number) =>
    comparison != null &&
    index === comparison.bestValueIndex &&
    !isRec(index) &&
    (!notComparable || forceCompare);

  return (
    <div className="cmp">
      {notComparable && !forceCompare && (
        <div className="cmp-notice">
          <span className="cmp-notice-icon">
            <Icon name="compare" size={15} />
          </span>
          <div className="cmp-notice-body">
            <div className="cmp-notice-text">
              {comparison?.context ||
                translate(
                  "These are quite different products — there's no clear head-to-head winner.",
                )}
            </div>
            <button
              className="cmp-notice-btn"
              onClick={() => setForceCompare(true)}
            >
              {translate("Compare anyway")}
            </button>
          </div>
        </div>
      )}
      {showRecommendation && recProduct && comparison?.reason && (
        <div className="cmp-rec">
          <span className="cmp-rec-tag">
            <Icon name="spark" size={13} />{" "}
            {translate(notComparable ? "Closest pick" : "Our pick")}
          </span>
          <button
            className="cmp-rec-thumb"
            onClick={() => setSkuProduct(recProduct)}
            aria-label={`Open ${recProduct.name}`}
          >
            <ProductImage product={recProduct} />
          </button>
          <div className="cmp-rec-body">
            <div className="cmp-rec-name">{recProduct.name}</div>
            <div className="cmp-rec-reason">{comparison.reason}</div>
            <div className="cmp-rec-foot">
              <span className="cmp-rec-price">
                {fmtPrice(recProduct.price, recProduct.currency)}
              </span>
              <button
                className="cmp-rec-add"
                onClick={() => addProduct(recProduct)}
              >
                <Icon name="cart" size={13} /> {translate("Add this one")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={"cmp-grid" + (refining ? " refining" : "")}
        style={
          {
            gridTemplateColumns: `104px repeat(${columns}, minmax(148px, 1fr))`,
          } as CSSProperties
        }
      >
        <div className="cmp-corner">
          <Icon name="compare" size={16} />
          <span>{translate("{n} picks", { n: columns })}</span>
        </div>
        {detail.map((product, index) => (
          <div
            className={"cmp-head" + (isRec(index) ? " rec" : "")}
            key={product.id}
          >
            {/* Always-present badge row keeps every column's image aligned. */}
            <div className="cmp-badge-row">
              {isRec(index) && (
                <span className="cmp-badge pick">
                  ★ {translate("Top pick")}
                </span>
              )}
              {isValue(index) && (
                <span className="cmp-badge value">
                  {translate("Best value")}
                </span>
              )}
            </div>
            <button
              className="cmp-thumb"
              onClick={() => setSkuProduct(product)}
              aria-label={translate("Open {name}", { name: product.name })}
            >
              <ProductImage product={product} />
            </button>
            <div className="cmp-name" title={product.name}>
              {product.name}
            </div>
            <div className="cmp-stars-row">
              {typeof product.rating === "number" ? (
                <StarRating rating={product.rating} />
              ) : (
                <span className="cmp-stars muted">
                  {translate("Not rated")}
                </span>
              )}
            </div>
            <div className="cmp-price">
              {fmtPrice(product.price, product.currency)}
            </div>
            <button className="cmp-add" onClick={() => addProduct(product)}>
              <Icon name="cart" size={13} /> {translate("Add")}
            </button>
            {verdicts && (
              <span
                className="cmp-bestfor"
                title={translate("Best for {what}", {
                  what: verdicts[index].bestFor,
                })}
              >
                {translate("Best for {what}", {
                  what: verdicts[index].bestFor || "—",
                })}
              </span>
            )}
          </div>
        ))}

        {rows.map((row, rowIndex) => {
          const identical = rowIsIdentical(row.values);
          return (
            <Fragment key={row.label + ":" + rowIndex}>
              <div className={"cmp-label" + (rowIndex % 2 ? " alt" : "")}>
                {translate(row.label)}
              </div>
              {detail.map((product, index) => {
                const isWinner = row.winnerIndex === index;
                return (
                  <div
                    className={
                      "cmp-val" +
                      (rowIndex % 2 ? " alt" : "") +
                      (isRec(index) ? " rec" : "") +
                      (isWinner ? " win" : "") +
                      (identical ? " same" : "")
                    }
                    key={product.id}
                  >
                    {isWinner && <Icon name="check" size={12} />}
                    {translate(row.values[index] ?? "—")}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>

      {/* Still deciding? Re-bias the pick by what matters, then ask follow-ups. */}
      <div className="cmp-ask">
        <div className="cmp-ask-label">
          <Icon name="spark" size={13} /> {translate("Still deciding? Ask me")}
        </div>

        {/* Decision lenses — re-bias the recommendation to what matters most. */}
        {comparison && (
          <div className="cmp-lenses">
            <span className="cmp-lenses-label">
              {translate("What matters most?")}
              {refining && (
                <span className="llm-dot sm">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </span>
            <div className="cmp-priority-chips">
              {COMPARE_PRIORITIES.map((option) => (
                <button
                  key={option.id || "balanced"}
                  className={
                    "cmp-priority-chip" + (priority === option.id ? " on" : "")
                  }
                  onClick={() => pickPriority(option.id)}
                  disabled={loading}
                >
                  {translate(option.label)}
                </button>
              ))}
            </div>
          </div>
        )}

        <AskChat
          endpoint="/api/compare-qa"
          buildBody={(question, history) => ({
            ids: detail.map((product) => product.id),
            question,
            history,
            lang,
          })}
          placeholder={translate("Ask about these picks…")}
          starters={[
            translate("Which is best value?"),
            translate("Which lasts longer?"),
            translate("Which would you gift?"),
          ]}
        />
      </div>
    </div>
  );
}
