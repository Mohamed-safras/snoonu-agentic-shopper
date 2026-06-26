/**
 * Provider-agnostic LLM interface. Both Gemini and Groq implement `LlmProvider`
 * so the agents never depend on a specific SDK. Tool-calling and (Gemini-only)
 * vision are normalized here.
 */

/** A tool the model may call. `parameters` is a JSON-Schema object. */
export interface LlmToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A tool call requested by the model. */
export interface LlmToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export type LlmRole = "user" | "assistant" | "tool";

export interface LlmMessage {
  role: LlmRole;
  content: string;
  /** assistant turns may carry tool calls. */
  toolCalls?: LlmToolCall[];
  /** tool-result turns reference the call they answer. */
  toolCallId?: string;
  toolName?: string;
}

export interface GenerateOptions {
  system?: string;
  messages: LlmMessage[];
  tools?: LlmToolDef[];
  temperature?: number;
  maxTokens?: number;
  /** Force JSON output (used for routing/structured decisions). */
  json?: boolean;
  /** Use the cheaper "fast" model tier (ancillary tasks, saves main quota). */
  fast?: boolean;
  /** Use the dedicated translation model tier (UI copy + chat re-translation). */
  translate?: boolean;
  /** base64 data URLs attached to the latest user turn (Gemini vision). */
  images?: string[];
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  readonly name: string;
  /** Single completion; may return tool calls when `tools` are supplied. */
  generate(opts: GenerateOptions): Promise<LlmResponse>;
  /** Stream plain text deltas (no tool calls) — used for the warm final reply. */
  stream(opts: GenerateOptions): AsyncIterable<string>;
}
