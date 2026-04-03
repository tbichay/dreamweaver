"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HoererProfil, StoryConfig } from "@/lib/types";
import { berechneAlter } from "@/lib/utils";
import Stars from "../components/Stars";
import PageTransition from "../components/PageTransition";
import StoryConfigurator from "../components/StoryConfigurator";

function StoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profilId = searchParams.get("profilId");
  const [profil, setProfil] = useState<HoererProfil | null>(null);

  useEffect(() => {
    if (!profilId) {
      router.push("/dashboard");
      return;
    }
    fetch(`/api/profile/${profilId}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setProfil)
      .catch(() => router.push("/dashboard"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilId]);

  const handleGenerate = (config: StoryConfig) => {
    sessionStorage.setItem("koalatree-config", JSON.stringify(config));
    sessionStorage.setItem("koalatree-profilId", profilId!);
    sessionStorage.setItem("koalatree-kindName", profil!.name);
    router.push("/story/result");
  };

  if (!profil) return null;

  const alter = profil.geburtsdatum
    ? berechneAlter(profil.geburtsdatum)
    : profil.alter ?? 5;

  return (
    <PageTransition>
        <main className="relative flex-1 flex flex-col items-center px-4 py-8 pb-24 sm:pb-8">
          <Stars />
          <div className="relative z-10 w-full max-w-2xl">
            <StoryConfigurator
              kindProfilId={profil.id}
              kindName={profil.name}
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
