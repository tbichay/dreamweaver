"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { StoryConfig } from "@/lib/types";
import { berechneAlter } from "@/lib/utils";
import { useProfile } from "@/lib/profile-context";
import Stars from "../components/Stars";
import PageTransition from "../components/PageTransition";
import StoryConfigurator from "../components/StoryConfigurator";

function StoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyProfilId = searchParams.get("profilId");
  const { activeProfile, profiles, loading, setActiveProfile } = useProfile();

  // Backwards-kompatibel: ?profilId= in URL → setActiveProfile + URL bereinigen
  useEffect(() => {
    if (legacyProfilId && profiles.length > 0) {
      setActiveProfile(legacyProfilId);
      window.history.replaceState(null, "", "/story");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyProfilId, profiles]);

  const handleGenerate = (config: StoryConfig) => {
    sessionStorage.setItem("koalatree-config", JSON.stringify(config));
    router.push("/story/result");
  };

  // Loading state
  if (loading) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 pb-24 sm:pb-8">
        <Stars />
        <div className="text-white/40">Laden...</div>
      </main>
    );
  }

  // No profiles exist → prompt to create one
  if (profiles.length === 0) {
    return (
      <PageTransition>
        <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 pb-24 sm:pb-8">
          <Stars />
          <div className="relative z-10 text-center max-w-md">
            <div className="mx-auto mb-4 w-24 h-24 relative">
              <Image src="/api/images/koda-waving.png" alt="Koda" fill className="object-contain rounded-2xl" unoptimized />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-[#f5eed6]">Willkommen!</h2>
            <p className="text-white/50 mb-6">
              Erstelle zuerst ein Profil, damit Koda die perfekte Geschichte erzählen kann.
            </p>
            <button
              className="btn-primary text-lg px-8 py-3"
              onClick={() => router.push("/dashboard?new=1")}
            >
              Profil erstellen
            </button>
          </div>
        </main>
      </PageTransition>
    );
  }

  // Profile exists
  if (!activeProfile) return null;

  const alter = activeProfile.geburtsdatum
    ? berechneAlter(activeProfile.geburtsdatum)
    : activeProfile.alter ?? 5;

  // Shared profile without story creation permission
  const canCreate = !activeProfile.isShared || activeProfile.sichtbarkeit?.includes("geschichten-erstellen");

  if (!canCreate) {
    return (
      <PageTransition>
        <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 pb-24 sm:pb-8">
          <Stars />
          <div className="relative z-10 text-center max-w-md">
            <div className="mx-auto mb-4 w-24 h-24 relative">
              <Image src="/api/images/koda-waving.png" alt="Koda" fill className="object-contain rounded-2xl" unoptimized />
            </div>
            <h2 className="text-xl font-bold mb-2 text-[#f5eed6]">Nur zum Anhören</h2>
            <p className="text-white/50 mb-4">
              Du hast Zugang zu {activeProfile.name}s Geschichten, aber keine Berechtigung neue zu erstellen.
            </p>
            <button
              className="btn-primary text-sm px-6 py-2"
              onClick={() => router.push("/geschichten")}
            >
              Zur Bibliothek
            </button>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="relative flex-1 flex flex-col items-center px-4 py-8 pb-24 sm:pb-8">
        <Stars />
        <div className="relative z-10 w-full max-w-2xl">
          <StoryConfigurator
            kindProfilId={activeProfile.id}
            kindName={activeProfile.name}
            alter={alter}
            onGenerate={handleGenerate}
          />
        </div>
      </main>
    </PageTransition>
  );
}

export default function StoryPage() {
  return (
    <Suspense>
      <StoryPageContent />
    </Suspense>
  );
}
