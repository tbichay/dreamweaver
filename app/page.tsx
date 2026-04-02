"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { KindProfil } from "@/lib/types";
import Stars from "./components/Stars";
import ProfilForm from "./components/ProfilForm";
import ProfilCard from "./components/ProfilCard";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<KindProfil[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (res.ok) {
      setProfile(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async (profil: KindProfil) => {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profil),
    });
    await fetchProfile();
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/profile?id=${id}`, { method: "DELETE" });
    await fetchProfile();
  };

  const handleSelect = (profil: KindProfil) => {
    router.push(`/story?profilId=${profil.id}`);
  };

  if (loading) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center">
        <Stars />
        <div className="text-cream/40 text-lg">Laden...</div>
      </main>
    );
  }

  return (
    <main className="relative flex-1 flex flex-col items-center">
      <Stars />

      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <button
          className="text-white/40 hover:text-white/60 text-sm transition-colors"
          onClick={() => router.push("/geschichten")}
        >
          Geschichten-Bibliothek
        </button>
        <UserButton />
      </div>

      {/* Hero Section */}
      <div className="relative w-full max-w-5xl mx-auto mt-4 px-4">
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl">
          <Image
            src="/hero.png"
            alt="KoalaTree — Der magische Eukalyptusbaum"
            fill
            className="object-cover"
            priority
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-transparent to-transparent" />
          {/* Title on hero */}
          <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-2 text-white drop-shadow-lg">
              KoalaTree
            </h1>
            <p className="text-xl text-white/80 drop-shadow-md">
              Dein weiser Freund im magischen Baum
            </p>
          </div>
        </div>
      </div>

      {/* Content below hero */}
      <div className="relative z-10 w-full max-w-2xl px-4 py-8">
        <p className="text-center text-white/50 text-sm mb-8">
          Personalisierte Gute-Nacht-Geschichten, erzählt vom weisen Koala Koda
        </p>

        {showForm ? (
          <>
            <ProfilForm onSave={handleSave} />
            <div className="text-center mt-4">
              <button
                className="text-white/40 hover:text-white/60 text-sm transition-colors"
                onClick={() => setShowForm(false)}
              >
                Abbrechen
              </button>
            </div>
          </>
        ) : (
          <>
            {profile.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-white/70 mb-4">
                  Für wen soll Koda heute erzählen?
                </h2>
                <div className="grid gap-3">
                  {profile.map((p) => (
                    <ProfilCard
                      key={p.id}
                      profil={p}
                      onSelect={handleSelect}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                className="btn-primary text-lg px-8 py-3"
                onClick={() => setShowForm(true)}
              >
                {profile.length > 0 ? "Neues Kind vorstellen" : "Los geht's — Stell dein Kind dem Koala vor"}
              </button>
              {profile.length === 0 && (
                <p className="text-white/40 text-sm mt-4">
                  Der weise Koala Koda möchte dein Kind kennenlernen, damit er die perfekte Geschichte erzählen kann.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
