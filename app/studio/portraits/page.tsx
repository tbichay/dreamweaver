"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface StudioImage {
  url: string;
  filename: string;
  baseName: string;
  canonicalName: string;
  isActive: boolean;
  size: number;
  uploadedAt: string;
  /** Blob storage path, e.g. "studio/koda-portrait-abc123.png" */
  path?: string;
}

interface ReferenceImage {
  path: string;
  label: string;
  role: "primary" | "side" | "expression" | "pose" | "detail";
}

interface ReferenceEntry {
  primary: string;
  images: ReferenceImage[];
}

type ReferencesMap = Record<string, ReferenceEntry>;

const CHARACTERS = [
  { id: "koda", name: "Koda", emoji: "\u{1F428}", color: "#a8d5b8" },
  { id: "kiki", name: "Kiki", emoji: "\u{1F426}", color: "#e8c547" },
  { id: "luna", name: "Luna", emoji: "\u{1F989}", color: "#b8a9d4" },
  { id: "mika", name: "Mika", emoji: "\u{1F415}", color: "#d4884a" },
  { id: "pip", name: "Pip", emoji: "\u{1F9AB}", color: "#6bb5c9" },
  { id: "sage", name: "Sage", emoji: "\u{1F43B}", color: "#8a9e7a" },
  { id: "nuki", name: "Nuki", emoji: "\u2600\uFE0F", color: "#f0b85a" },
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
  { id: "golden", label: "\u{1F305} Golden" },
  { id: "blue", label: "\u{1F306} Blau" },
  { id: "night", label: "\u{1F319} Nacht" },
  { id: "dawn", label: "\u{1F338} Morgen" },
  { id: "sunny", label: "\u2600\uFE0F Sonnig" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Build an image URL from a blob path like "studio/koda-portrait-abc.png" */
function imageUrlFromPath(path: string): string {
  if (path.startsWith("studio/")) {
    const fileName = path.replace("studio/", "");
    return `/api/admin/studio/image/${fileName}`;
  }
  if (path.startsWith("images/")) {
    const fileName = path.replace("images/", "");
    return `/api/images/${fileName}`;
  }
  return `/api/images/${path}`;
}

export default function PortraitsPage() {
  const [images, setImages] = useState<StudioImage[]>([]);
  const [references, setReferences] = useState<ReferencesMap>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refLoading, setRefLoading] = useState<string | null>(null);
  const [genResult, setGenResult] = useState("");
  const [expandedChars, setExpandedChars] = useState<Set<string>>(new Set());

  // Generator state
  const [character, setCharacter] = useState("koda");
  const [pose, setPose] = useState("portrait");
  const [scene, setScene] = useState("golden");

  const loadImages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/studio/generate");
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadReferences = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/assets");
      if (res.ok) {
        const data = await res.json();
        setReferences(data.references || {});
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadImages();
    loadReferences();
  }, [loadImages, loadReferences]);

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

  /** Add image to character's reference set */
  const handleAddRef = async (charId: string, img: StudioImage) => {
    const key = `${img.filename}:add`;
    setRefLoading(key);
    try {
      const assetPath = img.path || `studio/${img.filename}`;
      const res = await fetch("/api/admin/assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refKey: `portrait:${charId}`,
          assetPath,
          action: "add",
          label: img.baseName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReferences(data.references || {});
      setGenResult("Referenz hinzugefuegt!");
    } catch { /* ignore */ }
    setRefLoading(null);
  };

  /** Remove image from character's reference set */
  const handleRemoveRef = async (charId: string, path: string) => {
    const key = `${path}:remove`;
    setRefLoading(key);
    try {
      const res = await fetch("/api/admin/assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refKey: `portrait:${charId}`,
          assetPath: path,
          action: "remove",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReferences(data.references || {});
      setGenResult("Referenz entfernt.");
    } catch { /* ignore */ }
    setRefLoading(null);
  };

  /** Set an image as primary in the reference set */
  const handleSetPrimary = async (charId: string, path: string) => {
    const key = `${path}:primary`;
    setRefLoading(key);
    try {
      const res = await fetch("/api/admin/assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refKey: `portrait:${charId}`,
          assetPath: path,
          action: "primary",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReferences(data.references || {});
      setGenResult("Primaerbild gesetzt!");
    } catch { /* ignore */ }
    setRefLoading(null);
  };

  const toggleExpanded = (charId: string) => {
    setExpandedChars((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId);
      else next.add(charId);
      return next;
    });
  };

  /** Check if a studio image is in a character's reference set */
  const isInRefSet = (charId: string, img: StudioImage): boolean => {
    const entry = references[`portrait:${charId}`];
    if (!entry) return false;
    const assetPath = img.path || `studio/${img.filename}`;
    return entry.images.some((r) => r.path === assetPath);
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
      <h1 className="text-xl font-bold text-[#f5eed6] mb-1">Portraits & Referenzbilder</h1>
      <p className="text-sm text-white/40 mb-6">
        Generiere Portraits und verwalte <strong className="text-white/60">Referenzbilder</strong> pro Charakter.
        Mehrere Referenzbilder werden bei jeder Generierung mitgesendet, damit der Charakter konsistent aussieht.
      </p>

      {/* Multi-Reference Overview */}
      <div className="card p-5 mb-8 border-[#4a7c59]/20">
        <h3 className="text-sm font-medium text-[#f5eed6] mb-1 flex items-center gap-2">
          Aktive Referenzbilder
        </h3>
        <p className="text-[10px] text-white/30 mb-4">
          Diese Bilder werden automatisch als Vorlage verwendet. Das Primaerbild (goldener Rand) hat hoechste Prioritaet.
          Klicke + um weitere Referenzen hinzuzufuegen.
        </p>

        <div className="space-y-4">
          {CHARACTERS.map((c) => {
            const refKey = `portrait:${c.id}`;
            const entry = references[refKey];
            const refImages = entry?.images || [];
            const isExpanded = expandedChars.has(c.id);
            const charImages = grouped[c.id] || [];

            return (
              <div key={c.id} className="bg-white/[0.02] rounded-xl p-3">
                {/* Character header row */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{c.emoji}</span>
                  <span className="text-[11px] font-medium text-[#f5eed6]">{c.name}</span>
                  {refImages.length > 0 ? (
                    <span className="text-[8px] text-[#a8d5b8] ml-1">
                      {refImages.length} Referenz{refImages.length !== 1 ? "en" : ""}
                    </span>
                  ) : (
                    <span className="text-[8px] text-red-400/50 ml-1">Kein Referenzbild</span>
                  )}
                </div>

                {/* Reference thumbnails row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {refImages.map((refImg) => {
                    const isPrimary = refImg.path === entry?.primary;
                    const imgUrl = imageUrlFromPath(refImg.path);

                    return (
                      <div key={refImg.path} className="relative group">
                        <div
                          className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                            isPrimary
                              ? "border-[#d4a853] shadow-[0_0_10px_rgba(212,168,83,0.3)]"
                              : "border-[#4a7c59]/40"
                          }`}
                          onClick={() => !isPrimary && handleSetPrimary(c.id, refImg.path)}
                          title={isPrimary ? "Primaerbild" : "Klicke um als Primaerbild zu setzen"}
                        >
                          <Image
                            src={imgUrl}
                            alt={refImg.label}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        </div>

                        {/* Primary star badge */}
                        {isPrimary && (
                          <div className="absolute -top-1 -left-1 w-4 h-4 bg-[#d4a853] rounded-full flex items-center justify-center text-[8px] shadow-md">
                            <span className="text-black font-bold">{"\u2605"}</span>
                          </div>
                        )}

                        {/* Remove button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRef(c.id, refImg.path);
                          }}
                          disabled={refLoading === `${refImg.path}:remove`}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Referenz entfernen"
                        >
                          {"\u00D7"}
                        </button>

                        {/* Label */}
                        <p className="text-[7px] text-white/40 text-center mt-0.5 max-w-[64px] truncate">
                          {refImg.label}
                        </p>
                      </div>
                    );
                  })}

                  {/* Add (+) button */}
                  {charImages.length > 0 && (
                    <button
                      onClick={() => toggleExpanded(c.id)}
                      className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-all ${
                        isExpanded
                          ? "border-[#d4a853]/50 bg-[#d4a853]/10 text-[#d4a853]"
                          : "border-white/10 hover:border-white/20 text-white/20 hover:text-white/40"
                      }`}
                      title="Referenzen verwalten"
                    >
                      <span className="text-lg">{isExpanded ? "\u2212" : "+"}</span>
                    </button>
                  )}

                  {/* Empty state: no images generated yet */}
                  {charImages.length === 0 && refImages.length === 0 && (
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-white/5 flex items-center justify-center">
                      <span className="text-[8px] text-white/15">leer</span>
                    </div>
                  )}
                </div>

                {/* Expanded: version gallery for adding references */}
                {isExpanded && charImages.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[9px] text-white/30 mb-2">
                      Waehle Versionen aus, um sie als Referenz hinzuzufuegen:
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                      {charImages.map((img) => {
                        const inSet = isInRefSet(c.id, img);
                        return (
                          <div key={img.filename} className="relative">
                            <div className={`aspect-square rounded-lg overflow-hidden border transition-all ${
                              inSet ? "border-[#4a7c59] ring-1 ring-[#4a7c59]/30" : "border-white/5"
                            }`}>
                              <Image
                                src={img.url}
                                alt={img.baseName}
                                width={80}
                                height={80}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            </div>
                            {inSet ? (
                              <div className="absolute bottom-0 inset-x-0 bg-[#4a7c59]/90 text-white text-[7px] text-center py-0.5 font-medium">
                                Referenz
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddRef(c.id, img)}
                                disabled={refLoading === `${img.filename}:add`}
                                className="absolute bottom-0 inset-x-0 bg-[#d4a853]/80 hover:bg-[#d4a853] text-black text-[7px] text-center py-0.5 font-medium opacity-0 hover:opacity-100 transition-opacity disabled:opacity-30"
                              >
                                {refLoading === `${img.filename}:add` ? "..." : "+ Hinzufuegen"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
              <><span className="animate-spin">{"\u23F3"}</span> Generiere...</>
            ) : (
              <>{"\u{1F3A8}"} Portrait generieren</>
            )}
          </button>
          {genResult && (
            <span className={`text-[10px] ${genResult.startsWith("Fehler") ? "text-red-400/70" : "text-[#a8d5b8]/70"}`}>
              {genResult}
            </span>
          )}
        </div>

        <p className="text-[8px] text-white/15 mt-2">
          GPT-Image-1 &middot; 1024x1024 &middot; Disney-1994 Stil &middot; Versionen werden in studio/ gespeichert
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
                  {charImages.map((img) => {
                    const inSet = isInRefSet(c.id, img);
                    return (
                      <div key={img.filename} className={`card overflow-hidden ${
                        inSet ? "ring-2 ring-[#4a7c59]" : ""
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
                          {inSet && (
                            <div className="absolute top-1 right-1 bg-[#4a7c59] text-white text-[7px] px-1.5 py-0.5 rounded-full font-medium">
                              Referenz
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-[9px] text-white/40 truncate">{img.baseName}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[8px] text-white/20">{formatBytes(img.size)}</p>
                            {!inSet ? (
                              <button
                                onClick={() => handleAddRef(c.id, img)}
                                disabled={refLoading === `${img.filename}:add`}
                                className="text-[8px] text-[#d4a853]/60 hover:text-[#d4a853] transition-colors disabled:opacity-30 font-medium"
                              >
                                {refLoading === `${img.filename}:add` ? "..." : "+ Als Referenz"}
                              </button>
                            ) : (
                              <span className="text-[8px] text-[#a8d5b8]/50">Referenz</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
          <p>2. <strong className="text-white/60">Vergleiche</strong> die Versionen und waehle die besten aus</p>
          <p>3. Klicke <strong className="text-[#d4a853]">+ Als Referenz</strong> um sie zum Referenz-Set hinzuzufuegen</p>
          <p>4. Das Primaerbild (goldener Stern) hat hoechste Prioritaet bei der Generierung</p>
          <p>5. Alle Referenzbilder eines Charakters werden automatisch an GPT-Image-1 gesendet</p>
          <p className="text-white/25 pt-1">Der Charakter sieht in allen generierten Bildern konsistent aus</p>
        </div>
      </div>
    </div>
  );
}
