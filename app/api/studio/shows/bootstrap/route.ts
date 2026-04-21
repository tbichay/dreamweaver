/**
 * Show-Bootstrap — "One prompt → complete Show draft"
 *
 * Input:  user-written Beschreibung (what the show is about, who it's for)
 *        + EITHER selected Actor IDs, OR autoCast=true to let Claude pick
 *        from the full Actor pool.
 *
 * Output: a Show draft object (NOT persisted yet) that the admin reviews
 *         and either saves, edits, or discards. Persistence happens via a
 *         second call to POST /api/studio/shows with the approved draft.
 *
 * Why not create-and-show: the admin needs the chance to rename, rewrite
 * the brandVoice, pick a different set of Foki, etc. before committing.
 *
 * Auto-Cast (2026-04-21): admin can ueberspringen den Actor-Picker, indem
 * `autoCast=true` gesendet wird — dann laedt Claude den kompletten Pool
 * und sucht 2-4 passende Actors mit Begruendung. Use-Case: "neue Show,
 * aber ich kenne den Pool noch nicht gut genug" bzw. onboarding fuer
 * weniger erfahrene Admins. suggestedCastRoles enthaelt dann die
 * Claude-Empfehlung, UI kann vor Save noch einzelne Actors rausnehmen.
 */

import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";
import { prisma } from "@/lib/db";
import { createAnthropicClient } from "@/lib/ai-clients";

const MODEL = "claude-sonnet-4-20250514";

type Draft = {
  title: string;
  subtitle: string;
  description: string;
  category: "kids" | "wellness" | "knowledge" | "other";
  ageBand: string | null;
  brandVoice: string;
  palette: { bg: string; ink: string; accent: string };
  suggestedFokusTemplateIds: string[];
  suggestedCastRoles: Array<{ actorId: string; role: string; reasoning: string }>;
  notesForAdmin: string;
};

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await request.json() as {
    beschreibung: string;
    actorIds?: string[];
    autoCast?: boolean;
    category?: string; // "kids"|"wellness"|"knowledge"
    ageBand?: string;
  };

  if (!body.beschreibung?.trim()) {
    return Response.json({ error: "Beschreibung fehlt" }, { status: 400 });
  }

  const autoCast = body.autoCast === true;
  const manualActorIds = Array.isArray(body.actorIds) ? body.actorIds : [];
  if (!autoCast && manualActorIds.length === 0) {
    return Response.json(
      { error: "Mindestens einen Actor auswaehlen oder 'Claude waehlen lassen' aktivieren" },
      { status: 400 },
    );
  }

  // Load actors + templates so Claude has concrete IDs to reference.
  // autoCast-Modus: den KOMPLETTEN Pool laden, damit Claude echt waehlen
  // kann. Ohne autoCast bleibt der pre-selected Satz wie gehabt.
  const [actors, templates] = await Promise.all([
    prisma.actor.findMany({
      where: autoCast ? undefined : { id: { in: manualActorIds } },
      orderBy: autoCast ? { displayName: "asc" } : undefined,
    }),
    prisma.fokusTemplate.findMany({
      where: body.category
        ? { supportedCategories: { has: body.category } }
        : undefined,
      orderBy: { minAlter: "asc" },
    }),
  ]);

  if (actors.length === 0) {
    return Response.json(
      { error: autoCast ? "Actor-Pool ist leer — erst Actors anlegen." : "Keiner der Actor-IDs existiert" },
      { status: 400 },
    );
  }

  // Build a rich actor dossier for Claude. Each character's deeper dimensions
  // (personality / speechStyle / catchphrases / backstory / relationships) are
  // appended as sub-lines only when populated, so legacy seed actors without
  // them still produce a compact single-line entry.
  const relationshipScope = autoCast ? actors.map((x) => x.id) : manualActorIds;
  const actorTable = actors
    .map((a) => {
      const headline = `- ${a.id} — ${a.displayName} (${a.species ?? "—"}), Rolle: ${a.role ?? "—"}, Expertise: [${a.expertise.join(", ")}], Tone: ${a.defaultTone ?? "—"}. ${a.description ?? ""}`;
      const extras: string[] = [];
      if (a.personality) extras.push(`    Wesen: ${a.personality}`);
      if (a.speechStyle) extras.push(`    Sprechweise: ${a.speechStyle}`);
      if (a.catchphrases.length > 0) {
        extras.push(`    Signature-Phrasen: ${a.catchphrases.map((p) => `"${p}"`).join(", ")}`);
      }
      if (a.backstory) extras.push(`    Hintergrund: ${a.backstory}`);
      const rels = a.relationships as Record<string, string> | null;
      if (rels && typeof rels === "object") {
        // In autoCast-Mode: Scope = kompletter Pool (Claude soll die
        // Dynamic wissen). Manual-Mode: nur pre-selected Actors.
        const entries = Object.entries(rels)
          .filter(([otherId]) => relationshipScope.includes(otherId))
          .map(([otherId, desc]) => `${otherId}: ${desc}`);
        if (entries.length > 0) extras.push(`    Beziehungen: ${entries.join("; ")}`);
      }
      return [headline, ...extras].join("\n");
    })
    .join("\n");

  const templateTable = templates
    .map((t) => `- ${t.id} — ${t.displayName} (${t.emoji ?? ""}), Alter ${t.minAlter}+, Kategorien [${t.supportedCategories.join(",")}]. ${t.description ?? ""}`)
    .join("\n");

  const castRule = autoCast
    ? `9. suggestedCastRoles: waehle aus dem Actor-Pool oben GENAU 2-4 Actors, die am besten zur Show passen — kein weniger, kein mehr. Eintraege { actorId, role, reasoning }. role ist semantisch auf Show-Ebene (z.B. "host", "side-kick", "guest-teacher"). reasoning 1-2 Saetze, warum genau dieser Actor passt (nutze personality/backstory/speechStyle/catchphrases als Argumente, nicht bloss expertise). Kombiniere Actors so, dass sie ENSEMBLE-TAUGLICH sind — existierende Beziehungen bevorzugen, wenn sie zum Thema passen.`
    : `9. suggestedCastRoles: fuer JEDEN vom Admin gewaehlten Actor ein Eintrag mit { actorId, role, reasoning }. role ist semantisch auf Show-Ebene (z.B. "host", "side-kick", "guest-teacher"). reasoning 1 Satz — falls vorhanden: nutze personality/backstory als Argument statt nur Expertise.`;

  const systemPrompt = `Du bist Show-Director für KoalaTree. Der Admin beschreibt eine neue Show${autoCast ? " — du waehlst die Actors selbst aus dem Ensemble." : " und waehlt Actors aus dem bestehenden Ensemble."} Du erzeugst einen kompletten Show-Draft als JSON.

VERFÜGBARE ACTORS (IDs sind fix, nutze sie exakt):
${actorTable}

VERFÜGBARE FOKUS-TEMPLATES (IDs sind fix):
${templateTable}

REGELN:
1. title: griffig, max. 40 Zeichen, deutsch oder englisch je nach Beschreibung.
2. subtitle: 1 Satz, max. 80 Zeichen.
3. description: 2–3 Sätze, beschreibt Show-Konzept für Canzoia-User.
4. category: genau einer von "kids"|"wellness"|"knowledge"|"other".
5. ageBand: "3-5"|"6-8"|"9-12"|"13+" oder null (null = kategorie-agnostisch wie Wellness).
6. brandVoice: Prompt-Overlay, 3–5 Sätze. Beschreibt Ton, Stil, Do's + Don'ts für alle Geschichten dieser Show. Wird bei JEDER Generation zusätzlich zum Fokus-Skeleton injiziert. Sei konkret — "warm, bildhaft, keine Gewalt, Tiere sprechen sanft". NICHT generisch. Wenn die Actors eine ausgearbeitete Sprechweise / Signature-Phrasen / Beziehungen haben: weave diese gezielt ein, statt sie zu wiederholen.
7. palette: { bg, ink, accent } als Hex. Passend zum Show-Ton.
8. suggestedFokusTemplateIds: 2–6 Template-IDs aus der Liste oben, die zu dieser Show passen. Mehrere Foki sind OK und sogar gewollt (z.B. eine Wellness-Show hat Meditation + Affirmation + Reflexion).
${castRule}
10. notesForAdmin: 1–3 Sätze mit Empfehlungen/Caveats (z.B. "Sage eher nicht für <6 Jahre").

Antworte NUR mit einem JSON-Objekt, kein Markdown, kein Prosa. Schema:
{
  "title": "…",
  "subtitle": "…",
  "description": "…",
  "category": "kids",
  "ageBand": "3-5",
  "brandVoice": "…",
  "palette": { "bg": "#…", "ink": "#…", "accent": "#…" },
  "suggestedFokusTemplateIds": ["…"],
  "suggestedCastRoles": [{ "actorId": "…", "role": "…", "reasoning": "…" }],
  "notesForAdmin": "…"
}`;

  const userPrompt = `Admin-Beschreibung:\n"""\n${body.beschreibung.trim()}\n"""\n\n${autoCast
    ? `Actor-Vorauswahl: AUTO — waehle 2-4 Actors aus dem Pool oben nach Regel #9.`
    : `Gewaehlte Actor-IDs: ${manualActorIds.join(", ")}`}\n${body.category ? `Kategorie-Hint: ${body.category}` : ""}\n${body.ageBand ? `AgeBand-Hint: ${body.ageBand}` : ""}`;

  const client = createAnthropicClient();
  let draft: Draft;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "Claude hat keinen Text geliefert" }, { status: 502 });
    }

    // Robust JSON extract — Claude occasionally wraps in ```json despite the instruction.
    const raw = textBlock.text;
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) {
      return Response.json({ error: "Kein JSON-Objekt in Claude-Antwort gefunden" }, { status: 502 });
    }
    draft = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Draft;
  } catch (err) {
    console.error("[shows/bootstrap]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Claude-Request fehlgeschlagen" },
      { status: 502 }
    );
  }

  // Minimal sanity-check: filter out hallucinated template IDs
  const validTemplateIds = new Set(templates.map((t) => t.id));
  draft.suggestedFokusTemplateIds = (draft.suggestedFokusTemplateIds || []).filter((id) =>
    validTemplateIds.has(id)
  );
  const validActorIds = new Set(actors.map((a) => a.id));
  draft.suggestedCastRoles = (draft.suggestedCastRoles || []).filter((c) => validActorIds.has(c.actorId));

  return Response.json({ draft });
}
