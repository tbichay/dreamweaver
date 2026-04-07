"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import FilmProjects from "../../components/FilmProjects";
import FilmEditor from "../../components/FilmEditor";
import AssetBrowser from "../../components/AssetBrowser";
import StudioVideos from "../../components/StudioVideos";

// Lazy load settings to avoid SSR issues with localStorage
const FilmSettings = dynamic(() => import("./settings/page"), { ssr: false });

type Tab = "projekte" | "editor" | "assets" | "marketing" | "settings";

export default function FilmMakerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("projekte");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const openProject = (id: string) => {
    setSelectedProjectId(id);
    setActiveTab("editor");
  };

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "projekte", label: "Projekte", emoji: "📁" },
    { id: "editor", label: "Editor", emoji: "🎬" },
    { id: "assets", label: "Assets", emoji: "🎨" },
    { id: "marketing", label: "Marketing", emoji: "📢" },
    { id: "settings", label: "Einstellungen", emoji: "⚙️" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#f5eed6]">🎥 Film Studio</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs transition-all ${
              activeTab === tab.id
                ? "bg-[#3d6b4a]/40 text-[#a8d5b8] font-medium shadow-sm"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <span>{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "projekte" && (
        <FilmProjects onOpenProject={openProject} />
      )}

      {activeTab === "editor" && (
        <FilmEditor projectId={selectedProjectId} onBack={() => setActiveTab("projekte")} />
      )}

      {activeTab === "assets" && (
        <AssetBrowser />
      )}

      {activeTab === "marketing" && (
        <StudioVideos />
      )}

      {activeTab === "settings" && (
        <FilmSettings />
      )}
    </div>
  );
}
