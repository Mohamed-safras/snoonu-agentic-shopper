/** GET /api/kit?goal=power-cut+ready&budget=30000&nonce=… — assemble a real,
 *  budget-fit kit of complementary Snoonu products that solve the shopper's
 *  goal. Same shape as /api/hamper (a Bundle). */
import { buildKit } from "@/lib/agents/bundles/kit";
import { activeProviderConfigured } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const budget = Math.max(
    500,
    Math.min(500000, Number(searchParams.get("budget")) || 5000),
  );
  const goal = searchParams.get("goal");
  const nonce = Number(searchParams.get("nonce")) || undefined;

  if (!activeProviderConfigured()) {
    return Response.json({ slots: [], total: 0, budget, currency: "QAR" });
  }
  try {
    return Response.json(await buildKit(goal, budget, { nonce }));
  } catch {
    return Response.json(
      { slots: [], total: 0, budget, currency: "QAR" },
      { status: 502 },
    );
  }
}
