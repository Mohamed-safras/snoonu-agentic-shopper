/**
 * Central runtime configuration. Server-only values (API keys) must never be
 * imported into client components — keep this module out of "use client" files.
 */

import { LlmProviderName } from "@/types/llm-provider";

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  defaultLLmProvider:
    (env("DEFAULT_LLM_PROVIDER", "gemini") as LlmProviderName) || "gemini",

  llmMaxTokens: Number(env("LLM_MAX_TOKENS", "1024")),

  gemini: {
    apiKey: env("GEMINI_API_KEY"),
    proModel: env("GEMINI_PRO_MODEL", "gemini-2.5-pro"),
    fastModel: env("GEMINI_FAST_MODEL", "gemini-2.0-flash-lite"),
    translateModel: env(
      "GEMINI_TRANSLATE_MODEL",
      env("GEMINI_FAST_MODEL", "gemini-2.0-flash-lite"),
    ),
    visionModel: env("GEMINI_VISION_MODEL", "gemini-2.5-flash"),
    useVertex: env("GOOGLE_GENAI_USE_VERTEXAI").toLowerCase() === "true",
    project: env("GOOGLE_CLOUD_PROJECT"),
    location: env("GOOGLE_CLOUD_LOCATION", "us-central1"),
  },

  groq: {
    apiKey: env("GROQ_API_KEY"),
    baseModel: env("GROQ_BASE_MODEL", "llama-3.3-70b-versatile"),
    fastModel: env("GROQ_FAST_MODEL", "llama-3.1-8b-instant"),
    translateModel: env(
      "GROQ_TRANSLATE_MODEL",
      env("GROQ_BASE_MODEL", "llama-3.3-70b-versatile"),
    ),
    visionModel: env(
      "GROQ_VISION_MODEL",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ),
    baseUrl: env("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
  },

  machineTranslation: {
    googleTranslationApiKey: env("GOOGLE_TRANSLATE_API_KEY"),
  },

  mcp: {
    url: env("SNOONU_MCP_URL", "http://localhost:8000/mcp"),
  },

  orders: {
    maxPerHour: Number(env("ORDER_MAX_PER_HOUR", "25")),
  },
} as const;
