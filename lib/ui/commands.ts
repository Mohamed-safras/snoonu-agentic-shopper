/**
 * Slash-command registry for the chat composer. Typing "/" opens a quick-action
 * menu (surprise, cart, orders, track, checkout, clear). The metadata lives here;
 * the page binds each id to its handler. Keeps the feature discoverable.
 */
export type CommandId =
  | "surprise"
  | "autobuy"
  | "hamper"
  | "kit"
  | "countdown"
  | "cart"
  | "orders"
  | "watchlist"
  | "track"
  | "checkout"
  | "clear";

export interface SlashCommand {
  id: CommandId;
  label: string;
  hint: string;
  emoji: string;
  /** Lowercased match tokens, including a few common misspellings. */
  triggers: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "surprise",
    label: "Surprise me",
    hint: "3-tap gift finder",
    emoji: "🎁",
    triggers: ["surprise", "surprise me", "suprise", "suprise me", "concierge"],
  },
  {
    id: "autobuy",
    label: "Let AI pick & order",
    hint: "Give a budget — AI finds it and places the order",
    emoji: "🤖",
    triggers: ["autobuy", "auto buy", "auto order", "ai pick", "pick and order", "buy for me"],
  },
  {
    id: "hamper",
    label: "Build a hamper",
    hint: "Budget-fit gift bundle",
    emoji: "🧺",
    triggers: ["hamper", "build hamper", "gift hamper", "bundle", "gift box"],
  },
  {
    id: "kit",
    label: "Shop by goal",
    hint: "AI builds a kit for your need",
    emoji: "🧰",
    triggers: ["kit", "shop by goal", "smart kit", "build kit", "setup", "essentials"],
  },
  {
    id: "countdown",
    label: "Occasion countdown",
    hint: "Days left + delivery in time",
    emoji: "⏰",
    triggers: ["countdown", "occasion", "reminder", "days left", "when"],
  },
  {
    id: "cart",
    label: "View cart",
    hint: "Review your items",
    emoji: "🛒",
    triggers: ["cart", "view cart", "bag", "basket"],
  },
  {
    id: "orders",
    label: "My orders",
    hint: "Past orders & reorder",
    emoji: "🧾",
    triggers: ["orders", "list orders", "my orders", "history"],
  },
  {
    id: "watchlist",
    label: "Watchlist",
    hint: "Price-drop & restock alerts",
    emoji: "🔔",
    triggers: ["watchlist", "watch", "watching", "alerts", "price drop"],
  },
  {
    id: "track",
    label: "Track order",
    hint: "Live delivery status",
    emoji: "📦",
    triggers: ["track", "track order", "status"],
  },
  {
    id: "checkout",
    label: "Checkout",
    hint: "Delivery & payment",
    emoji: "💳",
    triggers: ["checkout", "pay", "place order", "deliver"],
  },
  {
    id: "clear",
    label: "Clear chat",
    hint: "Start a fresh thread",
    emoji: "🧹",
    triggers: ["clear", "reset", "clear chat", "new chat"],
  },
];

/** Strip the leading slash(es) and normalise the typed query. */
const normalize = (raw: string) =>
  raw.replace(/^\/+/, "").replace(/\s+/g, " ").trimStart().toLowerCase();

const startsWithQuery = (command: SlashCommand, query: string) =>
  command.id.startsWith(query) ||
  command.triggers.some((trigger) => trigger.startsWith(query));

const includesQuery = (command: SlashCommand, query: string) =>
  command.label.toLowerCase().includes(query) ||
  command.triggers.some((trigger) => trigger.includes(query));

/**
 * Commands matching what the user typed after the slash. An empty query (just
 * "/") returns every command. Prefix matches are ranked above substring matches.
 */
export function filterCommands(rawInput: string): SlashCommand[] {
  const query = normalize(rawInput);
  if (!query) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (command) =>
      startsWithQuery(command, query) || includesQuery(command, query),
  ).sort(
    (a, b) =>
      Number(startsWithQuery(b, query)) - Number(startsWithQuery(a, query)),
  );
}

/** Best single command for a fully typed "/…" string (used on Enter / Send). */
export function matchCommand(rawInput: string): SlashCommand | null {
  const query = normalize(rawInput);
  if (!query) return null;
  const exact = SLASH_COMMANDS.find(
    (command) => command.id === query || command.triggers.includes(query),
  );
  if (exact) return exact;
  return filterCommands(rawInput)[0] ?? null;
}
