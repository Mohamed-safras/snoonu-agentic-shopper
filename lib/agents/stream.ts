/**
 * Wraps an orchestrator run in a ReadableStream of NDJSON AgentEvents
 * (one JSON object per line) for the /api/chat route handler.
 */
import "server-only";
import { orchestrate } from "./orchestrator";
import type { AgentContext } from "./core/context";
import type { AgentEvent } from "@/types";

export function createAgentStream(ctx: AgentContext): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await orchestrate(ctx, emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "stream error" });
        emit({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });
}
