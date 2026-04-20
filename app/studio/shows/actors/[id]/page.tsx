"use client";

/**
 * Actor-Edit-Seite.
 *
 * Seed-Actors (ownerUserId=null) sind editierbar, aber ein Banner warnt:
 * "Ein neuer Seed-Run überschreibt deine Änderungen." Custom Actors sind
 * frei editierbar + löschbar (wenn nicht in Shows besetzt).
 *
 * Voice-Preview: /api/studio/tts-preview existiert bereits im Codebase.
 */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Actor {
  id: string;
  displayName: string;
  species: string | null;
  role: string | null;
  description: string | null;
  emoji: string | null;
  color: string | null;
  portraitUrl: string | null;
  voiceId: string;
  voiceSettings: Record<string, number>;
  persona: string;
  ageStyles: Record<string, string>;
  expertise: string[];
  defaultTone: string | null;
  ownerUserId: string | null;
  _count: { shows: number };
}

const AGE_KEYS = ["3-5", "6-8", "9-12", "13+"];

export default function ActorEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/studio/shows/actors/${id}`);
    const data = await res.json();
    if (!res.ok) setError(data.error || "Load failed");
    else setActor(data.actor);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string) {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(null), 1800);
  }

  async function save(updates: Partial<Actor>) {
    if (!actor) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/shows/actors/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setActor(data.actor);
      flash("Gespeichert");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirm("Actor löschen?")) return;
    const res = await fetch(`/api/studio/shows/actors/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    router.push("/studio/shows/actors");
  }

  if (loading) return <div className="text-white/40 text-sm p-8">Lade Actor…</div>;
  if (error || !actor) return <div className="text-red-400 text-sm p-8">{error ?? "Nicht gefunden"}</div>;

  const isSeed = !actor.ownerUserId;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/studio/shows/actors" className="text-white/40 hover:text-white/70 text-xs">
          ← Actors
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-4xl">{actor.emoji ?? "•"}</span>
          <div>
            <h1 className="text-xl font-bold text-[#f5eed6]">{actor.displayName}</h1>
            <p className="text-[10px] text-white/30 font-mono">id: {actor.id}</p>
          </div>
          {isSeed && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
              SEED
            </span>
          )}
          {actor._count.shows > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60">
              {actor._count.shows} Show(s) besetzt
            </span>
          )}
        </div>
      </div>

      {isSeed && (
        <div className="mb-5 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-xs text-yellow-200/80">
            ⚠️ Seed-Actor. Änderungen gehen bei einem erneuten <code className="font-mono">seed-shows.ts</code>-Lauf verloren. Für dauerhafte Anpassungen den Seed-Code in{" "}
            <code className="font-mono">prisma/seed-shows.ts</code> + <code className="font-mono">lib/prompts.ts</code> aktualisieren.
          </p>
        </div>
      )}

      {saveMsg && (
        <div className="mb-4 text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded px-3 py-2">
          ✓ {saveMsg}
        </div>
      )}

      <ActorForm
        key={actor.id + actor.voiceId}
        actor={actor}
        saving={saving}
        onSave={save}
        onDelete={!isSeed ? doDelete : undefined}
      />
    </div>
  );
}

function ActorForm({
  actor,
  saving,
  onSave,
  onDelete,
}: {
  actor: Actor;
  saving: boolean;
  onSave: (updates: Partial<Actor>) => void;
  onDelete?: () => void;
}) {
  const [displayName, setDisplayName] = useState(actor.displayName);
  const [emoji, setEmoji] = useState(actor.emoji ?? "");
  const [color, setColor] = useState(actor.color ?? "#C8A97E");
  const [species, setSpecies] = useState(actor.species ?? "");
  const [role, setRole] = useState(actor.role ?? "");
  const [description, setDescription] = useState(actor.description ?? "");
  const [persona, setPersona] = useState(actor.persona);
  const [defaultTone, setDefaultTone] = useState(actor.defaultTone ?? "");
  const [expertiseText, setExpertiseText] = useState(actor.expertise.join(", "));
  const [voiceId, setVoiceId] = useState(actor.voiceId);
  const [voiceSettingsText, setVoiceSettingsText] = useState(JSON.stringify(actor.voiceSettings, null, 2));
  const [ageStylesText, setAgeStylesText] = useState(JSON.stringify(actor.ageStyles, null, 2));
  const [portraitUrl, setPortraitUrl] = useState(actor.portraitUrl ?? "");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function saveAll() {
    let voiceSettings: Record<string, number>;
    let ageStyles: Record<string, string>;
    try {
      voiceSettings = JSON.parse(voiceSettingsText);
      ageStyles = JSON.parse(ageStylesText);
    } catch {
      alert("voiceSettings/ageStyles sind kein valides JSON.");
      return;
    }
    onSave({
      displayName,
      emoji: emoji || null,
      color: color || null,
      species: species || null,
      role: role || null,
      description: description || null,
      persona,
      defaultTone: defaultTone || null,
      expertise: expertiseText.split(",").map((s) => s.trim()).filter(Boolean),
      voiceId,
      voiceSettings: voiceSettings as unknown as Record<string, number>,
      ageStyles,
      portraitUrl: portraitUrl || null,
    });
  }

  async function playPreview() {
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const res = await fetch("/api/studio/tts-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voiceId,
          text: `Hallo, ich bin ${displayName}. ${description || persona.slice(0, 120)}`,
          voiceSettings: JSON.parse(voiceSettingsText),
        }),
      });
      if (!res.ok) throw new Error("TTS-Preview fehlgeschlagen");
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[auto_auto_1fr] gap-3 items-end">
        <Field label="Emoji">
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={2}
            className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-center text-2xl w-16"
          />
        </Field>
        <Field label="Farbe">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-16 h-10 rounded cursor-pointer border border-white/10"
          />
        </Field>
        <Field label="Name"><TextInput value={displayName} onChange={setDisplayName} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Spezies"><TextInput value={species} onChange={setSpecies} placeholder="Koala, Vogel…" /></Field>
        <Field label="Rolle"><TextInput value={role} onChange={setRole} placeholder="Der Weise, Die Erzählerin…" /></Field>
      </div>

      <Field label="Kurz-Beschreibung">
        <TextArea value={description} onChange={setDescription} rows={2} />
      </Field>

      <Field
        label="Persona (Prompt-Fragment)"
        hint="Age-agnostisch. Wird bei jeder Generation an den System-Prompt angehängt."
      >
        <TextArea value={persona} onChange={setPersona} rows={5} />
      </Field>

      <Field
        label="Age-Styles (JSON)"
        hint="Tonale Anpassungen pro Altersgruppe. Keys: 3-5, 6-8, 9-12, 13+."
      >
        <TextArea value={ageStylesText} onChange={setAgeStylesText} rows={8} mono />
        <div className="text-[10px] text-white/30 mt-1">
          Erwartete Keys: {AGE_KEYS.join(", ")}
        </div>
      </Field>

      <Field label="Default-Tone">
        <TextInput value={defaultTone} onChange={setDefaultTone} placeholder="warm-narrator, calm-coach…" />
      </Field>

      <Field label="Expertise (kommasepariert)">
        <TextInput value={expertiseText} onChange={setExpertiseText} placeholder="meditation, traumreisen, …" />
      </Field>

      {/* Voice */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <h3 className="text-xs font-medium text-white/60 uppercase tracking-wide">Voice</h3>

        <Field label="ElevenLabs Voice-ID">
          <TextInput value={voiceId} onChange={setVoiceId} />
        </Field>

        <Field label="Voice-Settings (JSON)">
          <TextArea value={voiceSettingsText} onChange={setVoiceSettingsText} rows={6} mono />
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={playPreview}
            disabled={previewLoading || !voiceId}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 text-xs hover:bg-white/10 disabled:opacity-40"
          >
            {previewLoading ? "Generiert…" : "▶ Voice-Preview"}
          </button>
          {previewUrl && <audio src={previewUrl} controls className="h-8" />}
        </div>
      </div>

      <Field label="Portrait-URL">
        <TextInput value={portraitUrl} onChange={setPortraitUrl} placeholder="https://…" />
      </Field>

      <div className="flex items-center gap-3 pt-4 border-t border-white/10">
        <button
          onClick={saveAll}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-[#C8A97E] text-[#141414] text-sm font-medium hover:bg-[#d4b88c] disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="ml-auto px-4 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm"
          >
            Löschen
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/60 mb-2">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-white/30 mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:border-[#C8A97E]/50 focus:outline-none"
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 4,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={`w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:border-[#C8A97E]/50 focus:outline-none resize-y ${
        mono ? "font-mono text-[11px]" : ""
      }`}
    />
  );
}
