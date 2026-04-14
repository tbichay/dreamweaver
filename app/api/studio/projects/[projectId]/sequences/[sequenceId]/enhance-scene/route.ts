/**
 * Enhance a scene description using AI
 *
 * POST: User provides a correction/instruction, AI rewrites the scene description
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sequenceId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, sequenceId } = await params;
  const body = await request.json() as {
    sceneIndex: number;
    correction: string;
  };

  if (!body.correction?.trim()) {
    return Response.json({ error: "Korrektur fehlt" }, { status: 400 });
  }

  const sequence = await prisma.studioSequence.findFirst({
    where: { id: sequenceId, project: { id: projectId, userId: session.user.id } },
    include: { project: { include: { characters: true } } },
  });
  if (!sequence) return Response.json({ error: "Nicht gefunden" }, { status: 404 });

  const scenes = (sequence.scenes as unknown as Array<{
    sceneDescription: string;
    type: string;
    characterId?: string;
    location?: string;
  }>) || [];
  const scene = scenes[body.sceneIndex];
  if (!scene) return Response.json({ error: "Szene nicht gefunden" }, { status: 404 });

  // Find character info if available
  const character = scene.characterId
    ? sequence.project.characters.find((c) => c.id === scene.characterId || c.markerId === scene.characterId)
    : undefined;

  // Previous scene for context
  const prevScene = body.sceneIndex > 0 ? scenes[body.sceneIndex - 1] : undefined;

  const { enhanceSceneDescription } = await import("@/lib/studio/image-quality");
  const result = await enhanceSceneDescription({
    currentDescription: scene.sceneDescription,
    userCorrection: body.correction,
    sceneType: scene.type as "landscape" | "dialog" | "transition",
    characterName: character?.name,
    characterDescription: character?.description || undefined,
    location: scene.location || (sequence.location as string | undefined),
    previousSceneDescription: prevScene?.sceneDescription,
  });

  return Response.json(result);
}
