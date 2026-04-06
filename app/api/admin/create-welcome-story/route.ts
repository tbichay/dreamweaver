import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ONBOARDING_STORY_TEXT, ONBOARDING_STORY_TITLE } from "@/lib/onboarding-story";
import { list } from "@vercel/blob";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tom@bichay.de";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userId = session.user.id!;

  // Check if welcome story already exists
  const existing = await prisma.geschichte.findFirst({
    where: { titel: ONBOARDING_STORY_TITLE, userId },
  });

  if (existing) {
    return Response.json({ message: "Welcome story already exists", geschichteId: existing.id });
  }

  // Get first profile for this user
  const profile = await prisma.hoererProfil.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return Response.json({ error: "No profile found" }, { status: 400 });
  }

  // Find onboarding audio blob URL
  const { blobs } = await list({ prefix: "audio/onboarding-willkommen", limit: 5 });
  const audioBlob = blobs.find((b) => b.pathname.endsWith(".mp3") || b.pathname.endsWith(".wav"));

  if (!audioBlob) {
    return Response.json({ error: "Onboarding audio not found" }, { status: 404 });
  }

  // Load timeline
  let timeline = null;
  try {
    const timelineBlobs = await list({ prefix: "audio/onboarding-willkommen", limit: 5 });
    const timelineBlob = timelineBlobs.blobs.find((b) => b.pathname.endsWith(".json"));
    if (timelineBlob) {
      const res = await fetch(timelineBlob.downloadUrl);
      if (res.ok) timeline = await res.json();
    }
  } catch {
    // Timeline optional
  }

  // Calculate duration from timeline
  const audioDauerSek = timeline && Array.isArray(timeline) && timeline.length > 0
    ? timeline[timeline.length - 1].endMs / 1000
    : undefined;

  // Create Geschichte
  const geschichte = await prisma.geschichte.create({
    data: {
      hoererProfilId: profile.id,
      userId,
      format: "einführung",
      ziel: "empathie",
      dauer: "lang",
      titel: ONBOARDING_STORY_TITLE,
      text: ONBOARDING_STORY_TEXT,
      audioUrl: audioBlob.url,
      audioDauerSek,
      timeline: timeline ? JSON.parse(JSON.stringify(timeline)) : undefined,
      zusammenfassung: "Koda und seine Freunde stellen sich vor — jeder Charakter mit seiner eigenen Stimme.",
    },
  });

  console.log(`[Welcome] Created story: ${geschichte.id}, audio: ${audioBlob.pathname}, duration: ${audioDauerSek}s`);

  return Response.json({
    geschichteId: geschichte.id,
    titel: ONBOARDING_STORY_TITLE,
    audioDauerSek,
    message: "Welcome story created! You can now generate a film from it.",
  });
}
