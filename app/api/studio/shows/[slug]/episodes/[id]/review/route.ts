/**
 * Studio Episode-Review — admin-only Approve/Reject-Gate fuer Pilot-Episoden.
 *
 * POST /api/studio/shows/[slug]/episodes/[id]/review
 *   body: { action: "approve" | "reject", reviewNotes?: string, continuityNotes?: string }
 *
 * Feature S3 (Pilot + Review-Loop):
 *   Wenn ein Admin einen "Piloten" generiert (isPilot=true via Test-Episode-
 *   Endpoint mit opts.isPilot), unterdrueckt der Generator nach Completion den
 *   generation.completed-Webhook und setzt stattdessen reviewStatus="pending".
 *   Dieser Endpoint transitioniert dann:
 *     - "approve" → reviewStatus="approved" + feuert den zurueckgehaltenen
 *                   generation.completed-Webhook nach (so kriegt Canzoia die
 *                   fertige Episode ganz normal in die Feed-Queue).
 *     - "reject"  → reviewStatus="rejected". Kein Webhook. Die Episode bleibt
 *                   im Studio sichtbar (fuer spaeteren Lerngewinn) zaehlt aber
 *                   NICHT mehr als "vorherige Folge" fuer Continuity-Mode
 *                   (siehe loadEpisodeInput's OR-Filter).
 *
 * Idempotenz: ein zweiter Approve-Call auf eine bereits "approved" Episode
 * fuehrt zu 409 — wir wollen nicht zweimal den gleichen Webhook rausschicken.
 * Dito Reject → Approve (nach Reject kein Wiederbeleben; dafuer gibt's Retry).
 *
 * Auth: gleiche requireAdmin-Chain wie /retry.
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";
import { dispatchCompletedWebhook } from "@/lib/studio/show-episode-generator";

type Ctx = { params: Promise<{ slug: string; id: string }> };

interface ReviewBody {
  action?: "approve" | "reject";
  reviewNotes?: string | null;
  // Regie-Notiz fuer Continuity: was soll die NAECHSTE Folge beachten?
  // (nicht fuer die aktuelle Episode, sondern fuer Folge-Episoden dieser Show).
  // Optional — wenn gesetzt, wird es in ShowEpisode.continuityNotes gespeichert
  // und bei der naechsten Generation als "Regie-Notiz" im Continuity-Block
  // an Claude gereicht.
  continuityNotes?: string | null;
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug, id } = await ctx.params;

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return Response.json({ error: "Body muss JSON sein" }, { status: 400 });
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return Response.json(
      { error: "action muss 'approve' oder 'reject' sein" },
      { status: 400 },
    );
  }

  const episode = await prisma.showEpisode.findUnique({
    where: { id },
    include: { show: { select: { slug: true } } },
  });
  if (!episode) {
    return Response.json({ error: "Episode nicht gefunden" }, { status: 404 });
  }
  if (episode.show.slug !== slug) {
    return Response.json(
      { error: "Episode gehoert nicht zu dieser Show" },
      { status: 400 },
    );
  }

  // Gate-Eingangs-Check: nur Episoden im pending-Review-State sind review-bar.
  // Wenn reviewStatus null ist, ist das keine Pilot-Episode → kein Review-
  // Prozess. Wenn sie schon approved/rejected ist, blocken wir — sonst wuerde
  // ein Doppelklick einen zweiten Webhook feuern (approve zweimal) oder eine
  // bereits abgelehnte Episode nachtraeglich durchwinken.
  if (episode.reviewStatus !== "pending") {
    return Response.json(
      {
        error: `Review nicht moeglich: reviewStatus ist '${episode.reviewStatus ?? "null"}' (erwartet 'pending')`,
      },
      { status: 409 },
    );
  }
  if (episode.status !== "completed") {
    return Response.json(
      {
        error: `Episode muss Status 'completed' haben (aktuell '${episode.status}')`,
      },
      { status: 409 },
    );
  }

  const reviewerId = session.user?.id ?? session.user?.email ?? "unknown-admin";
  const newStatus = body.action === "approve" ? "approved" : "rejected";

  // DB-Update ZUERST → Webhook danach. Wenn der Webhook-Dispatch selbst eine
  // Exception wirft (z.B. Canzoia unreachable waehrend des Admin-Klicks),
  // ist die Episode trotzdem als "approved" markiert und der Dispatch-Retry
  // im Scheduler (WebhookDelivery-Table) holt es nach. deliverWebhookSafe()
  // ist als Fire-and-Forget designed — wirft per Name nicht — aber wir
  // schuetzen uns trotzdem mit einem try/catch fuer echte Errors
  // (z.B. buildAudioProxyUrl wirft wenn canzoiaJobId leer ist).
  await prisma.showEpisode.update({
    where: { id: episode.id },
    data: {
      reviewStatus: newStatus,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      reviewNotes:
        typeof body.reviewNotes === "string" ? body.reviewNotes.slice(0, 2000) : null,
      ...(typeof body.continuityNotes === "string"
        ? { continuityNotes: body.continuityNotes.slice(0, 2000) }
        : {}),
    },
  });

  if (body.action === "approve") {
    try {
      await dispatchCompletedWebhook(episode.id);
    } catch (e) {
      // Rollback vermeiden — Episode ist approved, aber der Webhook-Call
      // konnte nicht platziert werden. Das erfordert manuelles Eingreifen.
      // Wir antworten trotzdem 200 (Approve war erfolgreich), leiten das
      // Problem aber als errorMessage in die Episode damit der Admin es sieht.
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[episode-review] Webhook-Dispatch fehlgeschlagen ${id}: ${msg}`);
      await prisma.showEpisode.update({
        where: { id: episode.id },
        data: {
          errorMessage: `Review approved aber Webhook-Dispatch fehlgeschlagen: ${msg.slice(0, 1500)}`,
        },
      });
      return Response.json(
        {
          ok: false,
          episodeId: episode.id,
          reviewStatus: newStatus,
          warning: "Approve gespeichert, aber Webhook-Dispatch fehlgeschlagen. Manueller Retry noetig.",
        },
        { status: 200 },
      );
    }
  }

  return Response.json({
    ok: true,
    episodeId: episode.id,
    reviewStatus: newStatus,
    reviewedBy: reviewerId,
  });
}
