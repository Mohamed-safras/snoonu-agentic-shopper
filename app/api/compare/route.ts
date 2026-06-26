/** GET /api/compare?ids=a,b,c[&priority=…] — fetch full detail for 2–4 products
 *  and (when an LLM is configured) return a side-by-side comparison: criteria
 *  rows with a per-row winner, per-product verdicts (best-for / strength /
 *  watch-out), a recommendation and a best-value pick — grounded ONLY in the
 *  real product detail. An optional `priority` biases the recommendation. */
import { getProduct } from "@/lib/mcp/tools";
import { toProductFromDetail } from "@/lib/mcp/adapters";
import { getProvider } from "@/lib/llm";
import { activeProviderConfigured } from "@/lib/llm";
import { fmtPrice } from "@/lib/format/money";
import { comparePriorityGuidance } from "@/lib/compare/priorities";
import {
  machineTranslate,
  machineTranslationConfigured,
} from "@/lib/i18n/machine-translation";
import type { Lang, Product, ProductComparison } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Generate the comparison in ENGLISH (reliable JSON); ar/si/ta are produced by
 *  machine-translating the display fields afterwards (see localizeComparison). */
async function compareWithLlm(
  products: Product[],
  priority: string,
): Promise<ProductComparison | null> {
  if (!activeProviderConfigured()) return null;
  const list = products
    .map(
      (product, index) =>
        `${index}: ${product.name} — ${fmtPrice(product.price, product.currency)}` +
        (typeof product.rating === "number"
          ? `, rating ${product.rating}`
          : "") +
        (product.category ? `, category ${product.category}` : "") +
        (product.blurb ? `\n   about: ${product.blurb.slice(0, 240)}` : ""),
    )
    .join("\n");
  const guidance = comparePriorityGuidance(priority);
  try {
    const response = await getProvider().generate({
      fast: true,
      system:
        "You compare shopping options for Snoonu and help the shopper decide. Use ONLY the given details — never invent specs or prices. " +
        'Return ONLY JSON of this exact shape: {"comparable":true,"context":"","criteria":[{"label":"Quality","values":["…","…"],"winnerIndex":0}],"verdicts":[{"bestFor":"…","pro":"…","con":"…"}],"recommendationIndex":0,"reason":"one short sentence","bestValueIndex":1}. ' +
        "Rules: " +
        "(1) `comparable` is true only if these are the SAME kind of product (a genuine head-to-head). If they are different kinds (e.g. a phone vs chocolates), set it false and put a one-line `context` explaining how you're comparing them instead (e.g. 'These are quite different — comparing them as gift options.'). When comparable is true, leave `context` empty. " +
        "(2) Pick 3–5 decision-useful criteria (e.g. Quality, Stand-out, Materials, Who it suits) — do NOT include Price (shown separately). " +
        "(3) Each criterion's `values` array MUST match the products' count and order (one short value per product), and `winnerIndex` is the product that wins THAT row (0-based), or -1 if it's a tie / not applicable. " +
        "(4) `verdicts` MUST have one entry per product in order: `bestFor` (2–4 words, e.g. 'Everyday use'), `pro` (its single biggest strength, ≤6 words), `con` (its main watch-out, ≤6 words). " +
        "(5) `recommendationIndex` is your overall pick and `bestValueIndex` is the best bang-for-buck. " +
        "Write all text in English. " +
        guidance,
      messages: [
        {
          role: "user",
          content: `Products:\n${list}\n\nCompare and recommend.`,
        },
      ],
      json: true,
      temperature: 0.3,
      maxTokens: 700,
    });
    const parsed = JSON.parse(
      response.text.slice(
        response.text.indexOf("{"),
        response.text.lastIndexOf("}") + 1,
      ),
    );

    const clampIndex = (value: unknown) =>
      Math.min(products.length - 1, Math.max(0, Number(value) || 0));
    const clampWinner = (value: unknown) => {
      const index = Number(value);
      return Number.isInteger(index) && index >= 0 && index < products.length
        ? index
        : -1;
    };

    const criteria = Array.isArray(parsed?.criteria)
      ? parsed.criteria
          .filter(
            (row: unknown) =>
              row &&
              typeof (row as { label?: unknown }).label === "string" &&
              Array.isArray((row as { values?: unknown }).values),
          )
          .map(
            (row: {
              label: string;
              values: unknown[];
              winnerIndex?: unknown;
            }) => ({
              label: String(row.label),
              values: products.map((_, index) =>
                String(row.values[index] ?? "—"),
              ),
              winnerIndex: clampWinner(row.winnerIndex),
            }),
          )
      : [];
    if (!criteria.length) return null;

    const verdicts = Array.isArray(parsed?.verdicts)
      ? products.map((_, index) => {
          const entry = parsed.verdicts[index] ?? {};
          return {
            bestFor: String(entry.bestFor ?? "").slice(0, 40),
            pro: String(entry.pro ?? "").slice(0, 60),
            con: String(entry.con ?? "").slice(0, 60),
          };
        })
      : undefined;

    return {
      criteria,
      recommendationIndex: clampIndex(parsed?.recommendationIndex),
      reason: typeof parsed?.reason === "string" ? parsed.reason : "",
      bestValueIndex: clampIndex(parsed?.bestValueIndex),
      verdicts,
      comparable: parsed?.comparable !== false, // default to comparable
      context:
        typeof parsed?.context === "string"
          ? parsed.context.slice(0, 140)
          : "",
    };
  } catch {
    return null;
  }
}

/** Machine-translate the human-readable fields of a comparison into ar/si/ta
 *  (English stays as generated). Keeps JSON keys + product names untouched. */
async function localizeComparison(
  comparison: ProductComparison,
  lang: Lang,
): Promise<ProductComparison> {
  if (
    (lang !== "ar" && lang !== "si" && lang !== "ta") ||
    !machineTranslationConfigured()
  )
    return comparison;

  // Flatten every display string in a fixed order, translate in one batch,
  // then re-assemble in the same order.
  const texts: string[] = [comparison.context ?? "", comparison.reason];
  comparison.criteria.forEach((row) => {
    texts.push(row.label, ...row.values);
  });
  (comparison.verdicts ?? []).forEach((verdict) => {
    texts.push(verdict.bestFor, verdict.pro, verdict.con);
  });

  let translated: string[];
  try {
    translated = await machineTranslate(texts, lang);
  } catch {
    return comparison; // keep English on failure
  }

  let cursor = 0;
  const next = () => translated[cursor++] ?? "";
  const context = next();
  const reason = next();
  const criteria = comparison.criteria.map((row) => ({
    ...row,
    label: next(),
    values: row.values.map(() => next()),
  }));
  const verdicts = comparison.verdicts?.map(() => ({
    bestFor: next(),
    pro: next(),
    con: next(),
  }));
  return { ...comparison, context, reason, criteria, verdicts };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ids = (params.get("ids") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 4);
  const priority = (params.get("priority") || "").trim();
  const lang = (params.get("lang") || "en") as Lang;
  if (ids.length < 2) return Response.json({ products: [], comparison: null });

  try {
    const details = await Promise.all(
      ids.map((id) => getProduct(id).catch(() => null)),
    );
    const products = details
      .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
      .map(toProductFromDetail);
    if (products.length < 2)
      return Response.json({ products, comparison: null });
    const english = await compareWithLlm(products, priority);
    const comparison = english
      ? await localizeComparison(english, lang)
      : null;
    return Response.json({ products, comparison });
  } catch {
    return Response.json({ products: [], comparison: null });
  }
}
