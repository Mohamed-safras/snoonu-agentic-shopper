/** POST /api/compare-qa — answer follow-up questions about a set of compared
 *  products (a short conversation). Body: {ids, question, history, lang}.
 *  Grounded in the real product details; helpful general guidance otherwise. */
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
    ids?: string[];
    question?: string;
    lang?: Lang;
    history?: QaTurn[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ answer: "" }, { status: 400 });
  }
  const ids = (Array.isArray(body.ids) ? body.ids : [])
    .map((id) => String(id).trim())
    .filter(Boolean)
    .slice(0, 4);
  const question = (body.question || "").trim().slice(0, 300);
  // Answer in the language the shopper actually asked in (script wins), so a
  // Sinhala/Tamil question gets a native answer without switching the toggle.
  const lang = resolveReplyLang(question, body.lang || "en");
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string",
    )
    .slice(-6);
  if (ids.length < 2 || !question) return textResponse("");
  if (!activeProviderConfigured())
    return textResponse(
      "I can't answer that right now — please try again shortly.",
    );

  try {
    const details = await Promise.all(
      ids.map((id) => getProduct(id).catch(() => null)),
    );
    const products = details
      .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
      .map(toProductFromDetail);
    if (!products.length)
      return textResponse("I couldn't load those products.");

    const context = products
      .map(
        (product, index) =>
          `${index + 1}. ${product.name} — ${fmtPrice(product.price, product.currency)}` +
          (typeof product.rating === "number"
            ? `, rating ${product.rating}`
            : "") +
          (product.category ? `, ${product.category}` : "") +
          (product.blurb ? `\n   ${product.blurb.slice(0, 220)}` : ""),
      )
      .join("\n");

    // Model answers in English; replyResponse MT-translates to si/ta/ar.
    return replyResponse(
      {
        fast: true,
        system:
          "You are Trova, helping a shopper decide between the products below. Answer their follow-up helpfully and decisively, using the details PLUS your general product knowledge — compare them, suggest which fits their need, who each suits. " +
          "Don't invent a specific product's hard specs that aren't given; give general guidance there. " +
          "STAY ON SCOPE: only help with choosing between THESE products and the related buying decision (use, fit, value, care, pairing). " +
          "If the question is about a completely different TOPIC (general trivia, news, weather, coding, an unrelated product), do NOT answer it — in one short, friendly sentence say that's outside what you can help with here and steer back to deciding between these picks. (A question in another language is NOT off-topic.) " +
          `${replyLanguageDirective()}, in 1–3 warm, natural sentences.` +
          `\n\nProducts being compared:\n${context}`,
        messages: [...history, { role: "user", content: question }],
        temperature: 0.5,
      },
      lang,
    );
  } catch {
    return textResponse("Something went wrong — please try again.");
  }
}
