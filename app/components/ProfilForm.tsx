"use client";

import { useState, KeyboardEvent } from "react";
import { HoererProfil } from "@/lib/types";
import { berechneAlter, getInteressenFuerAlter, getCharakterFuerAlter } from "@/lib/utils";

interface Props {
  onSave: (profil: HoererProfil) => void;
  initial?: HoererProfil;
}

export default function ProfilForm({ onSave, initial }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || "");
  const [geburtsdatum, setGeburtsdatum] = useState(
    initial?.geburtsdatum ? initial.geburtsdatum.split("T")[0] : ""
  );
  const [geschlecht, setGeschlecht] = useState<"m" | "w" | "d" | undefined>(initial?.geschlecht);
  const [interessen, setInteressen] = useState<string[]>(initial?.interessen || []);
  const [lieblingsfarbe, setLieblingsfarbe] = useState(initial?.lieblingsfarbe || "");
  const [lieblingstier, setLieblingstier] = useState(initial?.lieblingstier || "");
  const [charakter, setCharakter] = useState<string[]>(initial?.charaktereigenschaften || []);
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [herausforderungen, setHerausforderungen] = useState(initial?.herausforderungen?.join(", ") || "");

  const alter = geburtsdatum ? berechneAlter(geburtsdatum) : 5;
  const interessenVorschlaege = getInteressenFuerAlter(alter);
  const charakterVorschlaege = getCharakterFuerAlter(alter);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = () => {
    const profil: HoererProfil = {
      id: initial?.id || crypto.randomUUID(),
      name,
      geburtsdatum: geburtsdatum ? new Date(geburtsdatum).toISOString() : undefined,
      alter: geburtsdatum ? berechneAlter(geburtsdatum) : undefined,
      geschlecht,
      interessen,
      lieblingsfarbe: lieblingsfarbe || undefined,
      lieblingstier: lieblingstier || undefined,
      charaktereigenschaften: charakter,
      herausforderungen: herausforderungen ? herausforderungen.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
    onSave(profil);
  };

  const quickTags = alter <= 6
    ? ["hat Angst vor Dunkelheit", "neues Geschwisterchen", "Eingewöhnung Kita", "Trennungsangst"]
    : alter <= 12
    ? ["Schulwechsel", "Mobbing", "neues Geschwisterchen", "Scheidung der Eltern", "Leistungsdruck"]
    : alter <= 17
    ? ["Prüfungsstress", "Identitätsfindung", "Liebeskummer", "Social Media Druck", "Zukunftsangst"]
    : ["Burnout", "Schlafprobleme", "Beziehungsstress", "Selbstzweifel", "Neuanfang", "Trauer"];

  const steps = [
    // Step 0: Basics
    <div key="basics" className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-2">
        {initial ? `${name} bearbeiten` : "Neues Profil erstellen"}
      </h2>
      <p className="text-center text-white/60 mb-6">
        {alter >= 18
          ? "Erzähl Koda von dir, damit jede Geschichte persönlich wird."
          : "Erzähl Koda von deinem Kind, damit jede Geschichte persönlich wird."}
      </p>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name eingeben..."
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">Geburtsdatum</label>
        <input
          type="date"
          value={geburtsdatum}
          onChange={(e) => setGeburtsdatum(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="w-full"
        />
        {geburtsdatum && (
          <p className="text-xs text-[#d4a853] mt-1">
            {alter} Jahre — Geschichten werden automatisch angepasst
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">Geschlecht (optional)</label>
        <div className="flex gap-3">
          {([["m", "Männlich"], ["w", "Weiblich"], ["d", "Divers"]] as const).map(([value, label]) => (
            <button
              key={value}
              className={`chip ${geschlecht === value ? "chip-selected" : ""}`}
              onClick={() => setGeschlecht(geschlecht === value ? undefined : value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Step 1: Interessen
    <div key="interessen" className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-2">
        Was {alter >= 18 ? "interessiert dich" : `liebt ${name || "dein Kind"}`}?
      </h2>
      <p className="text-center text-white/60 mb-6">
        Wähle Interessen aus — sie werden Teil der Geschichte.
        {alter > 0 && <span className="text-[#d4a853]"> (Vorschläge für {alter} Jahre)</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {interessenVorschlaege.map((interesse) => (
          <button
            key={interesse}
            className={`chip ${interessen.includes(interesse) ? "chip-selected" : ""}`}
            onClick={() => toggleItem(interessen, setInteressen, interesse)}
          >
            {interesse}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Lieblingstier</label>
          <input
            type="text"
            value={lieblingstier}
            onChange={(e) => setLieblingstier(e.target.value)}
            placeholder="z.B. Katze, Drache..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Lieblingsfarbe</label>
          <input
            type="text"
            value={lieblingsfarbe}
            onChange={(e) => setLieblingsfarbe(e.target.value)}
            placeholder="z.B. Blau, Gold..."
          />
        </div>
      </div>
    </div>,

    // Step 2: Charakter & Tags
    <div key="charakter" className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-2">
        {alter >= 18 ? "Wie bist du?" : `Wie ist ${name || "dein Kind"}`}?
      </h2>
      <p className="text-center text-white/60 mb-6">
        Diese Eigenschaften helfen Koda, die Geschichte anzupassen.
      </p>
      <div className="flex flex-wrap gap-2">
        {charakterVorschlaege.map((eigenschaft) => (
          <button
            key={eigenschaft}
            className={`chip ${charakter.includes(eigenschaft) ? "chip-selected" : ""}`}
            onClick={() => toggleItem(charakter, setCharakter, eigenschaft)}
          >
            {eigenschaft}
          </button>
        ))}
      </div>

      {/* Free Tags */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-white/70 mb-2">
          Persönliche Tags <span className="text-white/40">(optional)</span>
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="z.B. 'hat Angst vor Dunkelheit' + Enter"
            className="flex-1"
          />
          <button
            className="chip chip-selected px-4"
            onClick={addTag}
            type="button"
          >
            +
          </button>
        </div>
        {/* Quick-add suggestions */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {quickTags.filter((t) => !tags.includes(t)).slice(0, 4).map((suggestion) => (
            <button
              key={suggestion}
              className="text-xs bg-[#d4a853]/10 text-[#d4a853]/70 rounded-full px-2.5 py-1 hover:bg-[#d4a853]/20 transition-colors"
              onClick={() => setTags([...tags, suggestion])}
            >
              + {suggestion}
            </button>
          ))}
        </div>
        {/* Active tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-[#d4a853]/15 text-[#d4a853] rounded-full px-2.5 py-1 flex items-center gap-1"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-400 transition-colors ml-0.5"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-white/70 mb-1">
          Aktuelle Herausforderungen (optional)
        </label>
        <input
          type="text"
          value={herausforderungen}
          onChange={(e) => setHerausforderungen(e.target.value)}
          placeholder="z.B. Einschulung, neues Geschwisterchen..."
        />
        <p className="text-xs text-white/40 mt-1">Kommagetrennt — hilft Koda, die Geschichte einfühlsam zu gestalten</p>
      </div>
    </div>,
  ];

  const canProceed = step === 0 ? name.trim().length > 0 : true;

  return (
    <div className="card p-8 max-w-lg mx-auto">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === step ? "bg-[#3d6b4a] scale-125" : i < step ? "bg-[#3d6b4a]/50" : "bg-white/20"
            }`}
          />
        ))}
      </div>

      {steps[step]}

      <div className="flex justify-between mt-8">
        {step > 0 ? (
          <button className="chip" onClick={() => setStep(step - 1)}>
            Zurück
          </button>
        ) : (
          <div />
        )}
        {step < steps.length - 1 ? (
          <button
            className="btn-primary"
            disabled={!canProceed}
            onClick={() => setStep(step + 1)}
          >
            Weiter
          </button>
        ) : (
          <button className="btn-primary" onClick={handleSubmit}>
            {initial ? "Profil aktualisieren" : "Profil speichern"}
          </button>
        )}
      </div>
    </div>
  );
}
