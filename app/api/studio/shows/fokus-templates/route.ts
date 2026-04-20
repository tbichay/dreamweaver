/**
 * FokusTemplate list — for the Show-edit UI's "add Fokus" picker.
 *
 * GET /api/studio/shows/fokus-templates?category=kids
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const templates = await prisma.fokusTemplate.findMany({
    where: category ? { supportedCategories: { has: category } } : undefined,
    orderBy: [{ minAlter: "asc" }, { displayName: "asc" }],
  });

  return Response.json({ templates });
}
