/**
 * Low-level MCP connection to the Snoonu mock server (Streamable HTTP, no
 * auth). Server-only. Maintains a single shared, lazily-connected client and
 * exposes `listTools` / `callTool` primitives. Typed per-tool wrappers live
 * in tools.ts.
 */
import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "@/configs/env";

type ToolContent = { type: string; text?: string; [k: string]: unknown };
export interface ToolResult {
  /** Parsed JSON from the first text block, when the tool returns JSON. */
  data: unknown;
  /** Raw concatenated text content (fallback / human-readable). */
  text: string;
  isError: boolean;
}

let clientPromise: Promise<Client> | null = null;
let connectedAt = 0;
// Recycle the connection periodically: a long-lived StreamableHTTP session can
// go stale (start returning empty results) without ever erroring, which a plain
// error-retry can't detect. A fresh session every few minutes avoids that.
const MAX_CONNECTION_AGE_MS = 4 * 60 * 1000;

async function connect(): Promise<Client> {
  const client = new Client(
    { name: "snoonu-shopping-agent", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(new URL(config.mcp.url));
  await client.connect(transport);
  return client;
}

/** Returns the shared MCP client, connecting on first use and recycling a
 *  connection older than MAX_CONNECTION_AGE_MS. */
export async function getMcpClient(): Promise<Client> {
  if (clientPromise && Date.now() - connectedAt > MAX_CONNECTION_AGE_MS) {
    clientPromise = null; // aged out → reconnect with a fresh session
  }
  if (!clientPromise) {
    connectedAt = Date.now();
    clientPromise = connect().catch((err) => {
      clientPromise = null; // allow retry on next call
      throw err;
    });
  }
  return clientPromise;
}

/** List available tool definitions (names, descriptions, input schemas). */
export async function listTools() {
  const client = await getMcpClient();
  const res = await client.listTools();
  return res.tools;
}

/**
 * Invoke a tool and normalize its result. The Snoonu tools return their
 * payload as a JSON string inside a text content block; we parse it when we can.
 */
async function invokeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const client = await getMcpClient();
  const res = await client.callTool({ name, arguments: args });

  const blocks = (res.content as ToolContent[] | undefined) ?? [];
  const text = blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();

  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null; // not JSON — callers fall back to `text`
    }
  }

  return { data, text, isError: Boolean(res.isError) };
}

/**
 * Invoke a tool, self-healing a dead/stale connection. A long-lived dev server's
 * MCP session can expire or get rate-limited; the shared client would then keep
 * failing forever (every search returns empty). So on a thrown error OR an
 * error result, we drop the connection and retry once with a fresh one.
 *
 * create_order is NEVER retried — a thrown/errored order may still have been
 * placed server-side, so re-running it could double-charge.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const retryable = name !== "snoonu_create_order";
  try {
    const result = await invokeTool(name, args);
    if (result.isError && retryable) {
      clientPromise = null; // session likely stale → reconnect and retry once
      return await invokeTool(name, args);
    }
    return result;
  } catch (error) {
    clientPromise = null; // discard the broken client
    if (retryable) return await invokeTool(name, args);
    throw error; // surface order failures; never silently re-run them
  }
}
