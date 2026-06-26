/**
 * In-memory guard for the live order endpoint. The Kapruka MCP allows ~30
 * order creations/hour per IP; we keep our own conservative ceiling so a runaway
 * agent loop can never spam real orders. Process-local (resets on cold start),
 * which is sufficient for a single-instance demo deployment.
 */
import "server-only";
import { config } from "@/configs/env";

const timestamps: number[] = [];
const WINDOW_MS = 60 * 60 * 1000;

export function canCreateOrder(): boolean {
  const cutoff = Date.now() - WINDOW_MS;
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift();
  return timestamps.length < config.orders.maxPerHour;
}

export function recordOrderCreated(): void {
  timestamps.push(Date.now());
}

export function ordersRemaining(): number {
  const cutoff = Date.now() - WINDOW_MS;
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift();
  return Math.max(0, config.orders.maxPerHour - timestamps.length);
}
