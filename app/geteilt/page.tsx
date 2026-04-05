"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StoryCard from "../components/StoryCard";
import { STORY_FORMATE, StoryFormat } from "@/lib/types";
import PageTransition from "../components/PageTransition";

interface SharedStory {
  id: string;
  format: string;
  ziel: string;
  titel?: string;
  zusammenfassung?: string;
  audioUrl?: string;
  audioDauerSek?: number;
  timeline?: Array<{ characterId: string; startMs: number; endMs: number }>;
  shareSlug: string;
  createdAt: string;
  kindProfil: {
    name: string;
    alter: number;
    geschlecht?: string;
  };
}

export default function GeteiltPage() {
  const router = useRouter();
  const [stories, setStories] = useState<SharedStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/geschichten")
      .then((res) => res.json())
      .then((all: SharedStory[]) => {
        // Nur geteilte Geschichten (mit shareSlug)
        setStories(all.filter((g) => g.shareSlug));
      })
      .finally(() => setLoading(false));
  }, []);

  const getTitle = (g: SharedStory) => {
    if (g.titel) return g.titel;
    const formatInfo = STORY_FORMATE[g.format as StoryFormat];
    return `${formatInfo?.label || g.format} für ${g.kindProfil.name}`;
  };

  const copyShareLink = async (g: SharedStory) => {
    const url = `${window.location.origin}/share/${g.shareSlug}`;
    if (navigator.share) {
      await navigator.share({ title: getTitle(g), url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link kopiert!");
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex flex-col items-center px-4 py-6">
        <div className="w-full max-w-3xl">
          <div className="h-7 w-40 rounded bg-white/5 shimmer mb-6" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-white/5 shimmer" />)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <PageTransition>
      <main className="flex-1 flex flex-col items-center px-4 py-6 pb-24 md:pb-6">
        <div className="w-full max-w-3xl">
          <h1 className="text-xl font-bold mb-6">Geteilte Geschichten</h1>

          {stories.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-4">🔗</div>
              <p className="text-white/50 text-lg mb-2">Noch keine geteilten Geschichten</p>
              <p className="text-white/30 text-sm mb-6">
                Teile eine Geschichte aus deiner Bibliothek — der Link kann ohne Login angehört werden.
              </p>
              <button
                className="btn-primary text-sm"
                onClick={() => router.push("/geschichten")}
              >
                Zur Bibliothek
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {stories.map((g) => (
                <StoryCard
                  key={g.id}
                  id={g.id}
                  titel={g.titel}
                  format={g.format}
                  zusammenfassung={g.zusammenfassung}
                  audioDauerSek={g.audioDauerSek}
                  audioUrl={g.audioUrl}
                  timeline={g.timeline}
                  kindName={g.kindProfil.name}
                  createdAt={g.createdAt}
                  onPlay={() => router.push(`/geschichten`)}
                  onAddToQueue={() => {}}
                  onOpenFullView={() => router.push(`/story/result?id=${g.id}`)}
                  onDelete={() => {}}
                  onShare={() => copyShareLink(g)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </PageTransition>
  );
}
