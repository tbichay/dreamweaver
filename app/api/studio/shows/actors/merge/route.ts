/**
 * Actor Dedup-Merge — POST /api/studio/shows/actors/merge
 *
 * Kontext: Die DigitalActor → Actor Unification (Phase 2) hat pro visuellem
 * Stil (z.B. "realistic" vs "animated") einen eigenen Actor-Record erzeugt.
 * Dadurch gibt es jetzt Dubletten im Picker: zwei "Koda"-Karten, zwei "Luna"
 * usw. — was das Cast-Auswahl-UI verrauscht.
 *
 * Dieser Endpoint konsolidiert mehrere Actor-Rows in einen "primary":
 *   1. Visual-Daten der non-primaries (portraitUrl, characterSheet, outfit,
 *      traits, style, tags) werden in primary.visualVariants als JSON-Array
 *      angehaengt. Nichts wird ueberschrieben — primary bleibt primary.
 *   2. ShowActor-Cast-Eintraege werden umgehaengt. Wenn primary bereits in
 *      derselben Show ist (unique (showId, actorId)), wird der non-primary
 *      ShowActor geloescht, nicht upgedatet — sonst Constraint-Violation.
 *   3. DigitalActor-Schatten-Links (actorId FK, onDelete:SetNull) bleiben
 *      auf null nach Delete — wir repointen sie aktiv auf primary.id, damit
 *      der Unification-Bridge-Link erhalten bleibt.
 *   4. Non-primary Actor-Rows werden geloescht.
 *
 * Alles in einer Transaction. dryRun=true gibt einen Preview zurueck ohne
 * zu mutieren — wichtig fuers UI, damit der Admin sieht was genau passieren
 * wuerde (betroffene Shows, Anzahl Cast-Slots, DigitalActor-Aliases).
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";
import { Prisma } from "@prisma/client";

type MergeBody = {
  primaryId: string;
  mergeIds: string[];
  dryRun?: boolean;
};

// Das was wir aus einem non-primary Actor in primary.visualVariants schreiben.
// Alles optional — leere Felder werden weggelassen, damit das Array sauber
// bleibt und nicht von null-Bolzen ueberschwemmt wird.
type VisualVariant = {
  sourceActorId: string;
  sourceDisplayName: string;
  style?: string;
  portraitUrl?: string;
  characterSheet?: Record<string, unknown>;
  outfit?: string;
  traits?: string;
  tags?: string[];
  mergedAt: string;
};

function buildVariant(
  a: {
    id: string;
    displayName: string;
    style: string | null;
    portraitUrl: string | null;
    characterSheet: Prisma.JsonValue | null;
    outfit: string | null;
    traits: string | null;
    tags: string[];
  },
): VisualVariant | null {
  // Wenn der non-primary nichts visuell Eigenes mitbringt, ueberspringen —
  // wir wollen keine leeren Stubs im visualVariants-Array.
  const hasContent =
    a.style ||
    a.portraitUrl ||
    a.characterSheet ||
    a.outfit ||
    a.traits ||
    (a.tags && a.tags.length > 0);
  if (!hasContent) return null;

  const v: VisualVariant = {
    sourceActorId: a.id,
    sourceDisplayName: a.displayName,
    mergedAt: new Date().toISOString(),
  };
  if (a.style) v.style = a.style;
  if (a.portraitUrl) v.portraitUrl = a.portraitUrl;
  if (a.characterSheet && typeof a.characterSheet === "object") {
    v.characterSheet = a.characterSheet as Record<string, unknown>;
  }
  if (a.outfit) v.outfit = a.outfit;
  if (a.traits) v.traits = a.traits;
  if (a.tags && a.tags.length > 0) v.tags = a.tags;
  return v;
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  let body: MergeBody;
  try {
    body = (await request.json()) as MergeBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { primaryId, mergeIds, dryRun = false } = body;

  if (!primaryId?.trim()) {
    return Response.json({ error: "primaryId fehlt" }, { status: 400 });
  }
  if (!Array.isArray(mergeIds) || mergeIds.length === 0) {
    return Response.json({ error: "mergeIds muss ein nicht-leeres Array sein" }, { status: 400 });
  }
  if (mergeIds.includes(primaryId)) {
    return Response.json({ error: "primaryId darf nicht in mergeIds enthalten sein" }, { status: 400 });
  }

  // Dedup die mergeIds falls UI Dubletten durchlaesst.
  const dedupedMergeIds = Array.from(new Set(mergeIds));

  // Load alle beteiligten Actors in einer Query.
  const allIds = [primaryId, ...dedupedMergeIds];
  const actors = await prisma.actor.findMany({
    where: { id: { in: allIds } },
    include: {
      _count: { select: { shows: true, digitalActorAliases: true } },
    },
  });

  const primary = actors.find((a) => a.id === primaryId);
  if (!primary) {
    return Response.json({ error: `Primary Actor '${primaryId}' nicht gefunden` }, { status: 404 });
  }

  const nonPrimaries = actors.filter((a) => dedupedMergeIds.includes(a.id));
  const missingIds = dedupedMergeIds.filter((id) => !nonPrimaries.find((a) => a.id === id));
  if (missingIds.length > 0) {
    return Response.json(
      { error: `Actors nicht gefunden: ${missingIds.join(", ")}` },
      { status: 404 },
    );
  }

  // Ownership-Guard: Admin darf global (ownerUserId=null) oder eigene Actors
  // mergen. Wir blockieren Merges ueber fremde ownerUserIds — sonst koennte
  // ein Admin die Daten eines anderen Users kassieren.
  const adminUserId = session.user.id;
  for (const a of [primary, ...nonPrimaries]) {
    if (a.ownerUserId !== null && a.ownerUserId !== adminUserId) {
      return Response.json(
        { error: `Actor '${a.id}' gehoert einem anderen User und kann nicht gemergt werden.` },
        { status: 403 },
      );
    }
  }

  // Preview-Daten fuer Dubletten die an beiden Seiten in derselben Show
  // stehen — dort muss der non-primary ShowActor geloescht statt umgeheangt
  // werden. Wir brauchen die Liste fuer dryRun-UI.
  const primaryShowIds = new Set(
    (
      await prisma.showActor.findMany({
        where: { actorId: primaryId },
        select: { showId: true },
      })
    ).map((s) => s.showId),
  );

  const nonPrimaryShowActors = await prisma.showActor.findMany({
    where: { actorId: { in: dedupedMergeIds } },
    select: { id: true, showId: true, actorId: true },
  });

  const collisions = nonPrimaryShowActors.filter((s) => primaryShowIds.has(s.showId));
  const reassigns = nonPrimaryShowActors.filter((s) => !primaryShowIds.has(s.showId));

  // Baue Variants (nur die non-primaries die visuell etwas beitragen).
  const newVariants: VisualVariant[] = [];
  for (const a of nonPrimaries) {
    const v = buildVariant({
      id: a.id,
      displayName: a.displayName,
      style: a.style,
      portraitUrl: a.portraitUrl,
      characterSheet: a.characterSheet,
      outfit: a.outfit,
      traits: a.traits,
      tags: a.tags,
    });
    if (v) newVariants.push(v);
  }

  // Append an existing primary.visualVariants (nicht ueberschreiben!).
  const existingVariants = Array.isArray(primary.visualVariants)
    ? (primary.visualVariants as unknown[])
    : [];
  const mergedVariants = [...existingVariants, ...newVariants];

  const preview = {
    primary: {
      id: primary.id,
      displayName: primary.displayName,
      ownerUserId: primary.ownerUserId,
      hasSeedOwnership: primary.ownerUserId === null,
      existingVariantCount: existingVariants.length,
    },
    nonPrimaries: nonPrimaries.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      ownerUserId: a.ownerUserId,
      isSeedActor: a.ownerUserId === null,
      showCount: a._count.shows,
      digitalActorAliasCount: a._count.digitalActorAliases,
      contributesVariant: newVariants.some((v) => v.sourceActorId === a.id),
    })),
    showActorMoves: {
      reassignCount: reassigns.length,
      collisionCount: collisions.length,
      collisionShows: collisions.map((c) => c.showId),
    },
    newVariantCount: newVariants.length,
    totalVariantCountAfterMerge: mergedVariants.length,
  };

  if (dryRun) {
    return Response.json({ dryRun: true, preview });
  }

  // ── Mutation (Transaction) ─────────────────────────────────────
  // Reihenfolge wichtig:
  //   1. ShowActor reassigns (update actorId → primary)
  //   2. ShowActor collisions (delete non-primary rows)
  //   3. DigitalActor.actorId repoint → primary
  //   4. Primary.visualVariants update
  //   5. Delete non-primary Actor rows
  //
  // Schritt 3 ist noetig weil onDelete:SetNull den Link sonst kappt — wir
  // wollen aber die Bridge behalten, damit StudioCharacter-Assets des
  // alten DigitalActors weiter auf den Unified-Actor zeigen.

  const result = await prisma.$transaction(async (tx) => {
    // 1. Reassigns
    if (reassigns.length > 0) {
      await tx.showActor.updateMany({
        where: { id: { in: reassigns.map((r) => r.id) } },
        data: { actorId: primaryId },
      });
    }

    // 2. Collision deletes
    if (collisions.length > 0) {
      await tx.showActor.deleteMany({
        where: { id: { in: collisions.map((c) => c.id) } },
      });
    }

    // 3. DigitalActor repoint
    const digitalRepointed = await tx.digitalActor.updateMany({
      where: { actorId: { in: dedupedMergeIds } },
      data: { actorId: primaryId },
    });

    // 4. Primary visualVariants update
    await tx.actor.update({
      where: { id: primaryId },
      data: {
        visualVariants: mergedVariants as Prisma.InputJsonValue,
      },
    });

    // 5. Delete non-primaries
    const deleted = await tx.actor.deleteMany({
      where: { id: { in: dedupedMergeIds } },
    });

    return {
      reassignedShowActors: reassigns.length,
      deletedCollisionShowActors: collisions.length,
      repointedDigitalActors: digitalRepointed.count,
      deletedActors: deleted.count,
      newVariantCount: newVariants.length,
    };
  });

  return Response.json({
    dryRun: false,
    preview,
    result,
  });
}
