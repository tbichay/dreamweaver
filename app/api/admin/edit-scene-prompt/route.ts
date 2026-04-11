import { auth } from "@/lib/auth";
import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient } from "@/lib/ai-clients";

const anthropic = createAnthropicClient();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tom@bichay.de";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { currentDescription, userInstruction, characterId, sceneType } = await request.json();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `Du bist ein Animations-Regisseur. Du bearbeitest Szenen-Beschreibungen fuer einen KoalaTree-Animationsfilm.

Stil: Disney 1994 (Lion King), warme Farben, 2D Animation, lebendige Tier-Charaktere.

Die KoalaTree-Charaktere:
- Koda: alter weiser Koala mit goldener Brille, klettert langsam
- Kiki: frecher Kookaburra, fliegt und flattert
- Luna: traeumerische Eule, erscheint bei Nacht
- Mika: mutiger Dingo, rennt und springt am Boden
- Pip: neugieriges Schnabeltier, taucht aus dem Wasser auf
- Sage: weiser Wombat, meditiert zwischen den Wurzeln
- Nuki: froehlicher Quokka, huepft und springt

Der User gibt dir eine Anweisung wie die Szene geaendert werden soll. Gib NUR die neue sceneDescription zurueck — 2-3 Saetze, fokussiert auf BEWEGUNG und AKTION. Kein JSON, kein Markdown, nur der Text.`,
      messages: [{
        role: "user",
        content: `Aktuelle Szene (${sceneType}, Charakter: ${characterId || "keiner"}):
"${currentDescription}"

Anweisung: "${userInstruction}"

Neue Szenen-Beschreibung:`
      }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^["']|["']$/g, ""); // Remove surrounding quotes if any

    return Response.json({ newDescription: text });
  } catch (error) {
    console.error("[Edit Scene]", error);
    return Response.json({ error: "Fehler" }, { status: 500 });
  }
}
