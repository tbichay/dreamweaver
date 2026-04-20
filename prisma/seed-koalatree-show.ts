/**
 * KoalaTree — Flagship Show Seed (slug: "koalatree-ai")
 *
 * Seeds the one Show that represents the live product as-is: Koda + six
 * sidekicks (Kiki, Luna, Mika, Pip, Sage, Nuki) plus all 15 Foki from
 * STORY_FORMATE. This is the manual counterpart to the future AI-first
 * Show-Wizard (S2): KoalaTree itself is the one Show we know by heart,
 * so we encode it deterministically rather than generating it through
 * the wizard.
 *
 * Sources of truth encoded here:
 *   - Palette: BRAND.md §1 Farbpalette
 *   - Cast roles: KONZEPT.md §3 (Koda = central narrator, Kiki = cohost)
 *   - Foki: all FokusTemplate rows that exist at seed time (= the 15
 *     STORY_FORMATE from lib/types.ts, seeded via seed-shows.ts)
 *
 * Dependencies:
 *   - prisma/seed-shows.ts must have run first (Actors + FokusTemplates)
 *   - A User row with email = ADMIN_EMAIL must exist (sign in once via UI)
 *
 * Idempotent: upsert on unique keys (Show.slug, ShowActor+ShowFokus
 * compound uniques). Re-running refreshes brand + prompt fields but
 * preserves manual tweaks to coverUrl, publishedAt, and
 * featuredShowFokusId once set.
 *
 * Run: npx tsx prisma/seed-koalatree-show.ts
 */

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "tom@bichay.de").toLowerCase();
const SLUG = "koalatree-ai";

// ── Show-level constants ────────────────────────────────────────

const TITLE = "KoalaTree";
const SUBTITLE = "Dein weiser Freund im Baum";

const DESCRIPTION =
  "KoalaTree ist eine warme Welt, in der der weise Koala Koda Kindern (und Erwachsenen) personalisierte Geschichten erzählt. Sechs Tierfreunde — Kiki, Luna, Mika, Pip, Sage und Nuki — ergänzen ihn mit eigener Stimme und eigenem Fokus. Jede Geschichte beginnt und endet am leuchtenden Eukalyptusbaum.";

// Applied as overlay on top of every FokusTemplate.systemPromptSkeleton
// when generating episodes. Keep it short — the Fokus-level prompts are
// already long, this just sets the show-wide voice.
const BRAND_VOICE = [
  "KoalaTree-Geschichten beginnen und enden immer am leuchtenden Eukalyptusbaum.",
  "Koda ist der warme, großväterliche Anker — er begrüßt den Hörer beim Namen und entlässt ihn mit einer sanften Botschaft.",
  "Die anderen Tiere (Kiki, Luna, Mika, Pip, Sage, Nuki) tauchen als Gäste auf, jeder mit eigener Stimme und Rolle.",
  "Pädagogische Kernbotschaften (Mut, Achtsamkeit, Dankbarkeit, Selbstbewusstsein) werden NIE direkt benannt — sie werden in die Handlung verwoben, wie Samen die der Koala pflanzt.",
  "Ton: warm, meditativ, niemals belehrend.",
].join(" ");

// From BRAND.md §1 Farbpalette — bg/ink/accent subset that the Show
// schema expects. Full palette lives in the app's Tailwind theme.
const PALETTE = {
  bg: "#1a2e1a", // Waldgrün (Hintergrund dunkel)
  ink: "#f5eed6", // Cream (Text auf Dunkel)
  accent: "#d4a853", // Warm Gold (Koala-Glow, Highlights)
};

const BUDGET_MINUTES = 60;

// ── Cast configuration ──────────────────────────────────────────
//
// ShowActor.role is a semantic hint (host | cohost | guest) that the
// prompter uses to gate stage-time. Per KONZEPT.md §3:
//  - Koda opens/closes EVERY story → "host"
//  - Kiki is Kodas beste Freundin, second-most-frequent voice → "cohost"
//  - The others lead their own Foki but aren't always on stage → "guest"
//
// orderIndex drives display order in the cast UI.

const CAST: ReadonlyArray<{
  actorId: string;
  role: "host" | "cohost" | "guest";
  orderIndex: number;
}> = [
  { actorId: "koda", role: "host", orderIndex: 0 },
  { actorId: "kiki", role: "cohost", orderIndex: 1 },
  { actorId: "luna", role: "guest", orderIndex: 2 },
  { actorId: "mika", role: "guest", orderIndex: 3 },
  { actorId: "pip", role: "guest", orderIndex: 4 },
  { actorId: "sage", role: "guest", orderIndex: 5 },
  { actorId: "nuki", role: "guest", orderIndex: 6 },
];

// Which Fokus is the Canzoia UI default? Traumreise is the most
// universal (2-99, Luna as lead) and matches KONZEPT.md §4's primary
// story format. Only set on INITIAL seed — manual overrides are kept.
const FEATURED_FOKUS_TEMPLATE_ID = "traumreise";

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Deterministic sha256 over the fields that define the Show "revision".
 * Used to detect when generated episodes belong to an outdated snapshot
 * — see Show.revisionHash + ShowEpisode.showRevisionHash.
 */
function computeRevisionHash(input: {
  brandVoice: string;
  cast: typeof CAST;
  fokusIds: readonly string[];
}): string {
  const payload = [
    SLUG,
    input.brandVoice,
    input.cast
      .map((c) => `${c.actorId}:${c.role}:${c.orderIndex}`)
      .sort()
      .join(","),
    [...input.fokusIds].sort().join(","),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  KoalaTree Flagship-Show Seed (koalatree-ai)");
  console.log("═══════════════════════════════════════════");

  // 1. Resolve owner
  const owner = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  if (!owner) {
    throw new Error(
      `No User found with email ${ADMIN_EMAIL}. Sign in once via the live app (request a login code and verify it) so NextAuth creates the User row, then re-run this seed.`,
    );
  }
  console.log(`\n→ Owner: ${ADMIN_EMAIL} (${owner.id})`);

  // 2. Verify dependencies from seed-shows.ts
  const actorIds = CAST.map((c) => c.actorId);
  const presentActors = await prisma.actor.findMany({
    where: { id: { in: actorIds } },
    select: { id: true },
  });
  if (presentActors.length !== actorIds.length) {
    const missing = actorIds.filter(
      (id) => !presentActors.find((a) => a.id === id),
    );
    throw new Error(
      `Missing Actor rows: ${missing.join(", ")}. Run 'npx tsx prisma/seed-shows.ts' first.`,
    );
  }

  const templates = await prisma.fokusTemplate.findMany({
    orderBy: [{ minAlter: "asc" }, { id: "asc" }],
  });
  if (templates.length === 0) {
    throw new Error(
      `No FokusTemplate rows found. Run 'npx tsx prisma/seed-shows.ts' first.`,
    );
  }
  console.log(
    `→ Dependencies: ${presentActors.length} Actors, ${templates.length} FokusTemplates found`,
  );

  // 3. Compute revision and upsert the Show
  const revisionHash = computeRevisionHash({
    brandVoice: BRAND_VOICE,
    cast: CAST,
    fokusIds: templates.map((t) => t.id),
  });

  const existing = await prisma.show.findUnique({
    where: { slug: SLUG },
    select: { id: true, featuredShowFokusId: true },
  });
  const isFirstSeed = existing === null;

  const show = await prisma.show.upsert({
    where: { slug: SLUG },
    create: {
      slug: SLUG,
      title: TITLE,
      subtitle: SUBTITLE,
      description: DESCRIPTION,
      category: "kids",
      ageBand: null, // span 3-99 — single band would be a lie
      brandVoice: BRAND_VOICE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      palette: PALETTE as any,
      coverUrl: null, // filled later via the S2 wizard's cover-gen step
      budgetMinutes: BUDGET_MINUTES,
      ownerUserId: owner.id,
      publishedAt: new Date(),
      revisionHash,
    },
    update: {
      // Refresh brand/prompt fields on every re-seed so edits to the
      // constants above take effect. Don't touch coverUrl /
      // publishedAt / featuredShowFokusId — those are operator-owned
      // once set.
      title: TITLE,
      subtitle: SUBTITLE,
      description: DESCRIPTION,
      brandVoice: BRAND_VOICE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      palette: PALETTE as any,
      budgetMinutes: BUDGET_MINUTES,
      revisionHash,
    },
  });
  console.log(
    `\n→ Show: ${show.title} (id=${show.id}, revision=${revisionHash}, ${isFirstSeed ? "CREATED" : "UPDATED"})`,
  );

  // 4. Upsert ShowActors
  console.log(`\n→ Cast (${CAST.length})…`);
  for (const c of CAST) {
    await prisma.showActor.upsert({
      where: {
        showId_actorId: { showId: show.id, actorId: c.actorId },
      },
      create: {
        showId: show.id,
        actorId: c.actorId,
        role: c.role,
        orderIndex: c.orderIndex,
      },
      update: {
        role: c.role,
        orderIndex: c.orderIndex,
      },
    });
    console.log(`  ✓ ${c.actorId.padEnd(6)} as ${c.role}`);
  }

  // 5. Upsert ShowFoki — all 15 templates, each with its own defaults
  //    copied. orderIndex = age-ascending so kids see Kids-Foki first.
  console.log(`\n→ Foki (${templates.length})…`);
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    await prisma.showFokus.upsert({
      where: {
        showId_fokusTemplateId: {
          showId: show.id,
          fokusTemplateId: t.id,
        },
      },
      create: {
        showId: show.id,
        fokusTemplateId: t.id,
        showOverlay: "", // no per-Fokus override — brandVoice covers it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        castRoles: t.defaultCastRoles as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userInputSchema: t.defaultUserInputSchema as any,
        targetDurationMin: t.defaultDurationMin,
        orderIndex: i,
        enabled: true,
      },
      update: {
        // Re-seeds push the latest FokusTemplate defaults through.
        // When the Studio UI ships per-Fokus overrides, gate these
        // fields on a "manuallyEdited" flag to avoid clobbering.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        castRoles: t.defaultCastRoles as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userInputSchema: t.defaultUserInputSchema as any,
        targetDurationMin: t.defaultDurationMin,
        orderIndex: i,
      },
    });
    console.log(
      `  ✓ ${(t.emoji ?? "·").padEnd(2)} ${t.displayName.padEnd(24)} (${t.minAlter}+, ${t.defaultDurationMin} min)`,
    );
  }

  // 6. Set featuredShowFokusId only on initial seed — don't clobber
  //    operator choice on re-runs.
  if (isFirstSeed || existing?.featuredShowFokusId === null) {
    const featured = await prisma.showFokus.findUnique({
      where: {
        showId_fokusTemplateId: {
          showId: show.id,
          fokusTemplateId: FEATURED_FOKUS_TEMPLATE_ID,
        },
      },
      select: { id: true },
    });
    if (featured) {
      await prisma.show.update({
        where: { id: show.id },
        data: { featuredShowFokusId: featured.id },
      });
      console.log(
        `\n→ Featured Fokus: ${FEATURED_FOKUS_TEMPLATE_ID} (ShowFokus.id=${featured.id})`,
      );
    }
  } else {
    console.log(
      `\n→ Featured Fokus: preserved (${existing?.featuredShowFokusId})`,
    );
  }

  // 7. Summary
  const [castCount, fokiCount] = await Promise.all([
    prisma.showActor.count({ where: { showId: show.id } }),
    prisma.showFokus.count({ where: { showId: show.id } }),
  ]);

  console.log("\n───────────────────────────────────────────");
  console.log(`  ${TITLE} seeded: ${castCount} cast, ${fokiCount} Foki`);
  console.log(`  slug:     ${SLUG}`);
  console.log(`  revision: ${revisionHash}`);
  console.log("───────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
