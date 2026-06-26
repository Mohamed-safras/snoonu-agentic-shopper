/**
 * Gemini provider (Google AI Studio free tier). Multilingual + vision-capable,
 * with native function calling. Implements the normalized LlmProvider.
 */
import "server-only";
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { config as envConfig } from "@/configs/env";
import type {
  GenerateOptions,
  LlmMessage,
  LlmProvider,
  LlmResponse,
  LlmToolCall,
} from "./types";

let googleGenAI: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (!googleGenAI) {
    googleGenAI = envConfig.gemini.useVertex
      ? new GoogleGenAI({
          vertexai: true,
          project: envConfig.gemini.project,
          location: envConfig.gemini.location,
        })
      : new GoogleGenAI({ apiKey: envConfig.gemini.apiKey });
  }
  return googleGenAI;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** "data:image/png;base64,XXXX" → { mimeType, data }. */
function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/** Pick the model tier: vision → translation → fast → default. */
function pickModel(opts: GenerateOptions): string {
  if (opts.images?.length) return envConfig.gemini.visionModel;
  if (opts.translate) return envConfig.gemini.translateModel;
  if (opts.fast) return envConfig.gemini.fastModel;
  return envConfig.gemini.proModel;
}

/** Map our normalized messages → Gemini `contents`. */
function toContents(messages: LlmMessage[], images?: string[]): Content[] {
  const contents: Content[] = [];
  const lastUserIdx = messages
    .map((message) => message.role)
    .lastIndexOf("user");

  messages.forEach((message, index) => {
    if (message.role === "user") {
      const parts: Part[] = [];
      if (message.content) parts.push({ text: message.content });
      if (index === lastUserIdx && images?.length) {
        for (const img of images) {
          const parsed = parseDataUrl(img);
          if (parsed)
            parts.push({
              inlineData: { mimeType: parsed.mimeType, data: parsed.data },
            });
        }
      }
      contents.push({ role: "user", parts });
    } else if (message.role === "assistant") {
      const parts: Part[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const toolCall of message.toolCalls ?? [])
        parts.push({
          functionCall: { name: toolCall.name, args: toolCall.args },
        });
      contents.push({ role: "model", parts });
    } else {
      // tool result → functionResponse part (Gemini expects role "user")
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: message.toolName ?? "tool",
              response: { result: tryParse(message.content) },
            },
          },
        ],
      });
    }
  });
  return contents;
}

function buildConfig(generateOptions: GenerateOptions) {
  const config: Record<string, unknown> = {
    temperature: generateOptions.temperature ?? 0.7,
    maxOutputTokens: generateOptions.maxTokens ?? envConfig.llmMaxTokens,
  };
  // Gemini 2.5 models think by default, and those thinking tokens are drawn from
  // maxOutputTokens — so a small budget can be entirely consumed by thinking,
  // leaving an EMPTY or TRUNCATED response (this silently broke /api/compare's
  // JSON and degraded the orchestrator router to a no-search "chat" fallback).
  // Lighter tiers (flash/translate/vision) disable thinking outright; the Pro
  // tier can't disable it (minimum budget 128), so we bound it tightly enough
  // that the structured output is never starved. Bonus: much lower latency.
  config.thinkingConfig = {
    thinkingBudget:
      pickModel(generateOptions) === envConfig.gemini.proModel ? 128 : 0,
  };
  if (generateOptions.system) config.systemInstruction = generateOptions.system;
  if (generateOptions.json) config.responseMimeType = "application/json";
  if (generateOptions.tools?.length) {
    config.tools = [
      {
        functionDeclarations: generateOptions.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];
  }
  return config;
}

export const geminiProvider: LlmProvider = {
  name: "gemini",

  async generate(generateOptions: GenerateOptions): Promise<LlmResponse> {
    const result = await client().models.generateContent({
      model: pickModel(generateOptions),
      contents: toContents(generateOptions.messages, generateOptions.images),
      config: buildConfig(generateOptions),
    });

    const toolCalls: LlmToolCall[] = (result.functionCalls ?? []).map(
      (functionCall) => ({
        id: functionCall.id,
        name: functionCall.name ?? "",
        args: (functionCall.args ?? {}) as Record<string, unknown>,
      }),
    );

    return { text: result.text ?? "", toolCalls };
  },

  async *stream(generateOptions: GenerateOptions): AsyncIterable<string> {
    const iterator = await client().models.generateContentStream({
      model: pickModel(generateOptions),
      contents: toContents(generateOptions.messages, generateOptions.images),
      config: buildConfig({ ...generateOptions, tools: undefined }),
    });
    for await (const chunk of iterator) {
      if (chunk.text) yield chunk.text;
    }
  },
};
