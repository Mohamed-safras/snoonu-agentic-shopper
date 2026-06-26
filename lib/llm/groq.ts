/**
 * Groq provider (OpenAI-compatible REST) — fast Llama models, free tier.
 * Text + tool calling + vision. Model tiers (fast / base) from config.groq.
 */
import "server-only";
import { config } from "@/configs/env";
import type {
  GenerateOptions,
  LlmMessage,
  LlmProvider,
  LlmResponse,
  LlmToolCall,
} from "./types";

type OpenAiContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: OpenAiContent | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
}

/** Pick the model tier: vision → translation → fast → base. */
function pickModel(generateOptions: GenerateOptions): string {
  if (generateOptions.images?.length) return config.groq.visionModel;
  if (generateOptions.translate) return config.groq.translateModel;
  if (generateOptions.fast) return config.groq.fastModel;
  return config.groq.baseModel;
}

function toMessages(
  system: string | undefined,
  messages: LlmMessage[],
  images?: string[],
): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  if (system) out.push({ role: "system", content: system });
  const lastUserIdx = messages
    .map((message) => message.role)
    .lastIndexOf("user");

  messages.forEach((message, index) => {
    if (message.role === "assistant" && message.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((toolCall, index) => ({
          id: toolCall.id ?? `call_${index}`,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.args ?? {}),
          },
        })),
      });
    } else if (message.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: message.toolCallId ?? "call_0",
        content: message.content,
      });
    } else if (
      message.role === "user" &&
      index === lastUserIdx &&
      images?.length
    ) {
      // Attach images to the latest user turn for multimodal models.
      out.push({
        role: "user",
        content: [
          { type: "text", text: message.content },
          ...images.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      });
    } else {
      out.push({ role: message.role, content: message.content });
    }
  });
  return out;
}

function buildBody(generateOptions: GenerateOptions, stream: boolean) {
  const body: Record<string, unknown> = {
    model: pickModel(generateOptions),
    messages: toMessages(
      generateOptions.system,
      generateOptions.messages,
      generateOptions.images,
    ),
    temperature: generateOptions.temperature ?? 0.7,
    max_tokens: generateOptions.maxTokens ?? config.llmMaxTokens,
    stream,
  };
  if (generateOptions.json) body.response_format = { type: "json_object" };
  if (generateOptions.tools?.length) {
    body.tools = generateOptions.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
  return body;
}

async function post(body: unknown, signal?: AbortSignal): Promise<Response> {
  const result = await fetch(`${config.groq.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groq.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!result.ok) {
    const detail = await result.text().catch(() => "");
    throw new Error(`Groq ${result.status}: ${detail.slice(0, 300)}`);
  }
  return result;
}

export const groqProvider: LlmProvider = {
  name: "groq",

  async generate(generateOptions: GenerateOptions): Promise<LlmResponse> {
    let res: Response;
    try {
      res = await post(buildBody(generateOptions, false));
    } catch (err) {
      // If the main model hit its daily/rate limit, retry on the cheaper model
      // (separate budget) so chat keeps working instead of failing outright.
      if (
        !generateOptions.fast &&
        err instanceof Error &&
        /\b429\b/.test(err.message)
      ) {
        res = await post(buildBody({ ...generateOptions, fast: true }, false));
      } else {
        throw err;
      }
    }
    const data = (await res.json()) as {
      choices: { message: OpenAiMessage }[];
    };
    const message = data.choices?.[0]?.message;
    const toolCalls: LlmToolCall[] = (message?.tool_calls ?? []).map(
      (toolCall) => ({
        id: toolCall.id,
        name: toolCall.function.name,
        args: safeJson(toolCall.function.arguments),
      }),
    );
    const text = typeof message?.content === "string" ? message.content : "";
    return { text, toolCalls };
  },

  async *stream(generateOptions: GenerateOptions): AsyncIterable<string> {
    const res = await post(
      buildBody({ ...generateOptions, tools: undefined }, true),
    );
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta as string;
        } catch {
          /* ignore keep-alive / partial frames */
        }
      }
    }
  },
};

function safeJson(string: string): Record<string, unknown> {
  try {
    return JSON.parse(string) as Record<string, unknown>;
  } catch {
    return {};
  }
}
