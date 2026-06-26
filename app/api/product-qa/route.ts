/** POST /api/product-qa — answer a shopper's question about ONE product, grounded
 *  in its real Snoonu detail (+ general product knowledge). Body: {productId,
 *  question, history, lang}. STREAMS the reply as plain text. */
import { getProduct } from "@/lib/mcp/tools";
import { toProductFromDetail } from "@/lib/mcp/adapters";
import {
  replyResponse,
  textResponse,
  replyLanguageDirective,
} from "@/lib/llm/respond";
import { activeProviderConfigured } from "@/lib/llm";
import { resolveReplyLang } from "@/lib/i18n/lang";
import { fmtPrice } from "@/lib/format/money";
import type { Lang } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

interface QaTurn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  let body: {
    productId?: string;
    question?: string;
    lang?: Lang;
    history?: QaTurn[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ answer: "" }, { status: 400 });
  }
  const productId = (body.productId || "").trim();
  const question = (body.question || "").trim().slice(0, 300);
  // Reply in the language the shopper actually ASKED in (Sinhala/Tamil script
  // wins), falling back to the UI toggle — so they get a native answer even
  // without switching the language.
  const lang = resolveReplyLang(question, body.lang || "en");
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string",
    )
    .slice(-6); // keep the last few turns for context
  if (!productId || !question) return textResponse("");
  if (!activeProviderConfigured())
    return textResponse(
      "I can't answer that right now — please try again shortly.",
    );

  try {
    const raw = await getProduct(productId);
    if (!raw)
      return textResponse("I couldn't load that product's details just now.");
    const product = toProductFromDetail(raw);
    const specs = (product.variants ?? [])
      .flatMap((variant) =>
        variant.attributes ? Object.entries(variant.attributes) : [],
      )
      .map(([key, value]) => `${key}: ${value}`)
      .slice(0, 12)
      .join("; ");

    const detail = [
      `Name: ${product.name}`,
      product.brand ? `Brand/category: ${product.brand}` : "",
      `Price: ${fmtPrice(product.price, product.currency)}`,
      typeof product.rating === "number" ? `Rating: ${product.rating}` : "",
      product.inStock === false ? "Stock: out of stock" : "Stock: in stock",
      product.blurb ? `Description: ${product.blurb}` : "",
      specs ? `Specs: ${specs}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // The model answers in English; replyResponse machine-translates to
    // si/ta/ar so the LLM isn't burdened with those scripts.
    return replyResponse(
      {
        fast: true,
        system:
          "You are Trova, a knowledgeable Snoonu shopping assistant having a short conversation about ONE product. Answer helpfully and confidently using the product details below PLUS your general knowledge of this kind of product (typical use, who it suits, travel/gift/daily-use fit, care, pairing). " +
          "Give a genuinely useful, decisive answer — do NOT just say 'I can't tell from the listing'. " +
          "The ONE thing to avoid: don't state this specific product's hard specs/claims as fact when they aren't in the details (exact battery size, warranty length, certifications) — for those give general guidance for this product type instead. " +
          "STAY ON SCOPE: only help with THIS product and the related buying decision (its use, fit, value, care, pairing, who it suits). " +
          "If the question is about a completely different TOPIC (general trivia, news, weather, coding, an unrelated product), do NOT answer it — in one short, friendly sentence say that's outside what you can help with here and steer back to this product. (A question in another language is NOT off-topic.) " +
          `${replyLanguageDirective()}, in 1–3 warm, natural sentences.` +
          `\n\nProduct detail:\n${detail}`,
        messages: [...history, { role: "user", content: question }],
        temperature: 0.5,
      },
      lang,
    );
  } catch {
    return textResponse(
      "Something went wrong answering that — please try again.",
    );
  }
}
