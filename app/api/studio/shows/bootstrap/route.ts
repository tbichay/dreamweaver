/**
 * Show-Bootstrap — "One prompt → complete Show draft"
 *
 * Input:  user-written Beschreibung (what the show is about, who it's for)
 *        + selected Actor IDs (they're committed to be in the show)
 *
 * Output: a Show draft object (NOT persisted yet) that the admin reviews
 *         and either saves, edits, or discards. Persistence happens via a
 *         second call to POST /api/studio/shows with the approved draft.
 *
 * Why not create-and-show: the admin needs the chance to rename, rewrite
 * the brandVoice, pick a different set of Foki, etc. before committing.
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
    actorIds: string[];
    category?: string; // "kids"|"wellness"|"knowledge"
    ageBand?: string;
  };

  if (!body.beschreibung?.trim()) {
    return Response.json({ error: "Beschreibung fehlt" }, { status: 400 });
  }
  if (!Array.isArray(body.actorIds) || body.actorIds.length === 0) {
    return Response.json({ error: "Mindestens ein Actor auswählen" }, { status: 400 });
  }

  // Load actors + templates so Claude has concrete IDs to reference
  const [actors, templates] = await Promise.all([
    prisma.actor.findMany({
      where: { id: { in: body.actorIds } },
    }),
    prisma.fokusTemplate.findMany({
      where: body.category
        ? { supportedCategories: { has: body.category } }
        : undefined,
      orderBy: { minAlter: "asc" },
    }),
  ]);

  if (actors.length === 0) {
    return Response.json({ error: "Keiner der Actor-IDs existiert" }, { status: 400 });
  }

  const actorTable = actors
    .map((a) => `- ${a.id} — ${a.displayName} (${a.species ?? "—"}), Rolle: ${a.role ?? "—"}, Expertise: [${a.expertise.join(", ")}], Tone: ${a.defaultTone ?? "—"}. ${a.description ?? ""}`)
    .join("\n");

  const templateTable = templates
    .map((t) => `- ${t.id} — ${t.displayName} (${t.emoji ?? ""}), Alter ${t.minAlter}+, Kategorien [${t.supportedCategories.join(",")}]. ${t.description ?? ""}`)
    .join("\n");

  const systemPrompt = `Du bist Show-Director für KoalaTree. Der Admin beschreibt eine neue Show und wählt Actors aus dem bestehenden Ensemble. Du erzeugst einen kompletten Show-Draft als JSON.

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
6. brandVoice: Prompt-Overlay, 3–5 Sätze. Beschreibt Ton, Stil, Do's + Don'ts für alle Geschichten dieser Show. Wird bei JEDER Generation zusätzlich zum Fokus-Skeleton injiziert. Sei konkret — "warm, bildhaft, keine Gewalt, Tiere sprechen sanft". NICHT generisch.
7. palette: { bg, ink, accent } als Hex. Passend zum Show-Ton.
8. suggestedFokusTemplateIds: 2–6 Template-IDs aus der Liste oben, die zu dieser Show passen. Mehrere Foki sind OK und sogar gewollt (z.B. eine Wellness-Show hat Meditation + Affirmation + Reflexion).
9. suggestedCastRoles: für JEDEN vom Admin gewählten Actor ein Eintrag mit { actorId, role, reasoning }. role ist semantisch auf Show-Ebene (z.B. "host", "side-kick", "guest-teacher"). reasoning 1 Satz.
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

  const userPrompt = `Admin-Beschreibung:\n"""\n${body.beschreibung.trim()}\n"""\n\nGewählte Actor-IDs: ${body.actorIds.join(", ")}\n${body.category ? `Kategorie-Hint: ${body.category}` : ""}\n${body.ageBand ? `AgeBand-Hint: ${body.ageBand}` : ""}`;

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
