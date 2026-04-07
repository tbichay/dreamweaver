"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface BrandingVersion {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
}

interface BrandingStatus {
  activeIcons: string[];
  faviconVersions: BrandingVersion[];
  logoVersions: BrandingVersion[];
  hasFavicon: boolean;
  hasLogo: boolean;
}

const ICON_SIZES = [
  { filename: "favicon-16.png", label: "16×16", desc: "Browser Tab" },
  { filename: "favicon-32.png", label: "32×32", desc: "Browser Tab (Retina)" },
  { filename: "apple-touch-icon.png", label: "180×180", desc: "iOS Home Screen" },
  { filename: "icon-192.png", label: "192×192", desc: "Android PWA" },
  { filename: "icon-512.png", label: "512×512", desc: "App Store" },
  { filename: "icon-maskable-512.png", label: "512×512", desc: "Maskable (Android)" },
  { filename: "app-icon.png", label: "512×512", desc: "App Icon" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BrandingPage() {
  const [status, setStatus] = useState<BrandingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [result, setResult] = useState("");

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/admin/studio/branding");
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadStatus(); }, []);

  const handleGenerate = async (type: "favicon" | "logo") => {
    const label = type === "favicon" ? "Favicon" : "Logo";
    setGenerating(label);
    setResult("");
    try {
      const res = await fetch("/api/admin/studio/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(`${label} generiert! (${formatBytes(data.size)}). ${type === "favicon" ? "7 Icon-Groessen erstellt." : ""}`);
      await loadStatus();
    } catch (err) {
      setResult(`Fehler: ${err instanceof Error ? err.message : "Unbekannt"}`);
    } finally {
      setGenerating(null);
    }
  };

  const handleActivate = async (filename: string) => {
    setActivating(filename);
    try {
      const res = await fetch("/api/admin/studio/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.message || "Aktiviert!");
      await loadStatus();
    } catch (err) {
      setResult(`Fehler: ${err instanceof Error ? err.message : "Unbekannt"}`);
    } finally {
      setActivating(null);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-white/30 text-sm">Lade Branding...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 sm:pb-8">
      <h1 className="text-xl font-bold text-[#f5eed6] mb-1">✨ Branding</h1>
      <p className="text-sm text-white/40 mb-6">
        Favicon, App-Icons und Logo generieren und verwalten.
      </p>

      {/* Status Result */}
      {result && (
        <div className={`card p-3 mb-6 text-xs ${result.startsWith("Fehler") ? "text-red-400/70 border-red-400/20" : "text-[#a8d5b8] border-[#4a7c59]/30"}`}>
          {result}
        </div>
      )}

      {/* ── Favicon Section ── */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-[#f5eed6] flex items-center gap-2">
              🌳 Favicon & App-Icons
              {status?.hasFavicon && <span className="text-[8px] bg-[#4a7c59]/30 text-[#a8d5b8] px-2 py-0.5 rounded-full">Live</span>}
            </h3>
            <p className="text-[10px] text-white/30 mt-1">
              Magischer leuchtender KoalaTree. Wird in 7 Groessen generiert.
            </p>
          </div>
          <button
            onClick={() => handleGenerate("favicon")}
            disabled={generating !== null}
            className="px-4 py-2 rounded-lg bg-[#4a7c59] text-white text-xs font-medium hover:bg-[#5a8c69] transition-colors disabled:opacity-30 flex items-center gap-1.5"
          >
            {generating === "Favicon" ? <><span className="animate-spin">⏳</span> Generiere...</> : <>🌳 {status?.hasFavicon ? "Neu generieren" : "Generieren"}</>}
          </button>
        </div>

        {/* Active Icons Grid */}
        {status?.activeIcons && status.activeIcons.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] text-white/30 mb-2">Aktive Icons:</p>
            <div className="flex flex-wrap gap-3">
              {ICON_SIZES.map((icon) => {
                const isActive = status.activeIcons.includes(icon.filename);
                return (
                  <div key={icon.filename} className="text-center">
                    <div className={`rounded-lg overflow-hidden bg-[#1a2e1a] border ${
                      isActive ? "border-[#4a7c59]/40" : "border-white/5 opacity-30"
                    }`} style={{ width: Math.max(32, Math.min(icon.label === "16×16" ? 32 : icon.label === "32×32" ? 48 : 64, 64)), height: Math.max(32, Math.min(icon.label === "16×16" ? 32 : icon.label === "32×32" ? 48 : 64, 64)) }}>
                      {isActive && (
                        <Image
                          src={`/api/admin/studio/image/icons/${icon.filename}`}
                          alt={icon.label}
                          width={64}
                          height={64}
                          className="w-full h-full object-contain"
                          unoptimized
                        />
                      )}
                    </div>
                    <p className="text-[7px] text-white/30 mt-1">{icon.label}</p>
                    <p className="text-[6px] text-white/15">{icon.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Favicon Versions */}
        {status?.faviconVersions && status.faviconVersions.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 mb-2">Versionen ({status.faviconVersions.length}):</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {status.faviconVersions.map((v) => (
                <div key={v.filename} className="card overflow-hidden">
                  <div className="aspect-square bg-[#1a2e1a]">
                    <Image
                      src={v.url}
                      alt="Favicon"
                      width={120}
                      height={120}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="p-1.5">
                    <p className="text-[8px] text-white/20">{formatBytes(v.size)}</p>
                    <button
                      onClick={() => handleActivate(v.filename)}
                      disabled={activating === v.filename}
                      className="text-[8px] text-[#a8d5b8]/50 hover:text-[#a8d5b8] transition-colors disabled:opacity-30 mt-0.5"
                    >
                      {activating === v.filename ? "..." : "Aktivieren"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Logo Section ── */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-[#f5eed6] flex items-center gap-2">
              🐨 Logo
              {status?.hasLogo && <span className="text-[8px] bg-[#4a7c59]/30 text-[#a8d5b8] px-2 py-0.5 rounded-full">Live</span>}
            </h3>
            <p className="text-[10px] text-white/30 mt-1">
              KoalaTree mit Koda auf dem Ast. 1024×1024px fuer Marketing und Social Media.
            </p>
          </div>
          <button
            onClick={() => handleGenerate("logo")}
            disabled={generating !== null}
            className="px-4 py-2 rounded-lg bg-[#4a7c59] text-white text-xs font-medium hover:bg-[#5a8c69] transition-colors disabled:opacity-30 flex items-center gap-1.5"
          >
            {generating === "Logo" ? <><span className="animate-spin">⏳</span> Generiere...</> : <>🐨 {status?.hasLogo ? "Neu generieren" : "Generieren"}</>}
          </button>
        </div>

        {/* Active Logo */}
        {status?.hasLogo && (
          <div className="mb-4">
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-[#1a2e1a] border border-[#4a7c59]/40">
              <Image
                src="/api/admin/studio/image/icons/logo.png"
                alt="Logo"
                width={128}
                height={128}
                className="w-full h-full object-contain"
                unoptimized
              />
            </div>
          </div>
        )}

        {/* Logo Versions */}
        {status?.logoVersions && status.logoVersions.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 mb-2">Versionen ({status.logoVersions.length}):</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {status.logoVersions.map((v) => (
                <div key={v.filename} className="card overflow-hidden">
                  <div className="aspect-square bg-[#1a2e1a]">
                    <Image
                      src={v.url}
                      alt="Logo"
                      width={120}
                      height={120}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="p-1.5">
                    <p className="text-[8px] text-white/20">{formatBytes(v.size)}</p>
                    <button
                      onClick={() => handleActivate(v.filename)}
                      disabled={activating === v.filename}
                      className="text-[8px] text-[#a8d5b8]/50 hover:text-[#a8d5b8] transition-colors disabled:opacity-30 mt-0.5"
                    >
                      {activating === v.filename ? "..." : "Aktivieren"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card p-5">
        <h3 className="text-sm font-medium text-[#f5eed6] mb-3">Verwendung</h3>
        <div className="space-y-2 text-[10px] text-white/40">
          <div className="flex justify-between">
            <span>Favicon (Browser Tab)</span>
            <span className="text-white/20">favicon-32.png</span>
          </div>
          <div className="flex justify-between">
            <span>iOS Home Screen</span>
            <span className="text-white/20">apple-touch-icon.png</span>
          </div>
          <div className="flex justify-between">
            <span>Android PWA</span>
            <span className="text-white/20">icon-192.png + icon-512.png</span>
          </div>
          <div className="flex justify-between">
            <span>Maskable Icon</span>
            <span className="text-white/20">icon-maskable-512.png</span>
          </div>
          <div className="flex justify-between">
            <span>Logo (Marketing)</span>
            <span className="text-white/20">logo.png (1024×1024)</span>
          </div>
        </div>
        <p className="text-[8px] text-white/15 mt-3">
          GPT-Image-1 · Alle Icons werden automatisch aus dem Source-Bild abgeleitet (7 Groessen inkl. Maskable).
        </p>
      </div>
    </div>
  );
}
