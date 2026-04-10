"use client";

import { useState, useEffect, useCallback } from "react";

type AssetType = "portrait" | "landscape" | "clip" | "sound" | "reference" | "actor";

interface DigitalActor {
  id: string;
  name: string;
  description?: string;
  voiceId?: string;
  voicePreviewUrl?: string;
  portraitAssetId?: string;
  tags: string[];
  createdAt: string;
}

interface Asset {
  id: string;
  type: AssetType;
  category?: string;
  tags: string[];
  blobUrl: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  generatedBy?: {
    model?: string;
    prompt?: string;
    blocks?: Record<string, number>;
  };
  modelId?: string;
  costCents?: number;
  version: number;
  isPrimary: boolean;
  projectId?: string;
  createdAt: string;
}

const TYPE_FILTERS: { id: AssetType | "all"; label: string; icon: string }[] = [
  { id: "all", label: "Alle", icon: "📁" },
  { id: "portrait", label: "Portraits", icon: "🎭" },
  { id: "landscape", label: "Landscapes", icon: "🏞️" },
  { id: "clip", label: "Clips", icon: "🎬" },
  { id: "sound", label: "Sounds", icon: "🔊" },
  { id: "actor", label: "Actors", icon: "🎙" },
];

export default function LibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [actors, setActors] = useState<DigitalActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const loadAssets = useCallback(() => {
    if (filter === "actor") {
      // Load actors instead of assets
      fetch("/api/studio/actors")
        .then((r) => r.json())
        .then((d) => { setActors(d.actors || []); setLoading(false); })
        .catch(() => setLoading(false));
      return;
    }
    const params = filter !== "all" ? `?type=${filter}` : "";
    fetch(`/api/studio/assets${params}`)
      .then((r) => r.json())
      .then((d) => { setAssets(d.assets || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const blobProxy = (url: string) =>
    url.includes(".blob.vercel-storage.com")
      ? `/api/studio/blob?url=${encodeURIComponent(url)}`
      : url;

  if (loading) return <div className="text-white/30 text-sm p-8">Lade Library...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#f5eed6]">Asset Library</h1>
          <p className="text-sm text-white/40">{assets.length} Assets</p>
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex gap-1.5 mb-5">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as AssetType | "all")}
            className={`px-3 py-1.5 rounded-lg text-[11px] transition-all ${
              filter === f.id
                ? "bg-[#3d6b4a]/40 text-[#a8d5b8] font-medium"
                : "text-white/30 hover:text-white/50 bg-white/5"
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Actors Grid (when "Actors" filter is active) */}
      {filter === "actor" && (
        <>
          {actors.length === 0 ? (
            <div className="card p-8 text-center text-white/30 text-sm">
              <p>Noch keine Schauspieler. Erstelle deinen ersten digitalen Schauspieler mit KI-Stimme.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {actors.map((actor) => (
                <div key={actor.id} className="card p-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                    <span className="text-2xl">🎙</span>
                  </div>
                  <p className="text-xs font-medium text-[#f5eed6] mt-2">{actor.name}</p>
                  {actor.description && (
                    <p className="text-[9px] text-white/30 mt-0.5 truncate">{actor.description}</p>
                  )}
                  <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                    {actor.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[7px] px-1 py-0.5 bg-white/5 rounded text-white/25">{tag}</span>
                    ))}
                  </div>
                  {actor.voiceId && (
                    <p className="text-[7px] text-green-400/40 mt-1">Stimme gespeichert</p>
                  )}
                  {actor.voicePreviewUrl && (
                    <button
                      onClick={() => {
                        if (playingVoice === actor.id) {
                          setPlayingVoice(null);
                        } else {
                          setPlayingVoice(actor.id);
                          const audio = new Audio(actor.voicePreviewUrl);
                          audio.onended = () => setPlayingVoice(null);
                          audio.play();
                        }
                      }}
                      className="mt-1 text-[8px] text-purple-300/60 hover:text-purple-300"
                    >
                      {playingVoice === actor.id ? "..." : "Stimme anhoeren"}
                    </button>
                  )}
                  <p className="text-[7px] text-white/15 mt-1">
                    {new Date(actor.createdAt).toLocaleDateString("de")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Asset Grid */}
      {filter !== "actor" && (assets.length === 0 ? (
        <div className="card p-8 text-center text-white/30 text-sm">
          <p>Noch keine Assets. Generiere Portraits, Landscapes oder Clips in der Engine.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setSelectedAsset(selectedAsset?.id === asset.id ? null : asset)}
              className={`card overflow-hidden cursor-pointer transition-all ${
                selectedAsset?.id === asset.id ? "ring-1 ring-[#a8d5b8]/40" : "hover:border-white/15"
              }`}
            >
              {/* Thumbnail */}
              {asset.mimeType.startsWith("image/") ? (
                <img src={blobProxy(asset.blobUrl)} alt="" className="w-full h-24 object-cover" />
              ) : asset.mimeType.startsWith("video/") ? (
                <video src={blobProxy(asset.blobUrl)} muted preload="metadata" className="w-full h-24 object-cover bg-black/30" />
              ) : (
                <div className="w-full h-24 bg-white/5 flex items-center justify-center text-2xl">
                  {asset.type === "sound" ? "🔊" : "📄"}
                </div>
              )}

              {/* Info */}
              <div className="p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">{asset.type}</span>
                  {asset.isPrimary && <span className="text-[7px] text-[#a8d5b8]">aktiv</span>}
                </div>
                {asset.category && (
                  <p className="text-[9px] text-white/40 mt-1 truncate">{asset.category}</p>
                )}
                <p className="text-[8px] text-white/20 mt-0.5">
                  v{asset.version} · {(asset.sizeBytes / 1024).toFixed(0)}KB
                  {asset.costCents ? ` · $${(asset.costCents / 100).toFixed(2)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Selected Asset Detail */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedAsset(null)}>
          <div className="card max-w-lg w-full max-h-[80vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            {/* Preview */}
            {selectedAsset.mimeType.startsWith("image/") ? (
              <img src={blobProxy(selectedAsset.blobUrl)} alt="" className="w-full rounded-lg mb-3" />
            ) : selectedAsset.mimeType.startsWith("video/") ? (
              <video src={blobProxy(selectedAsset.blobUrl)} controls className="w-full rounded-lg mb-3" />
            ) : selectedAsset.mimeType.startsWith("audio/") ? (
              <audio src={blobProxy(selectedAsset.blobUrl)} controls className="w-full mb-3" />
            ) : null}

            {/* Metadata */}
            <div className="space-y-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-white/30">Typ</span>
                <span className="text-white/60">{selectedAsset.type}</span>
              </div>
              {selectedAsset.category && (
                <div className="flex justify-between">
                  <span className="text-white/30">Kategorie</span>
                  <span className="text-white/60">{selectedAsset.category}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/30">Version</span>
                <span className="text-white/60">{selectedAsset.version}</span>
              </div>
              {selectedAsset.width && (
                <div className="flex justify-between">
                  <span className="text-white/30">Groesse</span>
                  <span className="text-white/60">{selectedAsset.width}x{selectedAsset.height}</span>
                </div>
              )}
              {selectedAsset.durationSec && (
                <div className="flex justify-between">
                  <span className="text-white/30">Dauer</span>
                  <span className="text-white/60">{selectedAsset.durationSec.toFixed(1)}s</span>
                </div>
              )}
              {selectedAsset.costCents && (
                <div className="flex justify-between">
                  <span className="text-white/30">Kosten</span>
                  <span className="text-white/60">${(selectedAsset.costCents / 100).toFixed(2)}</span>
                </div>
              )}
              {selectedAsset.modelId && (
                <div className="flex justify-between">
                  <span className="text-white/30">Model</span>
                  <span className="text-white/60">{selectedAsset.modelId}</span>
                </div>
              )}

              {/* Provenance */}
              {selectedAsset.generatedBy && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-white/30 mb-1">Provenance</p>
                  {selectedAsset.generatedBy.model && (
                    <p className="text-white/40">Model: {selectedAsset.generatedBy.model}</p>
                  )}
                  {selectedAsset.generatedBy.prompt && (
                    <p className="text-white/30 mt-1 text-[9px] bg-white/5 rounded p-2 max-h-20 overflow-y-auto">
                      {selectedAsset.generatedBy.prompt}
                    </p>
                  )}
                  {selectedAsset.generatedBy.blocks && Object.keys(selectedAsset.generatedBy.blocks).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(selectedAsset.generatedBy.blocks).map(([slug, ver]) => (
                        <span key={slug} className="text-[7px] px-1.5 py-0.5 bg-white/5 rounded text-white/30">
                          {slug} v{ver}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[8px] text-white/15 mt-2">
                {new Date(selectedAsset.createdAt).toLocaleString("de")}
              </p>
            </div>

            <button
              onClick={() => setSelectedAsset(null)}
              className="mt-3 w-full py-2 rounded-lg bg-white/5 text-white/40 text-xs hover:text-white/60"
            >
              Schliessen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
