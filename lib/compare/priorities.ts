/** "What matters most?" priorities for the compare widget. These are UX config
 *  (decision lenses), NOT catalog data — the products and the comparison itself
 *  always come live from MCP + the LLM. Selecting one re-biases which product is
 *  recommended and how the reason is phrased. */

export interface ComparePriority {
  id: string;
  /** Chip label shown to the shopper. */
  label: string;
  /** Guidance appended to the compare prompt to bias the recommendation. */
  guidance: string;
}

export const COMPARE_PRIORITIES: ComparePriority[] = [
  {
    id: "",
    label: "Balanced",
    guidance:
      "Weigh everything fairly for an all-round best pick.",
  },
  {
    id: "price",
    label: "Best price",
    guidance:
      "The shopper cares MOST about price — lean your recommendation toward the most affordable option that's still good, and say so in the reason.",
  },
  {
    id: "quality",
    label: "Best quality",
    guidance:
      "The shopper cares MOST about quality — lean your recommendation toward the best-made / highest-rated option, and say so in the reason.",
  },
  {
    id: "durability",
    label: "Longest-lasting",
    guidance:
      "The shopper cares MOST about durability / longevity — lean your recommendation toward the most hard-wearing, long-lasting option, and say so in the reason.",
  },
  {
    id: "gift",
    label: "Best gift",
    guidance:
      "The shopper is choosing a GIFT — lean your recommendation toward the most gift-worthy, impressive-to-receive option, and say so in the reason.",
  },
];

/** The prompt guidance for a priority id (empty/unknown → the balanced lens). */
export function comparePriorityGuidance(priorityId: string): string {
  const match = COMPARE_PRIORITIES.find((option) => option.id === priorityId);
  return (match ?? COMPARE_PRIORITIES[0]).guidance;
}
