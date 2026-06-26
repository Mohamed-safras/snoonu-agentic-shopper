/**
 * GET /api/surprise?lang=en
 * Dynamic, LLM-generated "Surprise me" quiz options (recipient / budget / vibe),
 * grounded in real Kapruka categories. Varies between sessions.
 */
import { surpriseQuiz } from "@/lib/agents/content/surprise";
import type { Lang } from "@/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const lang = (new URL(request.url).searchParams.get("lang") || "en") as Lang;
  try {
    const quiz = await surpriseQuiz(lang);
    return Response.json({ quiz });
  } catch {
    return Response.json({ quiz: null });
  }
}
