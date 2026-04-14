/**
 * Duplicate a Digital Actor — creates a copy with optional style change.
 *
 * POST: { actorId, newStyle?: string, newName?: string }
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    actorId: string;
    newStyle?: string;  // "pixar-3d" | "realistic" | "anime" | etc.
    newName?: string;    // Override name, default: "Name (Kopie)"
  };

  if (!body.actorId) {
    return Response.json({ error: "actorId ist erforderlich" }, { status: 400 });
  }

  // Load source actor
  const source = await prisma.digitalActor.findFirst({
    where: { id: body.actorId, userId: session.user.id },
  });
  if (!source) return Response.json({ error: "Actor nicht gefunden" }, { status: 404 });

  // Build new name
  const styleSuffix = body.newStyle
    ? ` (${body.newStyle === "pixar-3d" ? "Pixar 3D" : body.newStyle === "realistic" ? "Realistisch" : body.newStyle === "anime" ? "Anime" : body.newStyle})`
    : " (Kopie)";
  const newName = body.newName || `${source.name}${styleSuffix}`;

  // Create duplicate
  const duplicate = await prisma.digitalActor.create({
    data: {
      userId: session.user.id,
      name: newName,
      description: source.description,
      voiceDescription: source.voiceDescription,
      voiceId: source.voiceId,
      voiceSettings: source.voiceSettings ? JSON.parse(JSON.stringify(source.voiceSettings)) : undefined,
      voicePreviewUrl: source.voicePreviewUrl,
      portraitAssetId: source.portraitAssetId, // Keep same portrait initially
      style: body.newStyle || source.style,
      outfit: source.outfit,
      traits: source.traits,
      tags: [...(source.tags || []), "duplicated"],
    },
  });

  return Response.json({
    actor: duplicate,
    message: `Actor "${newName}" erstellt — Portrait kann jetzt im neuen Stil generiert werden`,
  }, { status: 201 });
}
