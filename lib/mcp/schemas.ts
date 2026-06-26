/**
 * Input schemas & types for the Kapruka MCP tools. Read-tool inputs are simple
 * TS interfaces; the write tool (create_order) uses zod so we validate LLM-built
 * payloads before they reach the live, rate-limited order endpoint.
 */
import { z } from "zod";

/* ------------------------------- read inputs ----------------------------- */

export interface SearchParams {
  query: string;
  category?: string;
  limit?: number;
  cursor?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
}

/* ------------------------------ create order ----------------------------- */

export const cartItemSchema = z.object({
  product_id: z.string().min(3).max(80),
  quantity: z.number().int().min(1).max(99).default(1),
  icing_text: z.string().max(120).nullish(),
});

export const createOrderSchema = z.object({
  cart: z.array(cartItemSchema).min(1).max(30),
  recipient: z.object({
    name: z.string().min(1).max(80),
    phone: z.string().min(7).max(30),
  }),
  delivery: z.object({
    address: z.string().min(3).max(250),
    city: z.string().min(2).max(100),
    location_type: z
      .enum(["house", "apartment", "office", "other"])
      .default("house"),
    date: z.string(), // YYYY-MM-DD, today or future (Asia/Colombo)
    instructions: z.string().max(250).nullish(),
  }),
  sender: z.object({
    name: z.string().min(1).max(80),
    anonymous: z.boolean().default(false),
  }),
  // The live MCP caps gift_message at 300 chars — match it so a long note fails
  // our validation with a clear message instead of being rejected by Kapruka.
  gift_message: z.string().max(300).nullish(),
  currency: z.string().default("LKR"),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
