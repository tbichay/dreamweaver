"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface HeroStatus {
  background: boolean;
  hero: boolean;
  portraits: Record<string, boolean>;
  heroChars: Record<string, boolean>;
  ready: boolean;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HeroBuilderPage() {
  const [status, setStatus] = useState<HeroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState("");

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/admin/studio/hero");
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadStatus(); }, []);

  const generateImage = async (type: "hero-bg" | "hero-char" | "hero-full", character?: string) => {
    const label = type === "hero-bg" ? "Hintergrund" : type === "hero-full" ? "Komplett-Szene" : `Hero-${character}`;
    setGenerating(label);
    setResult("");
    try {
      if (type === "hero-full") {
        // hero-full uses the composite endpoint
        const res = await fetch("/api/admin/studio/hero", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setResult(data.message || `Hero generiert! (${formatBytes(data.size)})`);
      } else {
        // hero-bg and hero-char use the studio generate endpoint
        const body: Record<string, string> = { type };
        if (character) body.character = character;
        const res = await fetch("/api/admin/studio/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setResult(`${label} generiert! (${formatBytes(data.size)})`);
      }
      await loadStatus();
    } catch (err) {
      setResult(`Fehler: ${err instanceof Error ? err.message : "Unbekannt"}`);
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-white/30 text-sm">Lade Status...</div>;

  const readyCount = status ? Object.values(status.heroChars).filter(Boolean).length + Object.values(status.portraits).filter(Boolean).length : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 sm:pb-8">
      <h1 className="text-xl font-bold text-[#f5eed6] mb-1">🏔️ Hero Builder</h1>
      <p className="text-sm text-white/40 mb-6">
        Landing-Page Hero-Bild: Hintergrund + 7 Charaktere mit Glow- und Schatten-Effekten.
      </p>

      {/* Status Result */}
      {result && (
        <div className={`card p-3 mb-6 text-xs ${result.startsWith("Fehler") ? "text-red-400/70 border-red-400/20" : "text-[#a8d5b8] border-[#4a7c59]/30"}`}>
          {result}
        </div>
      )}

      {/* Current Hero Preview */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-medium text-[#f5eed6] mb-3 flex items-center gap-2">
          <span>Aktuelles Hero-Bild</span>
          {status?.hero && <span className="text-[8px] bg-[#4a7c59]/30 text-[#a8d5b8] px-2 py-0.5 rounded-full">Live</span>}
        </h3>
        {status?.hero ? (
          <div className="rounded-xl overflow-hidden bg-[#1a2e1a] aspect-[3/2]">
            <Image
              src="/api/admin/studio/image/hero.png"
              alt="Hero"
              width={1536}
              height={1024}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="rounded-xl bg-[#1a2e1a] aspect-[3/2] flex items-center justify-center text-white/20 text-sm">
            Noch kein Hero-Bild generiert
          </div>
        )}
      </div>

      {/* Step 1: Background */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50">1</span>
            <h3 className="text-sm font-medium text-[#f5eed6]">Hintergrund</h3>
            {status?.background && <span className="text-[8px] text-[#a8d5b8]">✓</span>}
          </div>
          <button
            onClick={() => generateImage("hero-bg")}
            disabled={generating !== null}
            className="px-3 py-1.5 rounded-lg bg-[#4a7c59]/80 text-white text-[10px] font-medium hover:bg-[#5a8c69] transition-colors disabled:opacity-30 flex items-center gap-1.5"
          >
            {generating === "Hintergrund" ? <><span className="animate-spin">⏳</span> Generiere...</> : <>🏔️ {status?.background ? "Neu generieren" : "Generieren"}</>}
          </button>
        </div>
        <p className="text-[10px] text-white/30">
          Magischer KoalaTree bei Daemmerung. Blue-Hour Himmel, Sterne, leuchtender Baum. 1536×1024px.
        </p>
        {status?.background && (
          <div className="mt-3 rounded-lg overflow-hidden bg-[#1a2e1a] aspect-[3/2] max-h-[200px]">
            <Image
              src="/api/admin/studio/image/hero-background.png"
              alt="Background"
              width={768}
              height={512}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        )}
      </div>

      {/* Step 2: Character Portraits (transparent) */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50">2</span>
          <h3 className="text-sm font-medium text-[#f5eed6]">Hero-Charaktere (transparent)</h3>
        </div>
        <p className="text-[10px] text-white/30 mb-3">
          Jeder Charakter einzeln mit transparentem Hintergrund. Wird spaeter auf den Hintergrund composited.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {CHARACTERS.map((c) => {
            const hasHeroChar = status?.heroChars[c.id] || false;
            const hasPortrait = status?.portraits[c.id] || false;
            const hasAny = hasHeroChar || hasPortrait;

            return (
              <div key={c.id} className="text-center">
                <div className={`aspect-square rounded-xl overflow-hidden bg-[#1a2e1a] border-2 mb-2 transition-all ${
                  hasHeroChar ? "border-[#4a7c59]/60" : hasPortrait ? "border-[#d4a853]/40" : "border-white/5"
                }`}>
                  {hasHeroChar ? (
                    <Image
                      src={`/api/admin/studio/image/hero/${c.id}.png`}
                      alt={c.name}
                      width={100}
                      height={100}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  ) : hasPortrait ? (
                    <Image
                      src={`/api/images/${c.id}-portrait.png`}
                      alt={c.name}
                      width={100}
                      height={100}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">{c.emoji}</div>
                  )}
                </div>
                <p className="text-[10px] text-white/50 mb-1">{c.emoji} {c.name}</p>
                <div className="flex flex-col gap-1">
                  {hasHeroChar && <span className="text-[7px] text-[#a8d5b8]/60">Hero ✓</span>}
                  {hasPortrait && !hasHeroChar && <span className="text-[7px] text-[#d4a853]/60">Fallback: Portrait</span>}
                  <button
                    onClick={() => generateImage("hero-char", c.id)}
                    disabled={generating !== null}
                    className="text-[8px] text-[#a8d5b8]/40 hover:text-[#a8d5b8] transition-colors disabled:opacity-20"
                  >
                    {generating === `Hero-${c.id}` ? "..." : hasHeroChar ? "Neu" : "Generieren"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 3: Composite */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50">3</span>
            <h3 className="text-sm font-medium text-[#f5eed6]">Hero zusammensetzen</h3>
          </div>
          <button
            onClick={() => generateImage("hero-full")}
            disabled={generating !== null || !status?.background}
            className="px-3 py-1.5 rounded-lg bg-[#d4a853]/80 text-white text-[10px] font-medium hover:bg-[#d4a853] transition-colors disabled:opacity-30 flex items-center gap-1.5"
          >
            {generating === "Komplett-Szene" ? <><span className="animate-spin">⏳</span> Compositing...</> : <>✨ Hero bauen</>}
          </button>
        </div>
        <p className="text-[10px] text-white/30">
          Setzt Hintergrund + alle verfuegbaren Charaktere zusammen. Glow-Effekte + Schatten werden automatisch erstellt.
          {!status?.background && <span className="text-red-400/60 ml-1">Hintergrund wird zuerst benoetigt.</span>}
        </p>

        {/* Readiness Checklist */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`text-[9px] px-2 py-0.5 rounded-full ${status?.background ? "bg-[#4a7c59]/20 text-[#a8d5b8]" : "bg-white/5 text-white/20"}`}>
            {status?.background ? "✓" : "✗"} Hintergrund
          </span>
          {CHARACTERS.map((c) => {
            const has = status?.heroChars[c.id] || status?.portraits[c.id];
            return (
              <span key={c.id} className={`text-[9px] px-2 py-0.5 rounded-full ${has ? "bg-[#4a7c59]/20 text-[#a8d5b8]" : "bg-white/5 text-white/20"}`}>
                {has ? "✓" : "✗"} {c.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Alternative: Full Scene (single image) */}
      <div className="card p-5">
        <h3 className="text-sm font-medium text-[#f5eed6] mb-2">Alternative: Komplett-Szene (DALL-E)</h3>
        <p className="text-[10px] text-white/30 mb-3">
          Generiert die gesamte Szene mit allen 7 Charakteren in einem einzigen Bild via GPT-Image-1.
          Weniger Kontrolle ueber Positionierung, aber schneller.
        </p>
        <button
          onClick={async () => {
            setGenerating("DALL-E Szene");
            setResult("");
            try {
              const res = await fetch("/api/admin/studio/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "hero-full" }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              setResult(`Komplett-Szene generiert! (${formatBytes(data.size)})`);
              await loadStatus();
            } catch (err) {
              setResult(`Fehler: ${err instanceof Error ? err.message : "Unbekannt"}`);
            } finally {
              setGenerating(null);
            }
          }}
          disabled={generating !== null}
          className="px-3 py-1.5 rounded-lg bg-white/10 text-white/60 text-[10px] hover:bg-white/15 transition-colors disabled:opacity-30"
        >
          {generating === "DALL-E Szene" ? "Generiere..." : "🖼️ Komplett-Szene generieren"}
        </button>
      </div>
    </div>
  );
}
