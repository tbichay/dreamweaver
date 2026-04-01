"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { KindProfil } from "@/lib/types";
import Stars from "./components/Stars";
import ProfilForm from "./components/ProfilForm";
import ProfilCard from "./components/ProfilCard";

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
        <div className="text-white/40 text-lg">Laden...</div>
      </main>
    );
  }

  return (
    <main className="relative flex-1 flex flex-col items-center px-4 py-12">
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

      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🐨</div>
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-amber-200 via-green-200 to-amber-200 bg-clip-text text-transparent">
            KoalaTree
          </h1>
          <p className="text-xl text-white/60">
            Dein weiser Freund im magischen Baum
          </p>
          <p className="text-sm text-white/40 mt-2">
            Personalisierte Gute-Nacht-Geschichten, erzählt vom weisen Koala
          </p>
        </div>

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
                  Für wen soll der Koala heute erzählen?
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
                  Der weise Koala möchte dein Kind kennenlernen, damit er die perfekte Geschichte erzählen kann.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
