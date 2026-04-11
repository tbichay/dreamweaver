/**
 * Studio Story Generation API — Generate story from brief (SSE streaming)
 *
 * POST: Generate a story from a StoryBrief, stream text chunks via SSE
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateStory, type StoryBrief } from "@/lib/studio/story-generator";

export const maxDuration = 800;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    brief: StoryBrief;
    projectId?: string; // Optional: save directly to project
  };

  if (!body.brief?.theme) {
    return Response.json({ error: "Brief mit Thema erforderlich" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* */ }
      };

      // Track task in DB for cross-device visibility
      const { createTask } = await import("@/lib/studio/task-tracker");
      const task = await createTask(session.user!.id!, "story", body.projectId, { theme: body.brief.theme }, 2);

      send({ progress: "Generiere Geschichte...", taskId: task.id });
      const keepAlive = setInterval(() => send({ progress: "writing..." }), 5000);

      try {
        await task.progress("Generiere Geschichte...", 10);
        const result = await generateStory(body.brief, (chunk) => {
          send({ chunk });
        });

        // Save to project if projectId provided
        if (body.projectId) {
          await prisma.studioProject.update({
            where: { id: body.projectId, userId: session.user!.id! },
            data: {
              ...(result.title && { name: result.title }),
              storyText: result.text,
              storySource: "ai",
              language: result.language,
              description: body.brief.theme,
            },
          });
        }

        clearInterval(keepAlive);
        await task.complete({ title: result.title, wordCount: result.wordCount });
        send({
          done: true,
          title: result.title,
          text: result.text,
          wordCount: result.wordCount,
          estimatedDurationSec: result.estimatedDurationSec,
          characters: result.characters,
        });
      } catch (err) {
        clearInterval(keepAlive);
        const errorMsg = err instanceof Error ? err.message : "Fehler bei Story-Generierung";
        console.error("[GenerateStory] Error:", err);
        await task.fail(errorMsg);
        send({ done: true, error: errorMsg });
      }
      try { controller.close(); } catch { /* */ }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
