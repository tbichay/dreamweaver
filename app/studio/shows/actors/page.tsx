"use client";

import { useEffect, useMemo, useState } from "react";
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
  persona: string;
  expertise: string[];
  defaultTone: string | null;
  ownerUserId: string | null;
  characterSheet: { front?: string; profile?: string; fullBody?: string } | null;
  portraitAssetId: string | null;
  _count: { shows: number };
}

function resolvePortrait(a: Pick<Actor, "portraitUrl" | "characterSheet" | "portraitAssetId">): string | null {
  if (a.portraitUrl) return a.portraitUrl;
  if (a.characterSheet?.front) return a.characterSheet.front;
  if (a.portraitAssetId?.startsWith("http")) return a.portraitAssetId;
  return null;
}

function isIncomplete(a: Pick<Actor, "voiceId" | "persona">): boolean {
  const voiceOk = !!a.voiceId && a.voiceId !== "PENDING";
  const personaOk = !!a.persona && !a.persona.includes("wird auf der Edit-Seite gefuellt");
  return !voiceOk || !personaOk;
}

// Completeness-Score: deckungsgleich mit ActorPickerGrid, damit der Primary-
// Vorschlag im Dedup-Tool dieselbe Karte ist die der Picker schon als Primary
// rendert. Sonst wuerde der Admin im Dedup-UI einen anderen "Gewinner"-Actor
// sehen als der im Picker.
function completenessScore(a: Actor): number {
  let s = 0;
  if (resolvePortrait(a)) s += 10;
  if (a.voiceId && a.voiceId !== "PENDING") s += 5;
  if (a.persona && !a.persona.includes("wird auf der Edit-Seite gefuellt")) s += 5;
  if (a.expertise.length > 0) s += 2;
  if (a.role) s += 1;
  s += Math.max(0, 5 - Math.floor(a.displayName.length / 2));
  return s;
}

interface DuplicateGroup {
  key: string;
  actors: Actor[]; // sortiert: Primary-Kandidat zuerst
}

function findDuplicates(actors: Actor[]): DuplicateGroup[] {
  const byKey = new Map<string, Actor[]>();
  for (const a of actors) {
    const name = a.displayName.trim().toLowerCase();
    const species = (a.species ?? "").toLowerCase();
    const key = `${name}|${species}`;
    const bucket = byKey.get(key) ?? [];
    bucket.push(a);
    byKey.set(key, bucket);
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, bucket] of byKey) {
    if (bucket.length < 2) continue;
    bucket.sort((a, b) => completenessScore(b) - completenessScore(a));
    groups.push({ key, actors: bucket });
  }
  groups.sort((a, b) => a.actors[0].displayName.localeCompare(b.actors[0].displayName));
  return groups;
}

type Tab = "all" | "dupes";

export default function ActorsListPage() {
  const router = useRouter();
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>("all");

  async function refresh() {
    const res = await fetch("/api/studio/shows/actors");
    const data = await res.json();
    setActors(data.actors || []);
  }

  useEffect(() => {
    // Inline fetch (statt refresh() aufzurufen) damit react-hooks/set-state-
    // in-effect nicht greift — setState landet in einer async-callback, nicht
    // synchron im Effect-Body.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/studio/shows/actors");
        const data = await res.json();
        if (!cancelled) setActors(data.actors || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createNew() {
    setCreating(true);
    const res = await fetch("/api/studio/shows/actors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Neuer Actor",
        voiceId: "21m00Tcm4TlvDq8ikWAM", // ElevenLabs default — admin muss anpassen
        persona: "(Beschreibung noch offen)",
        expertise: [],
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.actor?.id) router.push(`/studio/shows/actors/${data.actor.id}`);
  }

  const seedActors = actors.filter((a) => !a.ownerUserId);
  const customActors = actors.filter((a) => a.ownerUserId);
  const duplicates = useMemo(() => findDuplicates(actors), [actors]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Sub-tabs (Page-level navigation) */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/studio/shows"
          className="px-3 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 hover:bg-white/5"
        >
          Shows
        </Link>
        <Link
          href="/studio/shows/actors"
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#3d6b4a]/30 text-[#a8d5b8]"
        >
          Actors
        </Link>
        <Link
          href="/studio/shows/foki"
          className="px-3 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 hover:bg-white/5"
        >
          Foki
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#f5eed6]">Actors</h1>
          <p className="text-sm text-white/40">
            {loading ? "…" : `${actors.length} Actor${actors.length === 1 ? "" : "s"} · global + eigene`}
          </p>
        </div>
        <button
          onClick={createNew}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-[#C8A97E] text-[#141414] text-sm font-medium hover:bg-[#d4b88c] transition disabled:opacity-50"
        >
          {creating ? "…" : "+ Neuer Actor"}
        </button>
      </div>

      {/* View-Tabs (All / Dubletten) */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/10">
        <button
          onClick={() => setTab("all")}
          className={`px-3 py-2 text-[12px] border-b-2 transition ${
            tab === "all"
              ? "border-[#C8A97E] text-[#f5eed6]"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          Alle ({actors.length})
        </button>
        <button
          onClick={() => setTab("dupes")}
          className={`px-3 py-2 text-[12px] border-b-2 transition flex items-center gap-1.5 ${
            tab === "dupes"
              ? "border-[#C8A97E] text-[#f5eed6]"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          Dubletten
          {duplicates.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-200">
              {duplicates.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <p className="text-white/30 text-sm">Lade Actors…</p>
      ) : tab === "all" ? (
        <>
          {seedActors.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                KoalaTree Cast (Seed)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {seedActors.map((a) => (
                  <ActorCard key={a.id} actor={a} />
                ))}
              </div>
            </section>
          )}

          {customActors.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                Eigene Actors
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {customActors.map((a) => (
                  <ActorCard key={a.id} actor={a} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <DedupTab groups={duplicates} onMerged={refresh} />
      )}
    </div>
  );
}

function ActorCard({ actor }: { actor: Actor }) {
  const portrait = resolvePortrait(actor);
  const incomplete = isIncomplete(actor);
  return (
    <Link
      href={`/studio/shows/actors/${actor.id}`}
      className={`block rounded-lg border transition p-4 ${
        incomplete
          ? "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-400/60"
          : "border-white/10 bg-[#1A1A1A] hover:border-[#C8A97E]/50"
      }`}
    >
      <div className="flex items-start gap-3 mb-2">
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait}
            alt={actor.displayName}
            className="w-12 h-12 rounded-full object-cover border border-white/10 shrink-0"
          />
        ) : (
          <span className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-2xl shrink-0">
            {actor.emoji ?? "•"}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-[#f5eed6] font-semibold text-sm">{actor.displayName}</h3>
            {incomplete && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-200/90"
                title="Voice oder Persona fehlt"
              >
                ⚠ unvollständig
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/50">
            {actor.role ?? "—"} · {actor.species ?? "—"}
          </p>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 shrink-0">
          {actor._count.shows} shows
        </span>
      </div>
      {actor.description && (
        <p className="text-[11px] text-white/60 line-clamp-2 mb-2">{actor.description}</p>
      )}
      <div className="flex flex-wrap gap-1 mt-2">
        {actor.expertise.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="text-[9px] px-1.5 py-0.5 rounded bg-[#C8A97E]/10 text-[#C8A97E]/80"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

// ── Dedup-Tab ──────────────────────────────────────────────────────

function DedupTab({
  groups,
  onMerged,
}: {
  groups: DuplicateGroup[];
  onMerged: () => void | Promise<void>;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-8 text-center">
        <p className="text-4xl mb-3">✨</p>
        <p className="text-sm text-white/70">Keine Dubletten gefunden.</p>
        <p className="text-xs text-white/40 mt-1">
          Actors werden per displayName + species gruppiert.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-[12px] text-yellow-100/80">
        <strong className="text-yellow-200">
          {groups.length} Dublettengruppe{groups.length === 1 ? "" : "n"} gefunden.
        </strong>{" "}
        Beim Merge werden Portraits & Visual-Daten der Varianten im Primary unter{" "}
        <code className="text-[11px] bg-yellow-500/10 px-1 rounded">visualVariants</code> gesammelt,
        Cast-Eintraege umgehaengt (oder bei Kollision geloescht), DigitalActor-Aliases umgezogen und
        die Varianten-Actors geloescht. Aktion ist <em>nicht umkehrbar</em>. Bitte erst den Dry-Run
        nutzen.
      </div>
      {groups.map((g) => (
        <DedupGroupCard key={g.key} group={g} onMerged={onMerged} />
      ))}
    </div>
  );
}

function DedupGroupCard({
  group,
  onMerged,
}: {
  group: DuplicateGroup;
  onMerged: () => void | Promise<void>;
}) {
  const [primaryId, setPrimaryId] = useState<string>(group.actors[0].id);
  const [preview, setPreview] = useState<{
    showActorMoves?: { reassignCount: number; collisionCount: number; collisionShows: string[] };
    nonPrimaries?: Array<{
      id: string;
      displayName: string;
      showCount: number;
      digitalActorAliasCount: number;
      contributesVariant: boolean;
      isSeedActor: boolean;
    }>;
    newVariantCount?: number;
    totalVariantCountAfterMerge?: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mergeIds = group.actors.filter((a) => a.id !== primaryId).map((a) => a.id);

  async function runDryRun() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/shows/actors/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ primaryId, mergeIds, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Dry-Run fehlgeschlagen");
      } else {
        setPreview(data.preview);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runMerge() {
    if (!preview) {
      setError("Bitte zuerst Dry-Run ausfuehren.");
      return;
    }
    const confirmMsg = `Wirklich ${mergeIds.length} Actor${mergeIds.length === 1 ? "" : "s"} in "${group.actors.find((a) => a.id === primaryId)?.displayName}" mergen?\n\nNicht umkehrbar.`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/shows/actors/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ primaryId, mergeIds, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Merge fehlgeschlagen");
      } else {
        setDone(true);
        await onMerged();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
        <p className="text-sm text-green-200">
          ✓ Gemergt: {group.actors[0].displayName} ({mergeIds.length} Varianten absorbiert).
        </p>
      </div>
    );
  }

  const displayName = group.actors[0].displayName;
  const species = group.actors[0].species;

  return (
    <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[#f5eed6] font-semibold">
            {displayName} {species && <span className="text-white/40">· {species}</span>}
          </h3>
          <p className="text-[11px] text-white/50">{group.actors.length} Dubletten gefunden</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runDryRun}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[12px] text-white/70 disabled:opacity-50"
          >
            {busy ? "…" : "Dry-Run"}
          </button>
          <button
            onClick={runMerge}
            disabled={busy || !preview}
            className="px-3 py-1.5 rounded-lg bg-[#C8A97E] hover:bg-[#d4b88c] text-[#141414] text-[12px] font-medium disabled:opacity-50"
            title={!preview ? "Erst Dry-Run ausfuehren" : "Merge durchfuehren"}
          >
            Mergen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        {group.actors.map((a) => {
          const isPrimary = a.id === primaryId;
          const portrait = resolvePortrait(a);
          return (
            <label
              key={a.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                isPrimary
                  ? "border-[#C8A97E] bg-[#C8A97E]/10"
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
            >
              <input
                type="radio"
                name={`primary-${group.key}`}
                checked={isPrimary}
                onChange={() => {
                  setPrimaryId(a.id);
                  setPreview(null); // invalidate preview if primary changes
                }}
                className="mt-1"
              />
              {portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portrait}
                  alt={a.displayName}
                  className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl shrink-0">
                  {a.emoji ?? "•"}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-medium text-[#f5eed6]">
                    {isPrimary ? "Primary" : "wird absorbiert"}
                  </span>
                  {!a.ownerUserId && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-200">
                      seed
                    </span>
                  )}
                  {isIncomplete(a) && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-200">
                      ⚠
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-white/40 font-mono truncate" title={a.id}>
                  {a.id}
                </div>
                <div className="text-[10px] text-white/50 mt-0.5">
                  {a._count.shows} show{a._count.shows === 1 ? "" : "s"} · voice{" "}
                  {a.voiceId === "PENDING" ? "—" : a.voiceId.slice(0, 8) + "…"}
                  {portrait ? " · portrait ✓" : " · kein portrait"}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200 mb-2">
          {error}
        </div>
      )}

      {preview && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] text-white/70 space-y-1">
          <div className="font-semibold text-[#f5eed6]">Dry-Run Vorschau</div>
          <div>
            ShowActor-Moves: <strong className="text-white/90">{preview.showActorMoves?.reassignCount ?? 0}</strong>{" "}
            reassigns, <strong className="text-white/90">{preview.showActorMoves?.collisionCount ?? 0}</strong>{" "}
            Kollisionen (non-primary loeschen)
          </div>
          <div>
            Neue visualVariants: <strong className="text-white/90">{preview.newVariantCount ?? 0}</strong> (total
            danach: {preview.totalVariantCountAfterMerge ?? 0})
          </div>
          {preview.nonPrimaries && preview.nonPrimaries.length > 0 && (
            <ul className="pl-4 list-disc space-y-0.5 text-white/60">
              {preview.nonPrimaries.map((np) => (
                <li key={np.id}>
                  <span className="text-white/80">{np.displayName}</span> — {np.showCount}{" "}
                  show(s), {np.digitalActorAliasCount} DigitalActor-Alias(es)
                  {np.contributesVariant && " · + Variant"}
                  {np.isSeedActor && (
                    <span className="text-yellow-200 ml-1">⚠ seed wird geloescht</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
