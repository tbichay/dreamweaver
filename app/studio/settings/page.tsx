"use client";

import { useState, useEffect } from "react";

interface CharacterDef {
  name: string;
  tier: string;
  emoji: string;
  color: string;
  description: string;
  accessories: string;
  defaultBackground: string;
}

interface ProjectConfig {
  id: string | null;
  name: string;
  description: string;
  stylePrompt: string;
  characters: Record<string, CharacterDef>;
  isDefault: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function SettingsPage() {
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Style prompt state
  const [stylePrompt, setStylePrompt] = useState("");
  const [styleIsDefault, setStyleIsDefault] = useState(true);
  const [styleSaveStatus, setStyleSaveStatus] = useState<SaveStatus>("idle");

  // Characters state
  const [characters, setCharacters] = useState<Record<string, CharacterDef>>({});
  const [charSaveStatus, setCharSaveStatus] = useState<SaveStatus>("idle");
  const [newCharKey, setNewCharKey] = useState("");
  const [showNewCharForm, setShowNewCharForm] = useState(false);

  // Project info state
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [infoSaveStatus, setInfoSaveStatus] = useState<SaveStatus>("idle");

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/admin/project-config");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data: ProjectConfig = await res.json();
      setConfig(data);
      setStylePrompt(data.stylePrompt);
      setStyleIsDefault(data.isDefault);
      setCharacters(data.characters);
      setProjectName(data.name);
      setProjectDescription(data.description || "");
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const saveStylePrompt = async () => {
    setStyleSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/project-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: config?.id,
          stylePrompt,
        }),
      });
      if (!res.ok) throw new Error();
      setStyleIsDefault(false);
      setStyleSaveStatus("saved");
      setTimeout(() => setStyleSaveStatus("idle"), 2000);
    } catch {
      setStyleSaveStatus("error");
      setTimeout(() => setStyleSaveStatus("idle"), 3000);
    }
  };

  const resetStylePrompt = async () => {
    setStyleSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/project-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: config?.id,
          stylePrompt: null,
        }),
      });
      if (!res.ok) throw new Error();
      // Reload to get the default prompt
      await loadConfig();
      setStyleSaveStatus("saved");
      setTimeout(() => setStyleSaveStatus("idle"), 2000);
    } catch {
      setStyleSaveStatus("error");
      setTimeout(() => setStyleSaveStatus("idle"), 3000);
    }
  };

  const updateCharacter = (key: string, field: keyof CharacterDef, value: string) => {
    setCharacters((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const removeCharacter = (key: string) => {
    setCharacters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addCharacter = () => {
    const key = newCharKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || characters[key]) return;
    setCharacters((prev) => ({
      ...prev,
      [key]: {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        tier: "",
        emoji: "",
        color: "#a8d5b8",
        description: "",
        accessories: "",
        defaultBackground: "golden",
      },
    }));
    setNewCharKey("");
    setShowNewCharForm(false);
  };

  const saveCharacters = async () => {
    setCharSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/project-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: config?.id,
          characters,
        }),
      });
      if (!res.ok) throw new Error();
      setCharSaveStatus("saved");
      setTimeout(() => setCharSaveStatus("idle"), 2000);
    } catch {
      setCharSaveStatus("error");
      setTimeout(() => setCharSaveStatus("idle"), 3000);
    }
  };

  const saveProjectInfo = async () => {
    setInfoSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/project-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: config?.id,
          name: projectName,
          description: projectDescription,
        }),
      });
      if (!res.ok) throw new Error();
      setInfoSaveStatus("saved");
      setTimeout(() => setInfoSaveStatus("idle"), 2000);
    } catch {
      setInfoSaveStatus("error");
      setTimeout(() => setInfoSaveStatus("idle"), 3000);
    }
  };

  const statusLabel = (status: SaveStatus) => {
    switch (status) {
      case "saving":
        return "Speichert...";
      case "saved":
        return "Gespeichert";
      case "error":
        return "Fehler beim Speichern";
      default:
        return null;
    }
  };

  const statusColor = (status: SaveStatus) => {
    switch (status) {
      case "saving":
        return "text-white/40";
      case "saved":
        return "text-green-400";
      case "error":
        return "text-red-400";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 pb-24 sm:pb-8">
        <h1 className="text-xl font-bold text-[#f5eed6] mb-1">Einstellungen</h1>
        <p className="text-sm text-white/40">Lade Konfiguration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-24 sm:pb-8 space-y-10">
      <div>
        <h1 className="text-xl font-bold text-[#f5eed6] mb-1">Einstellungen</h1>
        <p className="text-sm text-white/40 mb-6">
          Stil-Prompt, Charaktere und Projekt-Konfiguration verwalten.
        </p>
      </div>

      {/* ── Section 1: Stil-Prompt ──────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold text-[#f5eed6]">Stil-Prompt</h2>
          {styleIsDefault && (
            <span className="text-[10px] uppercase tracking-wider bg-white/10 text-white/50 px-2 py-0.5 rounded">
              Standard
            </span>
          )}
          {!styleIsDefault && (
            <span className="text-[10px] uppercase tracking-wider bg-[#4a7c59]/30 text-[#a8d5b8] px-2 py-0.5 rounded">
              Angepasst
            </span>
          )}
        </div>
        <p className="text-xs text-white/40 mb-3">
          Dieser Prompt wird allen Bildgenerierungen vorangestellt.
        </p>
        <textarea
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
          rows={8}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-[#4a7c59] resize-y"
          placeholder="Stil-Prompt eingeben..."
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={saveStylePrompt}
            disabled={styleSaveStatus === "saving"}
            className="px-4 py-1.5 text-xs font-medium bg-[#4a7c59] text-white rounded hover:bg-[#5a8c69] disabled:opacity-50 transition-colors"
          >
            Speichern
          </button>
          <button
            onClick={resetStylePrompt}
            disabled={styleSaveStatus === "saving"}
            className="px-4 py-1.5 text-xs font-medium bg-white/5 border border-white/10 text-white/60 rounded hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            Zuruecksetzen
          </button>
          {styleSaveStatus !== "idle" && (
            <span className={`text-xs ${statusColor(styleSaveStatus)}`}>
              {statusLabel(styleSaveStatus)}
            </span>
          )}
        </div>
      </section>

      {/* ── Section 2: Charaktere ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-[#f5eed6]">Charaktere</h2>
            <p className="text-xs text-white/40 mt-1">
              {Object.keys(characters).length} Charaktere konfiguriert.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {charSaveStatus !== "idle" && (
              <span className={`text-xs ${statusColor(charSaveStatus)}`}>
                {statusLabel(charSaveStatus)}
              </span>
            )}
            <button
              onClick={saveCharacters}
              disabled={charSaveStatus === "saving"}
              className="px-4 py-1.5 text-xs font-medium bg-[#4a7c59] text-white rounded hover:bg-[#5a8c69] disabled:opacity-50 transition-colors"
            >
              Alle speichern
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {Object.entries(characters).map(([key, char]) => (
            <div key={key} className="card p-4">
              <div className="flex items-start gap-4">
                {/* Left: Emoji + Color */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <span className="text-2xl">{char.emoji || "?"}</span>
                  <div
                    className="w-6 h-6 rounded-full border border-white/20"
                    style={{ backgroundColor: char.color }}
                  />
                </div>

                {/* Right: Fields */}
                <div className="flex-1 space-y-3">
                  {/* Row 1: Name, Tier, Key, Emoji, Color */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => updateCharacter(key, "name", e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-[#4a7c59]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                        Tier
                      </label>
                      <input
                        type="text"
                        value={char.tier}
                        onChange={(e) => updateCharacter(key, "tier", e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-[#4a7c59]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                        Schluessel
                      </label>
                      <input
                        type="text"
                        value={key}
                        disabled
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/30 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                        Emoji
                      </label>
                      <input
                        type="text"
                        value={char.emoji}
                        onChange={(e) => updateCharacter(key, "emoji", e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-[#4a7c59]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                        Farbe
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="color"
                          value={char.color}
                          onChange={(e) => updateCharacter(key, "color", e.target.value)}
                          className="w-8 h-7 bg-transparent border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={char.color}
                          onChange={(e) => updateCharacter(key, "color", e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-[#4a7c59]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Description */}
                  <div>
                    <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                      Beschreibung
                    </label>
                    <textarea
                      value={char.description}
                      onChange={(e) => updateCharacter(key, "description", e.target.value)}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-[#4a7c59] resize-y"
                      placeholder="Visuelle Beschreibung fuer Prompts..."
                    />
                  </div>

                  {/* Row 3: Accessories + Background */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                        Accessoires
                      </label>
                      <input
                        type="text"
                        value={char.accessories}
                        onChange={(e) => updateCharacter(key, "accessories", e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-[#4a7c59]"
                        placeholder="z.B. Brille, Hut, Schal..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                        Standard-Hintergrund
                      </label>
                      <select
                        value={char.defaultBackground}
                        onChange={(e) => updateCharacter(key, "defaultBackground", e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-[#4a7c59]"
                      >
                        <option value="golden">Golden</option>
                        <option value="blue">Blau</option>
                        <option value="night">Nacht</option>
                        <option value="dawn">Morgen</option>
                        <option value="sunny">Sonnig</option>
                      </select>
                    </div>
                  </div>

                  {/* Remove button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeCharacter(key)}
                      className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      Charakter entfernen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add character */}
        <div className="mt-4">
          {showNewCharForm ? (
            <div className="card p-4 flex items-end gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
                  Schluessel (z.B. &quot;koda&quot;, &quot;luna&quot;)
                </label>
                <input
                  type="text"
                  value={newCharKey}
                  onChange={(e) => setNewCharKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCharacter()}
                  placeholder="neuer_charakter"
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-[#4a7c59]"
                  autoFocus
                />
              </div>
              <button
                onClick={addCharacter}
                disabled={!newCharKey.trim()}
                className="px-4 py-1.5 text-xs font-medium bg-[#4a7c59] text-white rounded hover:bg-[#5a8c69] disabled:opacity-50 transition-colors"
              >
                Hinzufuegen
              </button>
              <button
                onClick={() => {
                  setShowNewCharForm(false);
                  setNewCharKey("");
                }}
                className="px-4 py-1.5 text-xs font-medium bg-white/5 border border-white/10 text-white/60 rounded hover:bg-white/10 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCharForm(true)}
              className="px-4 py-1.5 text-xs font-medium bg-white/5 border border-white/10 text-white/60 rounded hover:bg-white/10 transition-colors"
            >
              + Charakter hinzufuegen
            </button>
          )}
        </div>
      </section>

      {/* ── Section 3: Projekt-Info ─────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-[#f5eed6] mb-3">Projekt-Info</h2>
        <div className="card p-4 space-y-4">
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
              Projektname
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-[#4a7c59]"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">
              Beschreibung
            </label>
            <input
              type="text"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-[#4a7c59]"
              placeholder="Kurze Projektbeschreibung..."
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveProjectInfo}
              disabled={infoSaveStatus === "saving"}
              className="px-4 py-1.5 text-xs font-medium bg-[#4a7c59] text-white rounded hover:bg-[#5a8c69] disabled:opacity-50 transition-colors"
            >
              Speichern
            </button>
            {infoSaveStatus !== "idle" && (
              <span className={`text-xs ${statusColor(infoSaveStatus)}`}>
                {statusLabel(infoSaveStatus)}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
