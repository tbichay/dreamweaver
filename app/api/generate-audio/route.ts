import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { generateAudio } from "@/lib/elevenlabs";

export const maxDuration = 120; // Allow up to 2 minutes for audio generation

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { text, geschichteId } = (await request.json()) as {
      text: string;
      geschichteId?: string;
    };

    if (!text) {
      return Response.json({ error: "Text ist erforderlich" }, { status: 400 });
    }

    const audioBuffer = await generateAudio(text);

    // Try Vercel Blob upload if configured
    let audioUrl: string | undefined;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        const blob = await put(
          `audio/${geschichteId || Date.now()}.mp3`,
          Buffer.from(audioBuffer),
          { access: "public", contentType: "audio/mpeg" }
        );
        audioUrl = blob.url;
        console.log(`[Blob] Uploaded: ${blob.url}`);

        if (geschichteId) {
          await prisma.geschichte.update({
            where: { id: geschichteId },
            data: { audioUrl: blob.url },
          });
        }
      } catch (blobError) {
        console.error("[Blob] Upload failed, returning raw audio:", blobError);
        // Fall through to raw audio response
      }
    }

    if (audioUrl) {
      return Response.json({ audioUrl });
    }

    // Fallback: return raw audio directly
    // Also save geschichteId marker so frontend knows audio exists
    if (geschichteId) {
      await prisma.geschichte.update({
        where: { id: geschichteId },
        data: { audioUrl: "local" },
      });
    }

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Audio generation error:", error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return Response.json(
      { error: `Audio-Generierung fehlgeschlagen: ${message}` },
      { status: 500 }
    );
  }
}
