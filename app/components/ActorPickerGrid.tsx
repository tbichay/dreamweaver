"use client";

/**
 * ActorPickerGrid — gemeinsamer Multi-Select-Picker fuer Actors.
 *
 * Wird vom Show-Wizard (Step 1, Cast selbst waehlen) und vom Show-Detail
 * CastTab (Actors hinzufuegen) genutzt. Loest die "hässliche Liste"-
 * Beschwerde des Users (Apr 2026):
 *
 *   1. Portraits werden gerendert (Fallback-Chain: portraitUrl →
 *      characterSheet.front → portraitAssetId wenn URL → Emoji).
 *   2. Dedup-Collapse: Actors mit gleichem displayName + species werden
 *      zu EINER Karte zusammengefasst. Der "primaere" Actor (der mit
 *      vollstaendigstem Profil: Portrait + Voice + Persona) vertritt
 *      die Gruppe. Varianten-Count als Badge. Wenn der User einen anderen
 *      Actor-Variant will, kann er per Dropdown innerhalb der Karte
 *      umschalten — der Picker selektiert dann den spezifischen Actor-ID.
 *   3. Filter-Leiste: Search (Name/Persona), Species, Role, Nur-Vollstaendige.
 *   4. Edit-Shortcut: Hover-Icon oeffnet /studio/shows/actors/[id] in neuem Tab.
 *   5. "→ Actor-Library" + "+ Actor anlegen" Shortcuts.
 *
 * Die Dubletten-Ursache selbst (DigitalActor-Migration hat pro Visual-Style
 * einen eigenen Actor erzeugt) ist Datenschrott — die bleibende Loesung
 * ist das Dedup-Merge-Tool auf /studio/shows/actors. Dieser Picker zeigt
 * nur wie Admin trotzdem sinnvoll damit arbeiten kann bis das Tool durch
 * die Daten gelaufen ist.
 */

import { useMemo, useState } from "react";
import Link from "next/link";

export interface PickerActor {
  id: string;
  displayName: string;
  emoji: string | null;
  species: string | null;
  role: string | null;
  expertise: string[];
  portraitUrl: string | null;
  characterSheet: { front?: string; profile?: string; fullBody?: string } | null;
  portraitAssetId: string | null;
  voiceId: string;
  persona: string;
  ownerUserId: string | null;
}

export function resolveActorPortrait(
  a: Pick<PickerActor, "portraitUrl" | "characterSheet" | "portraitAssetId">,
): string | null {
  if (a.portraitUrl) return a.portraitUrl;
  if (a.characterSheet?.front) return a.characterSheet.front;
  if (a.portraitAssetId?.startsWith("http")) return a.portraitAssetId;
  return null;
}

export function isActorIncomplete(
  a: Pick<PickerActor, "voiceId" | "persona">,
): boolean {
  const voiceOk = !!a.voiceId && a.voiceId !== "PENDING";
  const personaOk =
    !!a.persona && !a.persona.includes("wird auf der Edit-Seite gefuellt");
  return !voiceOk || !personaOk;
}

// Scoring fuer "welche Variante ist primaer?" — je hoeher, desto kanonischer.
// Portrait ist staerkstes Signal (Dubletten aus DigitalActor-Migration haben
// oft keins). Voice+Persona sind Hygiene-Indikatoren. displayName-length
// dient als letzter Tiebreaker (kuerzester Name = "Koda" vor "Koda 2D").
function completenessScore(a: PickerActor): number {
  let s = 0;
  if (resolveActorPortrait(a)) s += 10;
  if (a.voiceId && a.voiceId !== "PENDING") s += 5;
  if (a.persona && !a.persona.includes("wird auf der Edit-Seite gefuellt")) s += 5;
  if (a.expertise.length > 0) s += 2;
  if (a.role) s += 1;
  // Kuerzerer Name = kanonischer. Max-Bonus 3 fuer Name ≤5 Zeichen.
  s += Math.max(0, 5 - Math.floor(a.displayName.length / 2));
  return s;
}

interface ActorGroup {
  key: string; // lowercase displayName + species
  primary: PickerActor;
  variants: PickerActor[]; // alle Actors in der Gruppe (inkl. primary), sortiert nach Score desc
}

function groupActors(actors: PickerActor[]): ActorGroup[] {
  const byKey = new Map<string, PickerActor[]>();
  for (const a of actors) {
    // Dedup-Key: displayName (normalisiert) + species. "Koda" und "Koda 2D"
    // gehen damit NICHT in die gleiche Gruppe (das ist Absicht — "2D"
    // koennte ein anderer Voice-Cast sein). Nur echte Namens-Gleichheit.
    const name = a.displayName.trim().toLowerCase();
    const species = (a.species ?? "").toLowerCase();
    const key = `${name}|${species}`;
    const bucket = byKey.get(key) ?? [];
    bucket.push(a);
    byKey.set(key, bucket);
  }
  const groups: ActorGroup[] = [];
  for (const [key, bucket] of byKey) {
    bucket.sort((a, b) => completenessScore(b) - completenessScore(a));
    groups.push({ key, primary: bucket[0], variants: bucket });
  }
  // Sort: Seed-Actors (ownerUserId=null) zuerst, dann alphabetisch.
  groups.sort((a, b) => {
    const aSeed = a.primary.ownerUserId === null ? 0 : 1;
    const bSeed = b.primary.ownerUserId === null ? 0 : 1;
    if (aSeed !== bSeed) return aSeed - bSeed;
    return a.primary.displayName.localeCompare(b.primary.displayName);
  });
  return groups;
}

export function ActorPickerGrid({
  actors,
  selectedActorIds,
  onToggle,
  onCreateNew,
  showLibraryLink = true,
  showSpeciesFilter = true,
  showRoleFilter = true,
  justCreatedId = null,
}: {
  actors: PickerActor[];
  selectedActorIds: string[];
  /** Vom Parent aufgerufen mit der Actor-ID die selektiert/deselektiert werden soll. */
  onToggle: (actorId: string) => void;
  /** Optional: Button "+ Neuer Actor" erscheint nur wenn gesetzt. */
  onCreateNew?: () => void;
  /** Link zur Actor-Library-Seite (Default true). */
  showLibraryLink?: boolean;
  showSpeciesFilter?: boolean;
  showRoleFilter?: boolean;
  /** Wenn gesetzt: Card wird kurz hervorgehoben (grüner Ring) — für Feedback nach Inline-Create. */
  justCreatedId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [onlyComplete, setOnlyComplete] = useState(false);

  // Pro Gruppe: welche Variante ist aktuell "ausgewaehlt"? Default = primary.
  // User kann per Dropdown in der Card eine andere Variante waehlen — dann
  // wird DIE ID via onToggle an den Parent weitergereicht (statt primary).
  const [variantByGroup, setVariantByGroup] = useState<Record<string, string>>({});

  const groups = useMemo(() => groupActors(actors), [actors]);

  // Alle einzigartigen Species/Roles fuer Dropdown-Options.
  const speciesOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of actors) if (a.species) set.add(a.species);
    return [...set].sort();
  }, [actors]);
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of actors) if (a.role) set.add(a.role);
    return [...set].sort();
  }, [actors]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      const a = g.primary;
      // Incomplete-Filter: blende Gruppe aus wenn ALLE Varianten incomplete sind.
      // (wenn eine davon ok ist, koennte der User die per Dropdown waehlen).
      if (onlyComplete && g.variants.every((v) => isActorIncomplete(v))) return false;
      if (speciesFilter && a.species !== speciesFilter) return false;
      if (roleFilter && a.role !== roleFilter) return false;
      if (q) {
        const hay = [
          a.displayName,
          a.species,
          a.role,
          a.persona,
          a.expertise.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [groups, search, speciesFilter, roleFilter, onlyComplete]);

  function getActiveVariantId(g: ActorGroup): string {
    return variantByGroup[g.key] ?? g.primary.id;
  }

  function getActiveVariant(g: ActorGroup): PickerActor {
    const id = getActiveVariantId(g);
    return g.variants.find((v) => v.id === id) ?? g.primary;
  }

  return (
    <div className="space-y-3">
      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche (Name, Persona, Expertise…)"
          className="flex-1 min-w-[200px] bg-[#141414] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/90 focus:border-[#C8A97E]/50 focus:outline-none"
        />
        {showSpeciesFilter && speciesOptions.length > 0 && (
          <select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            className="bg-[#141414] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80"
          >
            <option value="">Alle Species</option>
            {speciesOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {showRoleFilter && roleOptions.length > 0 && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#141414] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80"
          >
            <option value="">Alle Rollen</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyComplete}
            onChange={(e) => setOnlyComplete(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-[#141414] text-[#C8A97E]"
          />
          Nur vollstaendige
        </label>
        <div className="flex-1" />
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#C8A97E]/20 text-[#C8A97E] border border-[#C8A97E]/30 hover:bg-[#C8A97E]/30 transition"
          >
            + Neuer Actor
          </button>
        )}
        {showLibraryLink && (
          <Link
            href="/studio/shows/actors"
            target="_blank"
            className="text-[11px] text-white/50 hover:text-white/80 underline"
          >
            → Alle Actors
          </Link>
        )}
      </div>

      {/* Count + Hints */}
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>
          {filteredGroups.length} Character{filteredGroups.length === 1 ? "" : "s"}
          {filteredGroups.length !== groups.length && ` (von ${groups.length})`}
          {" · "}
          {actors.length} Rows in DB (Dubletten eingeklappt)
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filteredGroups.map((g) => {
          const active = getActiveVariant(g);
          const activeId = active.id;
          const selected = selectedActorIds.includes(activeId);
          const portrait = resolveActorPortrait(active);
          const incomplete = isActorIncomplete(active);
          const hasVariants = g.variants.length > 1;
          const justCreated = justCreatedId === activeId;

          return (
            <div
              key={g.key}
              className={`group relative rounded-lg border transition p-3 ${
                justCreated
                  ? "border-green-400/60 bg-green-400/5 ring-2 ring-green-400/30"
                  : selected
                  ? "border-[#C8A97E] bg-[#C8A97E]/10"
                  : incomplete
                  ? "border-yellow-500/20 bg-yellow-500/[0.03] hover:border-yellow-400/40"
                  : "border-white/10 bg-[#1A1A1A] hover:border-white/20"
              }`}
            >
              {/* Edit-Shortcut (hover) */}
              <Link
                href={`/studio/shows/actors/${activeId}`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[11px] text-white/40 hover:text-[#C8A97E] transition"
                title="Actor bearbeiten (neuer Tab)"
              >
                ✎
              </Link>

              <button
                type="button"
                onClick={() => onToggle(activeId)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-2.5 mb-2">
                  {portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={portrait}
                      alt={active.displayName}
                      className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl shrink-0">
                      {active.emoji ?? "•"}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[#f5eed6] font-medium text-sm truncate">
                        {active.displayName}
                      </span>
                      {incomplete && (
                        <span
                          className="text-[9px] px-1 py-0 rounded bg-yellow-500/20 text-yellow-200/80 shrink-0"
                          title="Voice oder Persona fehlt"
                        >
                          ⚠
                        </span>
                      )}
                      {hasVariants && (
                        <span
                          className="text-[9px] px-1 py-0 rounded bg-white/10 text-white/60 shrink-0"
                          title={`${g.variants.length} Varianten in DB (Dubletten)`}
                        >
                          ×{g.variants.length}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/50 truncate">
                      {active.role ?? "—"} · {active.species ?? "—"}
                    </div>
                    {active.expertise.length > 0 && (
                      <div className="text-[9px] text-white/40 truncate mt-0.5">
                        {active.expertise.slice(0, 3).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Varianten-Dropdown (nur wenn mehr als 1 Variante) */}
              {hasVariants && (
                <select
                  value={activeId}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setVariantByGroup((prev) => ({ ...prev, [g.key]: newId }));
                    // Wenn die bisherige Variante selektiert war, umhaengen auf die neue.
                    if (selected) {
                      onToggle(activeId); // deselect old
                      onToggle(newId); // select new
                    }
                  }}
                  className="w-full mt-1 bg-[#141414] border border-white/10 rounded px-2 py-1 text-[10px] text-white/70 focus:border-[#C8A97E]/50 focus:outline-none"
                  title="Variante waehlen — unterschiedliche Voice/Persona moeglich"
                >
                  {g.variants.map((v, i) => {
                    const vInc = isActorIncomplete(v);
                    return (
                      <option key={v.id} value={v.id}>
                        {i === 0 ? "● " : ""}
                        {v.displayName}
                        {vInc ? " ⚠" : ""}
                        {" — "}
                        {v.id.slice(0, 8)}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="text-center py-8 text-white/40 text-xs border border-dashed border-white/10 rounded-lg">
          Keine Actors passen zum Filter.
          {onCreateNew && (
            <>
              {" "}
              <button
                type="button"
                onClick={onCreateNew}
                className="text-[#C8A97E] hover:underline"
              >
                Neuen anlegen?
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
