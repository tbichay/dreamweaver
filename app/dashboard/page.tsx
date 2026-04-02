"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HoererProfil } from "@/lib/types";
import { berechneAlter } from "@/lib/utils";
import Stars from "../components/Stars";
import NavBar from "../components/NavBar";
import ProfilForm from "../components/ProfilForm";
import ProfilCard from "../components/ProfilCard";

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<HoererProfil[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editProfil, setEditProfil] = useState<HoererProfil | undefined>();
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

  const handleSave = async (profil: HoererProfil) => {
    if (editProfil) {
      // Update existing
      await fetch(`/api/profile/${editProfil.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profil),
      });
    } else {
      // Create new
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profil),
      });
    }
    await fetchProfile();
    setShowForm(false);
    setEditProfil(undefined);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Profil und alle zugehörigen Geschichten wirklich löschen?")) return;
    await fetch(`/api/profile?id=${id}`, { method: "DELETE" });
    await fetchProfile();
  };

  const handleEdit = (profil: HoererProfil) => {
    setEditProfil(profil);
    setShowForm(true);
  };

  const handleSelect = (profil: HoererProfil) => {
    router.push(`/story?profilId=${profil.id}`);
  };

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="relative flex-1 flex flex-col items-center justify-center">
          <Stars />
          <div className="text-white/40 text-lg">Laden...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="relative flex-1 flex flex-col items-center px-4 py-8">
        <Stars />

        <div className="relative z-10 w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-[#f5eed6]">
              Hörer-Profile
            </h1>
            <p className="text-white/50 text-sm">
              Für wen soll Koda heute erzählen?
            </p>
          </div>

          {showForm ? (
            <>
              <ProfilForm onSave={handleSave} initial={editProfil} />
              <div className="text-center mt-4">
                <button
                  className="text-white/40 hover:text-white/60 text-sm transition-colors"
                  onClick={() => { setShowForm(false); setEditProfil(undefined); }}
                >
                  Abbrechen
                </button>
              </div>
            </>
          ) : (
            <>
              {profile.length > 0 && (
                <div className="mb-8 grid gap-3">
                  {profile.map((p) => (
                    <ProfilCard
                      key={p.id}
                      profil={p}
                      onSelect={handleSelect}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              )}

              <div className="text-center">
                <button
                  className="btn-primary text-lg px-8 py-3"
                  onClick={() => { setEditProfil(undefined); setShowForm(true); }}
                >
                  {profile.length > 0 ? "Neues Profil erstellen" : "Los geht's — Erstelle dein erstes Profil"}
                </button>
                {profile.length === 0 && (
                  <p className="text-white/40 text-sm mt-4">
                    Koda möchte dich kennenlernen, damit er die perfekte Geschichte erzählen kann.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
