/**
 * POST /api/chat — the conversational agent endpoint. Accepts the chat history +
 * client state and streams NDJSON AgentEvents (text deltas, tool activity, UI
 * directives, chips). Node runtime for the MCP SDK + streaming.
 */
import { createAgentStream } from "@/lib/agents/stream";
import { activeProviderConfigured } from "@/lib/llm";
import { resolveReplyLang } from "@/lib/i18n/lang";
import type { AgentContext } from "@/lib/agents/core/context";
import type { ChatRequest, Conversation } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const EMPTY_CONV: Conversation = {
  city: null,
  date: null,
  dateLabel: null,
  sameDay: false,
  gift: null,
  occasion: null,
  lastOrder: null,
  budget: null,
  autobuyRequest: null,
  autobuyKept: null,
};

function lastUserText(messages: ChatRequest["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!activeProviderConfigured()) {
    // Stream a single graceful message so the UI still renders cleanly.
    const msg =
      "I'm not fully wired up yet — add a free LLM_API_KEY to and I'll come alive! 🌸";
    const ndjson =
      JSON.stringify({ text: "text", delta: msg }) +
      "\n" +
      JSON.stringify({ text: "done" }) +
      "\n";
    return new Response(ndjson, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  const userText = lastUserText(body.messages ?? []);
  const ctx: AgentContext = {
    // Reply in the language the shopper actually wrote in (Sinhala/Tamil script
    // wins) — falling back to the UI toggle. Real-time: they can switch language
    // mid-chat just by typing in it.
    lang: resolveReplyLang(userText, body.lang ?? "en"),
    messages: Array.isArray(body.messages) ? body.messages : [],
    userText,
    cart: Array.isArray(body.cart) ? body.cart : [],
    conv: body.conv ?? EMPTY_CONV,
    images: Array.isArray(body.images) ? body.images.filter(Boolean) : [],
    ageConfirmed: body.ageConfirmed === true,
  };

  return new Response(createAgentStream(ctx), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
