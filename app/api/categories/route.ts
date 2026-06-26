/** GET /api/categories — real top-level Kapruka category names (for the tabs). */
import { listCategories } from "@/lib/mcp/tools";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await listCategories(1);
    return Response.json({ categories: res.categories.map((c) => c.name).filter(Boolean) });
  } catch {
    return Response.json({ categories: [] });
  }
}
