import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { STORY_FORMATE, PAEDAGOGISCHE_ZIELE, StoryFormat, PaedagogischesZiel } from "@/lib/types";
import type { Metadata } from "next";
import SharedStoryPlayer from "./SharedStoryPlayer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await prisma.geschichte.findUnique({
    where: { shareSlug: slug },
    include: { hoererProfil: { select: { name: true } } },
  });

  if (!story) return { title: "Geschichte nicht gefunden" };

  const title = story.titel || "Eine KoalaTree Geschichte";
  const description = story.zusammenfassung || `Eine persönliche Geschichte für ${story.hoererProfil.name}, erzählt vom weisen Koala Koda.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | KoalaTree`,
      description,
      type: "music.song",
      siteName: "KoalaTree",
      locale: "de_DE",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SharedStoryPage({ params }: Props) {
  const { slug } = await params;

  const story = await prisma.geschichte.findUnique({
    where: { shareSlug: slug },
    include: {
      hoererProfil: {
        select: { name: true, geburtsdatum: true, geschlecht: true },
      },
    },
  });

  if (!story) notFound();

  const formatInfo = STORY_FORMATE[story.format as StoryFormat];
  const zielInfo = PAEDAGOGISCHE_ZIELE[story.ziel as PaedagogischesZiel];
  const title = story.titel || `${formatInfo?.label || story.format} für ${story.hoererProfil.name}`;

  // Calculate age
  let age: string | null = null;
  if (story.hoererProfil.geburtsdatum) {
    const years = Math.floor(
      (Date.now() - new Date(story.hoererProfil.geburtsdatum).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    age = `${years} Jahre`;
  }

  const timeline = (story.timeline as Array<{ characterId: string; startMs: number; endMs: number }>) || [];
  const hasAudio = story.audioUrl && story.audioUrl !== "local" && story.audioUrl.length > 10;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <nav className="sticky top-0 z-30 bg-[#1a2e1a]/90 backdrop-blur-sm border-b border-white/5 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="KoalaTree" height={32} width={110} className="object-contain" />
          </Link>
          <Link
            href="/sign-up"
            className="btn-primary text-sm px-4 py-2"
          >
            Eigene Geschichte erstellen
          </Link>
        </div>
      </nav>

      {/* Story Content */}
      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-3xl">

          {/* Player */}
          {hasAudio && timeline.length > 0 && (
            <div className="mb-6">
              <SharedStoryPlayer
                audioUrl={`/api/audio/${story.id}`}
                timeline={timeline}
                title={title}
                knownDuration={story.audioDauerSek || undefined}
              />
            </div>
          )}

          {/* Story Info */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-[#f5eed6] mb-3">{title}</h1>

            <div className="flex items-center gap-2 flex-wrap text-sm text-white/40 mb-4">
              <span>Erstellt für <strong className="text-white/60">{story.hoererProfil.name}</strong></span>
              {age && (
                <>
                  <span>·</span>
                  <span>{age}</span>
                </>
              )}
              <span>·</span>
              <span>{formatInfo?.emoji} {formatInfo?.label}</span>
              <span>·</span>
              <span>{zielInfo?.emoji} {zielInfo?.label}</span>
            </div>

            {story.zusammenfassung && (
              <p className="text-white/50 leading-relaxed mb-4">{story.zusammenfassung}</p>
            )}

            {story.besonderesThema && (
              <div className="inline-block px-3 py-1 bg-white/5 rounded-full text-xs text-white/40">
                Thema: {story.besonderesThema}
              </div>
            )}
          </div>

          {/* CTA Banner */}
          <div className="card p-8 text-center mt-8">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <Image
                src="/api/images/koda-portrait.png"
                alt="Koda"
                fill
                className="object-contain rounded-2xl"
                unoptimized
              />
            </div>
            <h2 className="text-xl font-bold text-[#f5eed6] mb-2">
              Koda erzählt auch dir eine Geschichte
            </h2>
            <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
              Personalisierte Gute-Nacht-Geschichten und Audio-Hörspiele — einzigartig für dein Kind.
            </p>
            <Link
              href="/sign-up"
              className="btn-primary text-lg px-8 py-3 inline-block"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 px-4 text-center border-t border-white/5">
        <nav className="flex items-center justify-center gap-4 text-white/30 text-xs">
          <Link href="/impressum" className="hover:text-white/50 transition-colors">Impressum</Link>
          <span>·</span>
          <Link href="/datenschutz" className="hover:text-white/50 transition-colors">Datenschutz</Link>
          <span>·</span>
          <Link href="/agb" className="hover:text-white/50 transition-colors">AGB</Link>
        </nav>
      </footer>
    </main>
  );
}
