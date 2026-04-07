"use client";

import { useState } from "react";

interface RenderInfo {
  renderCommand: string;
  instructions: string[];
  totalClips: number;
  totalSize: number;
}

export interface MasteringSettings {
  warmth: number;         // -1 to 1
  musicVolume: number;    // 0 to 0.3
  crossfadeDuration: number; // 0 to 2 seconds
  includeIntro: boolean;
  includeOutro: boolean;
}

interface Props {
  settings: MasteringSettings;
  onChange: (settings: MasteringSettings) => void;
  onRender: () => void;
  rendering: boolean;
  completedScenes: number;
  geschichteId?: string;
}

export const DEFAULT_MASTERING_SETTINGS: MasteringSettings = {
  warmth: 0.3,
  musicVolume: 0.08,
  crossfadeDuration: 0.5,
  includeIntro: true,
  includeOutro: true,
};

export default function MasteringPanel({ settings, onChange, onRender, rendering, completedScenes, geschichteId }: Props) {
  const [renderInfo, setRenderInfo] = useState<RenderInfo | null>(null);
  const [showRenderInfo, setShowRenderInfo] = useState(false);

  const update = (key: keyof MasteringSettings, value: number | boolean) => {
    onChange({ ...settings, [key]: value });
  };

  const handleRender = async () => {
    if (geschichteId) {
      const res = await fetch(`/api/admin/render-film?geschichteId=${geschichteId}`);
      if (res.ok) {
        const data = await res.json();
        setRenderInfo(data);
        setShowRenderInfo(true);
      }
    }
    onRender();
  };

  return (
    <div className="bg-white/5 rounded-xl p-4">
      <h3 className="text-xs font-medium text-[#f5eed6] mb-3 flex items-center gap-2">
        🎬 Mastering
        {completedScenes < 2 && (
          <span className="text-[9px] text-white/30">(mindestens 2 Szenen noetig)</span>
        )}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {/* Color Temperature */}
        <div>
          <label className="text-[10px] text-white/30 block mb-1">🎨 Farbtemperatur</label>
          <input
            type="range"
            min={-100}
            max={100}
            value={settings.warmth * 100}
            onChange={(e) => update("warmth", parseInt(e.target.value) / 100)}
            className="w-full h-1 accent-[#d4a853]"
          />
          <div className="flex justify-between text-[8px] text-white/20 mt-0.5">
            <span>Kalt</span>
            <span>Warm</span>
          </div>
        </div>

        {/* Music Volume */}
        <div>
          <label className="text-[10px] text-white/30 block mb-1">🎵 Hintergrundmusik</label>
          <input
            type="range"
            min={0}
            max={30}
            value={settings.musicVolume * 100}
            onChange={(e) => update("musicVolume", parseInt(e.target.value) / 100)}
            className="w-full h-1 accent-[#a8d5b8]"
          />
          <div className="flex justify-between text-[8px] text-white/20 mt-0.5">
            <span>Aus</span>
            <span>{Math.round(settings.musicVolume * 100)}%</span>
          </div>
        </div>

        {/* Crossfade */}
        <div>
          <label className="text-[10px] text-white/30 block mb-1">↔️ Crossfade</label>
          <input
            type="range"
            min={0}
            max={200}
            value={settings.crossfadeDuration * 100}
            onChange={(e) => update("crossfadeDuration", parseInt(e.target.value) / 100)}
            className="w-full h-1 accent-[#6bb5c9]"
          />
          <div className="text-[8px] text-white/20 mt-0.5 text-center">
            {settings.crossfadeDuration.toFixed(1)}s
          </div>
        </div>

        {/* Intro/Outro */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeIntro}
              onChange={(e) => update("includeIntro", e.target.checked)}
              className="rounded accent-[#4a7c59]"
            />
            Vorspann
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeOutro}
              onChange={(e) => update("includeOutro", e.target.checked)}
              className="rounded accent-[#4a7c59]"
            />
            Abspann
          </label>
        </div>
      </div>

      <button
        onClick={handleRender}
        disabled={rendering || completedScenes < 2}
        className="btn-primary text-xs px-4 py-2 w-full disabled:opacity-40"
      >
        {rendering ? "Wird gerendert..." : `Film rendern (${completedScenes} Szenen)`}
      </button>

      {showRenderInfo && renderInfo && (
        <div className="mt-3 p-3 bg-white/5 rounded-lg">
          <p className="text-[10px] text-[#a8d5b8] font-medium mb-2">{renderInfo.totalClips} Clips bereit</p>
          <div className="space-y-1">
            {renderInfo.instructions.map((step, i) => (
              <p key={i} className="text-[9px] text-white/40">{step}</p>
            ))}
          </div>
          <div className="mt-2 p-2 bg-black/30 rounded font-mono text-[9px] text-[#a8d5b8]">
            {renderInfo.renderCommand}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(renderInfo.renderCommand)}
            className="mt-1 text-[8px] text-white/30 hover:text-white/60"
          >
            Befehl kopieren
          </button>
        </div>
      )}
    </div>
  );
}
