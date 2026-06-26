# Trova — Kapruka AI Shopping Concierge

A full-screen, conversational shopping agent for **Kapruka.com**, built for the Kapruka Agent Challenge. Trova takes a customer from _"I'm not sure what to get"_ all the way to _"it's on its way"_ — discovery, live delivery quotes, **real guest checkout with a working pay link**, and order tracking — in one warm conversation, in **English, Sinhala, Tamil, or Tanglish**.

Trova reads the _feeling_ behind a message first, then the keywords — it responds with warmth, and when intent is unclear it asks one friendly clarifying question (with quick-pick chips) instead of guessing, keeping conversation context across turns so suggestions get more accurate the more you chat.

## Highlights

- **Emotion- and context-aware** — understands intent and mood across the whole conversation, not just the last message; falls back to a gentle clarifying question when unsure.
- **Real catalog, real money, real orders** — live MCP search, genuine LKR prices, and a working 60-minute pay link from `create_order`, validated end-to-end (no broken pay-link cards — Kapruka errors surface as real messages, not a generic failure).
- **Conversational product shelves with pagination** — cursor-based **"View more"** keeps a shelf growing instead of re-searching, on top of an LLM-ranked first page.
- **Side-by-side compare** — pick products to compare and get a verdict-driven card (best-for tags, pros/cons per criterion, a spoken recommendation), not just a bare spec table.
- **Personalized "Picked for you"** — leads with what a shopper searches *most often* (not just last), so frequent shoppers keep seeing things to buy even without a fresh search.
- **Visual search** — snap a photo with the **camera** or pick from the **gallery**, attach **multiple images**, and find matching products (Gemini vision). Attached images appear in your chat bubble (scrollable, tap to view full-size).
- **Voice input** — speak your request; the transcript fills the composer for you to review and send.
- **Full control of the conversation** — **stop** a request mid-stream, and **edit & resend** any message you sent (the "try again" affordance only ever appears on your own messages).
- **Slash commands** — type `/` for quick actions (`/surprise`, `/cart`, …) with inline autocomplete.
- **Multilingual, end-to-end** — English, Sinhala, Tamil, and Tanglish. Product Q&A and compare answers respond natively in whatever language you *ask* in, even if the UI toggle is set to English. Replies are machine-translated from a single English source (MT-first), so content stays consistent across languages — only the wording changes.
- **Promo banner carousel** — auto-curated occasion banners (festivals, paydays, gifting moments) with infinite prev/next, a live countdown, and the same content across every language (translated, not independently re-curated).
- **Delivery & tracking maps** — live route + ETA from Kapruka HQ to the destination city (Leaflet + OSRM), draggable pin for an exact drop-off.
- **Light & dark mode** — full theming with high-contrast cards/panels and an ambient mood background that adapts per occasion in both modes.

## Architecture

A genuine **orchestrator + specialist multi-agent system** wired to the live **Kapruka MCP** (`https://mcp.kapruka.com/mcp`, Streamable HTTP, no auth).

```
Browser (Next.js client UI)
  └─ useAgent() → POST /api/chat  (streams NDJSON events)
        ▼
Orchestrator (lib/agents/orchestrator.ts)  — persona, routing, language
  ├─ Discovery specialist  → MCP search_products / get_product   (LLM-planned query)
  ├─ Delivery specialist   → MCP list_delivery_cities / check_delivery
  ├─ Checkout specialist   → MCP create_order   (REAL pay link, rate-guarded)
  └─ Tracking specialist   → MCP track_order
        ▼
LLM provider abstraction (Gemini | Groq)   +   MCP client (lib/mcp/*)
```

- **LLM**: free **Google Gemini** (`gemini-2.0-flash`) by default — multilingual + vision (photo search). **Groq** Llama-3.3-70B is a drop-in fallback (`DEFAULT_LLM_PROVIDER=groq`).
- **Structured flows** (city resolve, delivery quote, checkout, tracking) hit dedicated deterministic endpoints under `app/api/*` — no tokens spent, fully reliable.
- **Prices are always the real Kapruka amounts** returned by the MCP (LKR); nothing is converted or invented.

## Setup

1. Install: `pnpm install`
2. Add a **free** Google AI Studio key to `.env.local` (copy from `.env.example`):
   ```
   GEMINI_API_KEY=your_key_here     # https://aistudio.google.com/apikey
   ```
   (Optional: set `DEFAULT_LLM_PROVIDER=groq` + `GROQ_API_KEY` to use Groq instead.)
3. Run: `pnpm dev` → http://localhost:3000

No Kapruka API key is needed — the MCP is public.

## Verify it works

- `GET /api/debug/mcp` (dev only) — exercises all 7 MCP tools live.
- In the chat: _"flowers for my wife"_ → real shelf → add to cart → _"deliver to Kandy"_ → pick a date → fill details → **Place order** → open the genuine pay link → track with the emailed order number.
- Switch language (top-right) and try a turn in Sinhala / Tanglish — also ask a product or compare question in Sinhala/Tamil **without** switching the toggle and confirm it answers natively.
- Search the same term a few times to see **"Picked for you"** lead with it; scroll a shelf to the end and tap **View more** to page in the next batch of real results.
- Pick two products to **compare** and confirm the card shows tagged verdicts and a spoken recommendation, not just a table.
- Tap the 📷 button to do a visual product search (Gemini vision) — take a photo or choose from the gallery, attach several images at once.
- Type `/` in the composer to see slash-command autocomplete; tap the mic to dictate.
- Send a vague message (e.g. _"a gift"_) to see Trova ask a friendly clarifying question; **stop** a long request mid-stream, or **edit & resend** a previous message.
- Toggle light/dark mode (top-right) and confirm cards stay readable and the ambient background is visible in both.

## Key files

| Area                                  | Path                          |
| ------------------------------------- | ----------------------------- |
| MCP client + tools + adapters         | `lib/mcp/`                    |
| LLM providers (Gemini/Groq)           | `lib/llm/`                    |
| Agents (orchestrator + specialists)   | `lib/agents/`                 |
| Streaming chat + structured endpoints | `app/api/`                    |
| UI (ported, typed)                    | `components/`, `app/page.tsx` |
| Theme                                 | `app/globals.css`             |

## Deploy (Vercel)

`vercel` (or import the repo). Set the env vars from `.env.example` in the Vercel dashboard. The chat route runs on the Node runtime with streaming.

## Author

Made with ❤️ by **[Mohamed Safras](https://www.linkedin.com/in/mohamed-safras-aw/)** 🇱🇰

© 2026 Mohamed Safras. All rights reserved.

---

_Built for the Kapruka Agent Challenge · real catalog · no sign-up · island-wide 🇱🇰_
