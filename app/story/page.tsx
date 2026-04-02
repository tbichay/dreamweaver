"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HoererProfil, StoryConfig } from "@/lib/types";
import { berechneAlter } from "@/lib/utils";
import Stars from "../components/Stars";
import NavBar from "../components/NavBar";
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
  }, [profilId, router]);

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
    <>
      <NavBar />
      <main className="relative flex-1 flex flex-col items-center px-4 py-8">
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
    </>
  );
}

export default function StoryPage() {
  return (
    <Suspense>
      <StoryPageContent />
    </Suspense>
  );
}
