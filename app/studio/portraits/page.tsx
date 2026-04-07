"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface StudioImage {
  url: string;
  filename: string;
  baseName: string;
  canonicalName: string;
  isActive: boolean;
  size: number;
  uploadedAt: string;
}

const CHARACTERS = [
  { id: "koda", name: "Koda", emoji: "🐨", color: "#a8d5b8" },
  { id: "kiki", name: "Kiki", emoji: "🐦", color: "#e8c547" },
  { id: "luna", name: "Luna", emoji: "🦉", color: "#b8a9d4" },
  { id: "mika", name: "Mika", emoji: "🐕", color: "#d4884a" },
  { id: "pip", name: "Pip", emoji: "🦫", color: "#6bb5c9" },
  { id: "sage", name: "Sage", emoji: "🐻", color: "#8a9e7a" },
  { id: "nuki", name: "Nuki", emoji: "☀️", color: "#f0b85a" },
];

const POSES = [
  { id: "portrait", label: "Standard" },
  { id: "waving", label: "Winkend" },
  { id: "thinking", label: "Nachdenklich" },
  { id: "surprised", label: "Ueberrascht" },
  { id: "excited", label: "Aufgeregt" },
  { id: "sleepy", label: "Schlaefrig" },
];

const SCENES = [
  { id: "golden", label: "🌅 Golden" },
  { id: "blue", label: "🌆 Blau" },
  { id: "night", label: "🌙 Nacht" },
  { id: "dawn", label: "🌸 Morgen" },
  { id: "sunny", label: "☀️ Sonnig" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortraitsPage() {
  const [images, setImages] = useState<StudioImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [genResult, setGenResult] = useState("");

  // Generator state
  const [character, setCharacter] = useState("koda");
  const [pose, setPose] = useState("portrait");
  const [scene, setScene] = useState("golden");

  const loadImages = async () => {
    try {
      const res = await fetch("/api/admin/studio/generate");
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadImages(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult("");
    try {
      const res = await fetch("/api/admin/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character, pose, scene, type: "character" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenResult(`Portrait generiert! (${formatBytes(data.size)})`);
      await loadImages();
    } catch (err) {
      setGenResult(`Fehler: ${err instanceof Error ? err.message : "Unbekannt"}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleActivate = async (filename: string) => {
    setActivating(filename);
    try {
      const res = await fetch("/api/admin/studio/generate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenResult(data.message || "Referenzbild gesetzt!");
      await loadImages();
    } catch { /* ignore */ }
    setActivating(null);
  };

  // Group images by character
  const grouped: Record<string, StudioImage[]> = {};
  for (const img of images) {
    const charId = img.baseName.split("-")[0];
    if (!grouped[charId]) grouped[charId] = [];
    grouped[charId].push(img);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-24 sm:pb-8">
      <h1 className="text-xl font-bold text-[#f5eed6] mb-1">🎨 Portraits & Referenzbilder</h1>
      <p className="text-sm text-white/40 mb-6">
        Generiere Portraits und waehle das <strong className="text-white/60">Referenzbild</strong> pro Charakter.
        Das Referenzbild wird bei jeder Szenen-Generierung automatisch mitgesendet, damit der Charakter immer gleich aussieht.
      </p>

      {/* Reference Images Overview */}
      <div className="card p-5 mb-8 border-[#4a7c59]/20">
        <h3 className="text-sm font-medium text-[#f5eed6] mb-1 flex items-center gap-2">
          📌 Aktive Referenzbilder
        </h3>
        <p className="text-[10px] text-white/30 mb-4">
          Diese Bilder werden automatisch als Vorlage verwendet, wenn ein Charakter in einer Szene erscheint.
          Klicke &quot;Als Referenz setzen&quot; bei einer Version weiter unten, um sie zu aendern.
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {CHARACTERS.map((c) => {
            const charImages = grouped[c.id] || [];
            const hasActive = charImages.some((img) => img.isActive);
            return (
              <div key={c.id} className="text-center">
                <div className={`aspect-square rounded-xl overflow-hidden bg-[#1a2e1a] border-2 transition-all ${
                  hasActive ? "border-[#4a7c59] shadow-[0_0_12px_rgba(74,124,89,0.3)]" : "border-red-400/30"
                }`}>
                  <Image
                    src={`/api/images/${c.id}-portrait.png`}
                    alt={c.name}
                    width={120}
                    height={120}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <p className="text-[10px] text-white/50 mt-1.5">{c.emoji} {c.name}</p>
                {hasActive ? (
                  <p className="text-[8px] text-[#a8d5b8] font-medium">📌 Referenz gesetzt</p>
                ) : (
                  <p className="text-[8px] text-red-400/50">Kein Referenzbild</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Generator */}
      <div className="card p-5 mb-8">
        <h3 className="text-sm font-medium text-[#f5eed6] mb-4">Neues Portrait generieren</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Character */}
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1.5">Charakter</label>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCharacter(c.id)}
                  className={`p-2 rounded-lg text-center transition-all ${
                    character === c.id
                      ? "bg-[#4a7c59]/30 border border-[#4a7c59]/50"
                      : "bg-white/5 border border-transparent hover:bg-white/10"
                  }`}
                >
                  <span className="text-lg">{c.emoji}</span>
                  <p className="text-[8px] text-white/40 mt-0.5">{c.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pose */}
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1.5">Pose</label>
            <select
              value={pose}
              onChange={(e) => setPose(e.target.value)}
              className="w-full text-xs py-2 bg-white/5 border border-white/10 rounded-lg text-white/70"
            >
              {POSES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Scene */}
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1.5">Hintergrund</label>
            <div className="grid grid-cols-3 gap-1">
              {SCENES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScene(s.id)}
                  className={`p-1.5 rounded-lg text-center transition-all ${
                    scene === s.id
                      ? "bg-[#d4a853]/20 border border-[#d4a853]/40"
                      : "bg-white/5 border border-transparent hover:bg-white/10"
                  }`}
                >
                  <p className="text-[9px] text-white/60">{s.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2 rounded-lg bg-[#4a7c59] text-white text-xs font-medium hover:bg-[#5a8c69] transition-colors disabled:opacity-30 flex items-center gap-2"
          >
            {generating ? (
              <><span className="animate-spin">⏳</span> Generiere...</>
            ) : (
              <>🎨 Portrait generieren</>
            )}
          </button>
          {genResult && (
            <span className={`text-[10px] ${genResult.startsWith("Fehler") ? "text-red-400/70" : "text-[#a8d5b8]/70"}`}>
              {genResult}
            </span>
          )}
        </div>

        <p className="text-[8px] text-white/15 mt-2">
          GPT-Image-1 · 1024×1024 · Disney-1994 Stil · Versionen werden in studio/ gespeichert
        </p>
      </div>

      {/* All Versions by Character */}
      {loading ? (
        <div className="text-white/30 text-sm">Lade Versionen...</div>
      ) : (
        <div className="space-y-6">
          {CHARACTERS.map((c) => {
            const charImages = grouped[c.id] || [];
            if (charImages.length === 0) return null;

            return (
              <div key={c.id}>
                <h3 className="text-xs font-medium text-[#f5eed6] mb-3 flex items-center gap-1.5">
                  <span>{c.emoji}</span>
                  <span>{c.name}</span>
                  <span className="text-white/20 font-normal">({charImages.length} Versionen)</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {charImages.map((img) => (
                    <div key={img.filename} className={`card overflow-hidden ${
                      img.isActive ? "ring-2 ring-[#4a7c59]" : ""
                    }`}>
                      <div className="aspect-square bg-[#1a2e1a] relative">
                        <Image
                          src={img.url}
                          alt={img.baseName}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                        {img.isActive && (
                          <div className="absolute top-1 right-1 bg-[#4a7c59] text-white text-[7px] px-1.5 py-0.5 rounded-full font-medium">
                            📌 Referenz
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[9px] text-white/40 truncate">{img.baseName}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[8px] text-white/20">{formatBytes(img.size)}</p>
                          {!img.isActive ? (
                            <button
                              onClick={() => handleActivate(img.filename)}
                              disabled={activating === img.filename}
                              className="text-[8px] text-[#d4a853]/60 hover:text-[#d4a853] transition-colors disabled:opacity-30 font-medium"
                            >
                              {activating === img.filename ? "..." : "📌 Als Referenz"}
                            </button>
                          ) : (
                            <span className="text-[8px] text-[#a8d5b8]/50">Aktiv</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {images.length === 0 && (
            <div className="card p-8 text-center text-white/30 text-sm">
              Noch keine Portraits generiert. Starte oben mit dem Generator.
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="card p-5 mt-8 border-white/5">
        <h3 className="text-sm font-medium text-[#f5eed6] mb-2">So funktioniert&apos;s</h3>
        <div className="space-y-2 text-[10px] text-white/40">
          <p>1. <strong className="text-white/60">Generiere</strong> mehrere Versionen eines Charakters</p>
          <p>2. <strong className="text-white/60">Vergleiche</strong> die Versionen und waehle die beste</p>
          <p>3. Klicke <strong className="text-[#d4a853]">📌 Als Referenz</strong> um sie als Master-Bild zu setzen</p>
          <p>4. Bei jeder Szene mit diesem Charakter wird das Referenzbild automatisch an GPT-Image-1 gesendet</p>
          <p className="text-white/25 pt-1">→ Der Charakter sieht in allen generierten Bildern gleich aus</p>
        </div>
      </div>
    </div>
  );
}
