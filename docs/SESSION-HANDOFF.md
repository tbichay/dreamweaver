# Session Handoff — KoalaTree Film Pipeline

**Stand:** 2026-04-16
**Letzter Commit:** `95c3c01 Revert to O3 + LipSync post-processing (not Avatar)`

---

## Ziel der Session

Ersten perfekten **KoalaTree Welcome/Marketing Film** produzieren (alle 7 Charaktere: Koda, Kiki, Luna, Mika, Pip, Sage, Nuki). Keine Abkuerzungen — alles gut durchdacht.

---

## Was wurde gefixed (chronologisch)

### Drehbuch-Generierung
- **Dialog-Beats wurden zu Landscape-Scenes** → Screenplay-Generator erzwingt jetzt: Beat mit `characterId` + `text` = Dialog-Scene (1:1 Mapping)
- **Dialoge wurden abgeschnitten** (Mika, Kiki fehlten) → `targetDurationSec` ist jetzt Richtwert, kein hartes Limit
- **Audio-Cutoff "mit eurem Namen"** → 120/150-Zeichen-Limit aus `spokenText` entfernt
- **2-Charakter-Beats** → funktionieren jetzt korrekt

### Audio / Player
- **Audio-Player stoppt bei 60s** → nutzt jetzt kumulative Dauer via `actualDurationRef` statt DB-`audioEndMs`
- **Detailliertes Audio-Logging** + Post-Generation-Validierung

### Film-Rendering (Remotion Lambda)
- **KRITISCH: 30s-Cutoff** → `forceDurationInFrames: totalFrames` wurde nie uebergeben, Remotion nutzte Placeholder `durationInFrames={900}` = 30s
- **Lambda-Timeout (300s)** → Split in max 3 Lambdas via `framesPerLambda: Math.ceil(totalFrames / 3)`
- **Concurrency-Limit** → auf 3 Chunks begrenzt

### Clip-Generierung
- **Spooky Baumwurzeln/Gesicht am Baum** → Landscape-Prompts haben jetzt explizite Anti-Anthropomorphismus-Regeln ("Trees, roots, rocks are INANIMATE — NO eyes, mouths, hands, faces")
- **Sage sah anders aus** → `characterSheet` wird jetzt in `castSnapshot` eingefroren beim Casting
- **Crashes waehrend Clip-Gen** → Single Task-Poll auf `ProductionTab`-Ebene (8s) statt 6× `SequenceCard` (4s)
- **Koda schaute nicht in Kamera** → `isDialog` Param in `buildO3Prompt` fuegt "looking directly at the camera, speaking to the viewer" hinzu

### Lip-Sync (laufende Baustelle)
- **LipSync lief nie** → `isDialog` verlangte `clipMode === "film"`, aber Default ist `"audiobook"`. Check entfernt.
- **Avatar-Ansatz verworfen** → User: "Omni kann alles". Zurueck zu **O3 + klingLipSync Post-Processing**.

### Architektur-Cleanup
- Zentrale `lib/studio/visual-styles.ts` (5+ hardcoded Style-Listen konsolidiert)
- Zentrale `lib/studio/transitions.ts`
- Zentrale `lib/studio/blob-proxy.ts`
- Zentrale `lib/studio/ui-types.ts`
- 1121 Zeilen Dead Code entfernt
- 29 swallowed Errors mit Logging versehen

---

## Aktueller Stand der Clip-Pipeline

```
Scene (mit characterId + text + dialogAudioUrl)
  ↓
klingO3 (Omni) generiert cinematischen Clip ($0.084/s)
  → Prompt enthaelt bei Dialog: "looking directly at the camera"
  → characterElements = [characterSheet.front/profile/fullBody]
  ↓
klingLipSync Post-Processing ($0.014/s)
  → synchronisiert Mundbewegungen zum ElevenLabs-TTS-Audio
  ↓
Upload zu Vercel Blob → StudioScene.clipUrl
```

Fallback: O3 faellt auf I2V Pro/Standard zurueck falls fehlerhaft.

---

## Was als Naechstes zu tun ist

### 1. Test: O3 + LipSync
Einen Dialog-Clip neu generieren (z.B. Kodas Intro) und pruefen:

**Vercel Logs checken:**
```
[Clip] Lip-sync applied for scene X
```
Wenn diese Zeile fehlt → LipSync lief nicht. Dann in `app/api/cron/process-studio-tasks/route.ts` die `if (isDialog && scene.dialogAudioUrl)` Logik debuggen.

**Im Clip pruefen:**
1. Schaut der Charakter in die Kamera? (neuer `isDialog`-Prompt)
2. Stimmen Mundbewegungen zum Audio?
3. Ist die Umgebung/Kamerafuehrung wie im Prompt?

### 2. Falls LipSync-Qualitaet immer noch schlecht
Alternativen (mit User abstimmen):
- **Sync Labs** — bessere LipSync-Qualitaet, braucht separate Integration
- **O3 mit `generateAudio: true`** — Kling generiert Audio+Sync selbst, aber verliert ElevenLabs-Stimmen
- **Hybrid** — Dialog-Close-Ups via Avatar, Wide-Shots via O3 (User hat Avatar bisher abgelehnt)

### 3. Welcome-Film fertigstellen
Sobald LipSync passt:
- Alle 7 Charaktere: je eine kurze Intro-Szene
- Ambience-Layer + Background-Music (bereits in Remotion-Pipeline)
- Title-Card + Credits
- Render via Remotion Lambda (eu-central-1)

### 4. Spaeter: Kids App / Studio Engine Trennung
Plan liegt unter `~/.claude/plans/glimmering-twirling-crane.md`. Erst nach fertigem Film anfangen. Ziel-Domains:
- `koalatree.io` — Kids App
- `koalatree.ai` — Studio Engine

---

## Prompt fuer neue Session

Kopier das in die neue Session:

> Ich arbeite am KoalaTree Studio Welcome-Film. Letzter Stand in `docs/SESSION-HANDOFF.md` lesen. Wir sind bei Commit `95c3c01` (O3 + LipSync Post-Processing). Naechster Schritt: Dialog-Clip generieren und LipSync-Qualitaet testen. Bitte `docs/SESSION-HANDOFF.md` lesen und dann warten bis ich den Test durchgefuehrt habe.

---

## Wichtige Dateien (Map)

| Datei | Zweck |
|-------|-------|
| `app/api/cron/process-studio-tasks/route.ts` | Haupt-Clip-Generierung (O3 + LipSync) |
| `lib/studio/kling-prompts.ts` | `buildO3Prompt` mit `isDialog`-Flag |
| `lib/studio/screenplay-generator.ts` | Drehbuch-KI, 1:1 Dialog-Mapping |
| `lib/film-render.ts` | Remotion Lambda, `forceDurationInFrames` |
| `remotion/FilmComposition.tsx` | Film-Zusammenbau |
| `lib/fal.ts` | `klingO3`, `klingI2V`, `klingLipSync`, `klingAvatar` |
| `lib/studio/visual-styles.ts` | Zentrale Style-Definitionen |
| `app/studio/engine/page.tsx` | Studio UI (4000+ Zeilen) |
| `app/api/studio/projects/[projectId]/characters/route.ts` | Casting (`castSnapshot` inkl. `characterSheet`) |

---

## Offene Fragen / Risiken

- **LipSync-Qualitaet unklar** — nach User-Test entscheiden ob Kling-LipSync reicht oder Alternative
- **Kosten pro Dialog-Clip:** $0.084/s (O3) + $0.014/s (LipSync) = ~$0.10/s
- **Avatar-Pfad** existiert in `lib/fal.ts` (`klingAvatar`) aber nicht aktiv genutzt — User hat abgelehnt wegen fehlender Szenen-Kontrolle
