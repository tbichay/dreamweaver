# KoalaTree Film-Generierung: Technischer Workflow

> Kompletter Ablauf von der Geschichte bis zum fertigen Film.
> Stand: April 2026

---

## Uebersicht

```
Geschichte (Text + Audio) ──► AI Director ──► Szenen-Liste
                                                  │
                              ┌────────────────────┤
                              ▼                    ▼
                         Dialog-Szene         Landschaft/Transition
                              │                    │
                    ┌─────────┴──────┐       ┌─────┴──────┐
                    ▼                ▼       ▼            ▼
              Referenzbilder    Audio-Segment  Szenen-Bild   Referenzbilder
                    │                │            │              │
                    └────────┬───────┘            └──────┬───────┘
                             ▼                           ▼
                    Hedra Character-3              Kling I2V / IR2V
                      (Lip-Sync)                   (Animation)
                             │                           │
                             └────────────┬──────────────┘
                                          ▼
                                   Szenen-Clips (MP4)
                                          │
                                          ▼
                                   Video-Mastering
                                  (ffmpeg: Crossfades,
                                   Musik, Color Grading)
                                          │
                                          ▼
                                    Fertiger Film
```

---

## 1. Film-Generierung starten

**Endpoint:** `POST /api/generate-film`
**Datei:** `app/api/generate-film/route.ts`

**Voraussetzung:** Geschichte muss existieren und Audio haben (`geschichte.audioUrl`).

**Ablauf:**
1. User klickt "Als Film generieren"
2. API erstellt `FilmJob` in der Datenbank (Status: `PENDING`)
3. Job wartet in der Queue bis der Cron ihn aufnimmt

**Queue-System:**
- FIFO-Reihenfolge nach `createdAt`
- Ein Job wird gleichzeitig bearbeitet
- Position wird dem User angezeigt

---

## 2. Cron-Verarbeitung (eine Szene pro Lauf)

**Endpoint:** `GET /api/cron/process-film-queue`
**Datei:** `app/api/cron/process-film-queue/route.ts`
**Intervall:** Alle 2 Minuten (Vercel Cron)
**Max. Laufzeit:** 5 Minuten (Vercel Function Limit)

**Pro Cron-Lauf:**
1. Stale Jobs zuruecksetzen (PROCESSING > 6 Min → PENDING)
2. Naechsten Job finden (PROCESSING oder aeltester PENDING)
3. EINE Szene generieren
4. Progress in DB aktualisieren
5. Wenn alle Szenen fertig: Job als COMPLETED markieren, E-Mail senden

**Warum nur eine Szene pro Lauf?**
Hedra/Kling brauchen 2-3 Minuten pro Video. Bei 5 Min Vercel-Limit passt nur eine Szene rein. Der Cron laeuft alle 2 Min, also werden Szenen sequenziell abgearbeitet.

---

## 3. AI Director: Geschichte → Szenen-Liste

**Datei:** `lib/video-director.ts`
**Funktion:** `analyzeStoryForFilm(storyText, timeline)`
**KI-Modell:** Claude Sonnet 4

**Input:**
- Geschichte mit Character-Markern: `[KODA] Wisst ihr, was Mut bedeutet? [KIKI] Haha, Mut ist...`
- Audio-Timeline: `[{ characterId: "koda", startMs: 0, endMs: 4200 }, ...]`

**Output:** 10-20 `FilmScene` Objekte:

```typescript
{
  type: "dialog" | "landscape" | "transition",
  characterId: "koda",           // Wer spricht / wer ist zu sehen
  spokenText: "Wisst ihr...",    // Gesprochener Text (max 100 Zeichen)
  sceneDescription: "Koda sitzt auf dem Ast, schaut nachdenklich...",
  location: "Hauptast des KoalaTree",
  mood: "Warm, goldenes Abendlicht",
  camera: "close-up",           // close-up | medium | wide | slow-pan | zoom-in | zoom-out
  durationHint: 5,              // Sekunden
  audioStartMs: 0,              // Exakter Start im Audio
  audioEndMs: 4200,             // Exaktes Ende im Audio
}
```

**Director-Stil:**
- Disney 1994 Aesthetik (Lion King, Jungle Book)
- Betont BEWEGUNG statt statischer Portraits
- Beschreibt Interaktionen und Reaktionen
- Nutzt Kamerabewegung aktiv
- Beschreibt Ein-/Ausgaenge (Kiki fliegt rein, Mika rennt los)

---

## 4. Audio-Segmentierung

**Datei:** `lib/audio-segment.ts`
**Funktion:** `segmentMp3(mp3Buffer, startMs, endMs)`

Schneidet das Audio praezise an MP3-Frame-Grenzen:

1. ID3v2-Tag ueberspringen (falls vorhanden)
2. Alle MP3-Frame-Header parsen → Frame-Index aufbauen
3. Frames finden die den Zeitbereich abdecken
4. Zusammenhaengendes Buffer-Segment zurueckgeben

**Warum nicht einfach Bytes schneiden?**
MP3 hat variable Frame-Groessen. Blindes Byte-Slicing schneidet mitten in Frames und erzeugt korruptes Audio. Der Frame-Parser findet saubere Schnittgrenzen.

**Spezifikation:**
- MPEG1 Layer III (128kbps, Standard)
- Frame-Groesse: `144 * bitrate / sampleRate + padding`
- Frame-Dauer: `1152 Samples / sampleRate` (~26ms bei 44.1kHz)

---

## 5. Referenzbilder laden

**Datei:** `lib/references.ts`
**Funktion:** `loadCharacterReferences(characterId, limit=3)`

Jeder Charakter kann MEHRERE Referenzbilder haben fuer bessere Konsistenz:

```json
{
  "portrait:koda": {
    "primary": "studio/koda-portrait-123.png",
    "images": [
      { "path": "studio/koda-portrait-123.png", "label": "Front", "role": "primary" },
      { "path": "studio/koda-thinking-456.png", "label": "Nachdenklich", "role": "expression" }
    ]
  }
}
```

**Fallback-Kette:**
1. Referenz-Index in `studio/references.json`
2. Kanonisches Portrait: `images/{characterId}-portrait.png`
3. HTTP-Fetch: `/api/images/{characterId}-portrait.png`

**Nutzung in der Pipeline:**
- **Dialog (Hedra):** Nur `refs[0]` (Primary) — Hedra akzeptiert ein Bild
- **Landschaft (Kling IR2V):** Bis zu 3 Referenzen fuer Charakter-Konsistenz

---

## 6. Video-Generierung: Zwei Pfade

### 6a. Dialog-Szenen → Hedra Character-3 (Lip-Sync)

**Datei:** `lib/hedra.ts` → `generateVideo()`

```
Portrait-Bild + Audio-Segment + Prompt
         │
         ▼
   Hedra Character-3 API
   (Lip-Sync + Gesichtsanimation)
         │
         ▼
   Video-URL → Download → Blob Storage
```

**API-Ablauf:**
1. Portrait als Image-Asset hochladen
2. Audio-Segment als Audio-Asset hochladen
3. Generation erstellen (Model: Character-3)
4. Pollen bis Status `complete` (Interval: 5s, Timeout: 10 Min)
5. Video-URL zurueckgeben

**Was Hedra macht:**
- Mund-Synchronisation zum Audio
- Gesichtsausdruecke passend zum Prompt
- Subtile Kopfbewegungen
- Aspekt: 9:16 (Portrait), 720p

### 6b. Landschaft/Transition → Kling I2V (Animation)

**Datei:** `lib/hedra.ts` → `generateSceneVideo()`

```
Szenen-Bild + Prompt + (Referenzbilder)
         │
         ▼
   Kling I2V oder IR2V API
   (Bild-zu-Video Animation)
         │
         ▼
   Video-URL → Download → Blob Storage
```

**Automatische Bewegungserkennung:**
Keywords in der Szenenbeschreibung → Bewegungs-Prompts:
- "Baum/Blaetter" → Blaetter wiegen im Wind
- "Wasser/Bach" → Wasser fliesst ueber Steine
- "Nacht/Mond" → Sterne funkeln, Mondlicht wandert
- "Feuer/Lagerfeuer" → Flammen flackern, Funken steigen
- "Regen" → Tropfen fallen, Nebel steigt
- "Schnee" → Flocken schweben herab

**Kamera-Bewegung:**
- `slow-pan` → Langsamer Kameraschwenk
- `zoom-in` → Sanfter Zoom ins Zentrum
- `zoom-out` → Zoom heraus, Szene enthuellt sich
- `wide` → Statisch mit Parallax-Tiefe
- `close-up` → Langsamer Push-In

**IR2V (mit Referenzbildern):**
Wenn Charakter-Referenzen vorhanden, nutzt Kling diese fuer visuelle Konsistenz — der Charakter sieht in Landschafts-Szenen genauso aus wie im Portrait.

---

## 7. Video-Mastering (Post-Processing)

**Datei:** `lib/video-mastering.ts`

Einzelne Szenen-Clips → Fertiger Film:

```
Szene-001.mp4 + Szene-002.mp4 + ... + Szene-N.mp4
         │
         ▼
   1. Audio-Normalisierung (LUFS -16)
   2. Color Grading (warme KoalaTree-Palette)
   3. Intro-Karte ("KoalaTree praesentiert")
   4. Crossfade-Transitions (0.5s)
   5. Hintergrundmusik (8% Lautstaerke)
   6. Outro-Karte
         │
         ▼
   film-final.mp4
```

**Konfigurierbar:**
- `warmth: 0.3` — Farbtemperatur
- `musicVolume: 0.08` — Musik-Lautstaerke relativ zu Sprache
- `crossfadeDuration: 0.5` — Ueberblendung zwischen Szenen
- `targetLUFS: -16` — Broadcast-Standard Lautstaerke

**Hinweis:** ffmpeg laeuft lokal oder auf einem Cloud-Server, nicht auf Vercel (kein ffmpeg in Vercel Functions).

---

## 8. Speicherstruktur

```
films/{geschichteId}/
  ├── scene-000.mp4          # Erste Szene
  ├── scene-001.mp4          # Zweite Szene
  ├── ...
  ├── scene-019.mp4          # Letzte Szene
  ├── frame-000.png          # Letztes Frame (fuer Chaining)
  ├── assets/
  │   └── *.png              # Generierte Szenen-Bilder
  └── final.mp4              # Gemasterter Film (nach Mastering)

studio/
  ├── references.json         # Referenzbild-Index
  ├── koda-portrait.png       # Kanonisches Portrait
  ├── koda-thinking-*.png     # Versionen
  └── hero/                   # Hero-Bilder

images/
  └── {character}-portrait.png  # Aktive Portraits (oeffentlich)
```

---

## 9. Fehlerbehandlung

| Ebene | Strategie |
|-------|-----------|
| **Stale Jobs** | PROCESSING > 6 Min → Reset zu PENDING |
| **Szenen-Fehler** | Szene ueberspringen, naechste verarbeiten |
| **API-Timeout** | 10 Min Timeout pro Hedra/Kling-Call |
| **ElevenLabs** | 4 Retries mit exponentiellem Backoff (2s, 4s, 8s, 16s) |
| **Job-Retry** | User kann `POST /api/generate-film` erneut aufrufen |

---

## 10. Zeiten & Kosten

**Typischer Film (15 Szenen):**
- AI Director: ~15 Sekunden
- 15 Szenen x 2-3 Min = ~30-45 Minuten (Cron alle 2 Min)
- Audio-Segmentierung: <100ms pro Schnitt
- Gesamtzeit: **~45-60 Minuten** fuer einen kompletten Film

**Kosten pro Film:**
- ElevenLabs (Multi-Voice Audio): ~$2
- Hedra (Dialog-Szenen, ~10 Clips): ~$8
- Kling (Landschaften, ~5 Clips): ~$5
- Claude (Director): ~$0.10
- Vercel Blob Storage: ~$0.05
- **Gesamt: ~$15-20 pro Film**

---

## 11. Stil-Konfiguration

Der visuelle Stil ist konfigurierbar ueber die Studio-Einstellungen:

**Datei:** `lib/studio.ts`

**Standard-Stil (DEFAULT_STYLE_PREFIX):**
> Traditional hand-drawn cel animation style from the 1994 Disney era.
> Flat 2D artwork with clean ink outlines and smooth hand-painted colors.
> NOT 3D, NOT CGI, NOT Pixar style.

**Projekt-spezifischer Stil:**
- Editierbar unter `/studio/settings`
- Gespeichert in `FilmProject.stylePrompt`
- Wird automatisch in alle Generierungs-Prompts eingesetzt
- Ermoeglicht komplett andere Stile fuer andere Projekte

**Charakter-Definitionen:**
- Ebenfalls pro Projekt anpassbar
- Name, Beschreibung, Accessories, Farbe, Emoji
- Standard: 7 KoalaTree-Charaktere (Koda, Kiki, Luna, Mika, Pip, Sage, Nuki)

---

## 12. API-Endpunkte

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/generate-film` | POST | Film-Job erstellen |
| `/api/film-queue/{id}/status` | GET | Job-Status abfragen |
| `/api/video/film/{id}` | GET | Film-Video streamen |
| `/api/cron/process-film-queue` | GET | Naechste Szene verarbeiten (Cron) |
| `/api/generate-scene-clip` | POST | Einzelne Szene manuell generieren (Admin) |
| `/api/admin/project-config` | GET/PUT/POST | Projekt-Konfiguration (Stil, Charaktere) |
| `/api/admin/assets` | GET/PUT/DELETE | Asset- und Referenzbild-Verwaltung |

---

## 13. Schluessel-Dateien

| Datei | Verantwortung |
|-------|--------------|
| `app/api/generate-film/route.ts` | Film-Job erstellen |
| `app/api/cron/process-film-queue/route.ts` | Cron-Orchestrierung |
| `lib/video-pipeline.ts` | Szenen-Generierungslogik |
| `lib/video-director.ts` | AI Regie (Story → Szenen) |
| `lib/hedra.ts` | Hedra Character-3 & Kling I2V APIs |
| `lib/audio-segment.ts` | MP3 Frame-genaue Segmentierung |
| `lib/references.ts` | Referenzbild-Verwaltung (Multi-Reference) |
| `lib/video-mastering.ts` | Post-Processing (ffmpeg) |
| `lib/studio.ts` | Stil-Prompts, Charakter-Definitionen |
| `lib/elevenlabs.ts` | Multi-Voice Audio + SFX + Ambience |
| `lib/story-parser.ts` | Story-Text-Parsing |
| `prisma/schema.prisma` | DB-Schema (FilmJob, Geschichte, FilmProject) |
