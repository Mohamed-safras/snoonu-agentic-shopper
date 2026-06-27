/**
 * Thin compatibility hook. The conversational turn logic now lives in the
 * zustand store (see `send` / `userSend` there) so any component can drive it;
 * this hook just exposes `send` for existing call sites.
 */
"use client";
import { useHala } from "@/store";
export type { SendOptions } from "@/store";

export function useAgent() {
  const send = useHala((store) => store.send);
  return { send };
}
