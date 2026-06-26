/** GET /api/hamper?budget=5000&occasion=birthday&category=Chocolates&name=tea+lover
 *  — build a real, budget-fit gift hamper of complementary Kapruka products,
 *  optionally constrained to a category and shaped by a free-text theme. */
import { buildHamper } from "@/lib/agents/bundles/hamper";
import { activeProviderConfigured } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const budget = Math.max(
    500,
    Math.min(500000, Number(searchParams.get("budget")) || 5000),
  );
  const occasion = searchParams.get("occasion");
  const category = searchParams.get("category");
  const theme = searchParams.get("name");
  const recipient = searchParams.get("recipient");
  const count = Number(searchParams.get("count")) || undefined;
  const nonce = Number(searchParams.get("nonce")) || undefined;

  if (!activeProviderConfigured()) {
    return Response.json({ slots: [], total: 0, budget, currency: "LKR" });
  }
  try {
    return Response.json(
      await buildHamper(budget, occasion, {
        category,
        theme,
        recipient,
        count,
        nonce,
      }),
    );
  } catch {
    return Response.json(
      { slots: [], total: 0, budget, currency: "LKR" },
      { status: 502 },
    );
  }
}
