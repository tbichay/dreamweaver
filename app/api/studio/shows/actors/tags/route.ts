/**
 * Aggregated tag vocabulary for the Actor-edit UI.
 *
 * Returns unique values for expertise[] + catchphrases[] across the admin's
 * visible actors (system + own). Feeds the autocomplete suggestions in the
 * <TagInput> component so new actors reuse existing tags instead of drifting
 * into synonyms ("meditation" vs "meditations-guide").
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const actors = await prisma.actor.findMany({
    where: {
      OR: [{ ownerUserId: null }, { ownerUserId: session.user.id }],
    },
    select: { expertise: true, catchphrases: true },
  });

  const expertise = new Set<string>();
  const catchphrases = new Set<string>();
  for (const a of actors) {
    a.expertise.forEach((t) => t && expertise.add(t));
    a.catchphrases.forEach((t) => t && catchphrases.add(t));
  }

  return Response.json({
    expertise: [...expertise].sort(),
    catchphrases: [...catchphrases].sort(),
  });
}
