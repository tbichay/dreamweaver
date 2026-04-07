"use client";

import { useState } from "react";

export interface PromptVersion {
  id: string;
  prompt: string;
  createdAt: string;
  videoUrl?: string;
  isSelected: boolean;
}

interface Props {
  versions: PromptVersion[];
  onSelect: (id: string) => void;
  onAdd: (prompt: string) => void;
  onDelete: (id: string) => void;
}

export default function PromptVersions({ versions, onSelect, onAdd, onDelete }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (versions.length <= 1) return null;

  const displayed = showAll ? versions : versions.slice(0, 3);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] text-white/20">{versions.length} Versionen</span>
        {versions.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[8px] text-white/30 hover:text-white/60"
          >
            {showAll ? "Weniger" : `Alle ${versions.length}`}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {displayed.map((v, i) => (
          <div
            key={v.id}
            className={`flex items-center gap-1.5 p-1.5 rounded-lg text-[8px] cursor-pointer transition-all ${
              v.isSelected
                ? "bg-[#4a7c59]/20 border border-[#4a7c59]/30"
                : "bg-white/[0.02] hover:bg-white/5 border border-transparent"
            }`}
            onClick={() => onSelect(v.id)}
          >
            <span className="text-white/30 shrink-0 w-4">v{i + 1}</span>
            <span className={`flex-1 truncate ${v.isSelected ? "text-[#a8d5b8]" : "text-white/40"}`}>
              {v.prompt.substring(0, 60)}...
            </span>
            {v.videoUrl && (
              <span className="text-[7px] text-[#a8d5b8]/60 shrink-0">🎬</span>
            )}
            {v.isSelected && (
              <span className="text-[7px] text-[#a8d5b8] shrink-0">✓</span>
            )}
            {!v.isSelected && versions.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(v.id); }}
                className="text-red-400/30 hover:text-red-400/70 shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
