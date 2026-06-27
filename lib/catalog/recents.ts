/** Persisted recent searches — the behavioral signal for dynamic suggestions.
 *  We track BOTH recency (most-recent-first list) and frequency (how many times
 *  each term was searched), so suggestions can lead with what the shopper looks
 *  for most often, not just last. */
"use client";

import { SKIP_WORDS } from "./skipwords";

const KEY = "hala_recent_searches";
const FREQ_KEY = "hala_search_frequency";

// Autobuy's internal continuity text folds feedback onto the original
// request with this exact separator ("X — but Y — but Z…", see
// orchestrator.ts's foldAutobuyFeedback) — a real typed/spoken search query
// would essentially never contain it, so it's a reliable signal that an
// entry isn't a genuine search term and shouldn't feed the placeholder
// rotation or suggestion list.
const isCleanQuery = (value: string) =>
  value.length <= 60 && !value.includes(" — but ");

export function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    // Filter defensively on read too, so any already-saved garbled entries
    // (from before this filter existed) self-heal out of the rotation
    // instead of requiring the user to clear storage.
    return JSON.parse(localStorage.getItem(KEY) || "[]")
      .filter(
        (value: unknown) => typeof value === "string" && isCleanQuery(value),
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

function loadFrequencyMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(FREQ_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Search terms ordered by how OFTEN they've been searched (most first). Only
 *  terms searched `minCount`+ times count as "frequent" — one search isn't a
 *  habit, so a brand-new visitor still sees nothing. */
export function loadFrequent(minCount = 2): string[] {
  return Object.entries(loadFrequencyMap())
    .filter(([term, count]) => count >= minCount && isCleanQuery(term))
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .slice(0, 8);
}

// Trivial confirmations/replies aren't useful search signals.

export function saveRecent(query: string) {
  const value = (query || "").trim();
  if (
    value.length < 4 ||
    !isCleanQuery(value) ||
    SKIP_WORDS.has(value.toLowerCase())
  )
    return;
  try {
    const current = loadRecents().filter(
      (recent) => recent.toLowerCase() !== value.toLowerCase(),
    );
    current.unshift(value);
    localStorage.setItem(KEY, JSON.stringify(current.slice(0, 8)));

    // Bump the frequency counter (case-insensitive; keep the first spelling seen
    // as the canonical key), capped so a runaway term can't dominate forever.
    const map = loadFrequencyMap();
    const existingKey =
      Object.keys(map).find(
        (key) => key.toLowerCase() === value.toLowerCase(),
      ) ?? value;
    map[existingKey] = Math.min((map[existingKey] ?? 0) + 1, 99);
    localStorage.setItem(FREQ_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
