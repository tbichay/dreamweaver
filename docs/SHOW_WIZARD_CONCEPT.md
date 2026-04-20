# AI-First Show-Wizard — Design Spec (S2)

> Status: **Draft, zur Verhandlung.** S1 (Seed `koalatree-ai`) ist erledigt —
> dieses Dokument beschreibt was danach kommt: der konversationelle Wizard
> für alle Shows die es noch nicht gibt.

---

## TL;DR

**Ziel:** Ein Admin bringt eine Satz-Idee. Die AI schlägt eine komplette Show
vor (Titel, Ton, Cast, Foki, Episoden-Ideen). Der Admin iteriert via Chat
("wärmer", "swap Mika → Sage", "mehr für Einschlaf-Zielgruppe"), bis der
Draft passt. Dann ein Klick → die Show lebt in der DB.

**Was existiert heute:**
- `POST /api/studio/shows/bootstrap` — One-shot Draft-Generator (Text-JSON-Extract, kein Tool-Use, erfordert Actor-Auswahl upfront)
- `/studio/shows/new` — 2-Schritt-UI: Pitch+Actors → Draft-Formular → Save
- Alle Gen-Primitives (Flux für Cover, ElevenLabs für Voice, Studio-Task-Queue)

**Was fehlt:**
1. **Iteration-Loop** — Pitch → ein Wurf → fertig ist kein Gespräch
2. **AI schlägt Actors vor** (nicht User wählt upfront)
3. **Persistenter Draft** — kann verlassen + wiederaufgenommen werden
4. **Tool-Use** — strukturierte Mutationen statt JSON-Re-Parse pro Runde
5. **Cover-Gen-Schritt** — Bild kommt heute gar nicht aus dem Wizard

---

## User-Flow

```
 ┌──────────────────────────────────────────────────────────────┐
 │ 1. PITCH                                                      │
 │    /studio/shows/new                                          │
 │    Große Textarea: "Erzähl mir deine Show-Idee..."            │
 │    Optional: Kategorie-Hint (kids | wellness | knowledge)     │
 │                                                               │
 │    [Neuer Show-Entwurf starten]                               │
 └──────────────────────────────────────────────────────────────┘
                             ↓
 ┌──────────────────────────────────────────────────────────────┐
 │ 2. DRAFT + CHAT                                               │
 │    /studio/shows/drafts/[draftId]                             │
 │                                                               │
 │    ┌─ Karten (links, 2/3) ────────┐ ┌─ Chat (rechts, 1/3) ─┐ │
 │    │ 📛 Title + Subtitle          │ │ AI: "Ich hab dir eine│ │
 │    │ 🎨 Palette (3 Farben)        │ │ Show vorgeschlagen — │ │
 │    │ 👥 Cast (Actor-Cards +       │ │ sag was nicht passt."│ │
 │    │    "Warum diese Rolle"-Satz) │ │                      │ │
 │    │ 📚 Foki (enabled list)       │ │ Tom: "Wärmer"        │ │
 │    │ 💡 Episode-Ideen (3-5)       │ │                      │ │
 │    │ 📝 brandVoice                │ │ AI: updates brandVoice│ │
 │    │ 🖼 Cover-Placeholder         │ │ + "Done. Noch etwas?"│ │
 │    └──────────────────────────────┘ └──────────────────────┘ │
 │                                                               │
 │    [🖼 Cover generieren] [🗑 Verwerfen] [✓ Show erstellen]   │
 └──────────────────────────────────────────────────────────────┘
                             ↓
 ┌──────────────────────────────────────────────────────────────┐
 │ 3. COMMIT (automatisch bei "Show erstellen")                  │
 │    Draft → Show + ShowActor[] + ShowFokus[] + revisionHash    │
 │    Redirect auf /studio/shows/[neuer-slug]                    │
 └──────────────────────────────────────────────────────────────┘
```

**Drei Entscheidungen** für den User: Pitch schreiben → Show approven → Cover approven. Alles dazwischen ist Chat.

---

## Data-Model-Delta

**Neu: `ShowDraft`-Tabelle.** Getrennt von Show, weil ein Draft unvollständig / verwerfbar / iterativ ist und keinen `revisionHash` braucht. Commit = copy to Show.

```prisma
model ShowDraft {
  id          String   @id @default(cuid())
  ownerUserId String
  ownerOrgId  String?

  // Der komplette Draft-State als JSON — matched ShowDraftShape (Zod):
  // { title, subtitle, description, category, ageBand, brandVoice, palette,
  //   cast: [{actorId, role, reasoning}],
  //   fokusTemplateIds: [...],
  //   episodeIdeas: [{title, premise, leadActorId, fokusTemplateId}],
  //   coverUrl?, coverPrompt?, notesForAdmin }
  state       Json

  // Chat-Verlauf für den Iteration-Loop. Array of { role, content, toolCalls? }
  // — verwendet in jedem POST .../message um den Kontext wiederherzustellen.
  conversation Json

  // Pitch, mit dem der Draft gestartet wurde (für Debug/History)
  initialPitch String

  // Wenn committed: pointer auf die entstandene Show
  committedShowId String?
  committedShow   Show?    @relation(fields: [committedShowId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerUserId, createdAt])
}
```

**Kein anderes Schema-Change.** Show/ShowActor/ShowFokus bleiben wie sie sind. Der Commit-Step mapped `state` → bestehende Tabellen.

---

## API-Surface

| Methode | Route | Zweck |
|---|---|---|
| `POST` | `/api/studio/shows/drafts` | Pitch + optional Hints → neuer Draft, initialer AI-Draft via `draftFromPitch()` |
| `GET` | `/api/studio/shows/drafts/[id]` | Draft-State + Chat-Verlauf lesen (für UI-Hydration) |
| `POST` | `/api/studio/shows/drafts/[id]/message` | User-Nachricht → AI-Turn mit Tool-Use → updated state + Assistant-Text |
| `POST` | `/api/studio/shows/drafts/[id]/cover` | Cover mit `fluxKontext` generieren, returnt URL (oder queued Task) |
| `POST` | `/api/studio/shows/drafts/[id]/commit` | Draft → Show + Cast + Foki persistieren, returnt neuen slug |
| `DELETE` | `/api/studio/shows/drafts/[id]` | Discard |

**Der bestehende `/bootstrap` bleibt.** Admins, die lieber das One-Shot-Formular nutzen, werden nicht gezwungen in den Chat. Wir dokumentieren den Wizard als "empfohlenen Weg".

---

## AI-Architektur

**Model:** `claude-sonnet-4-20250514` (schon im Repo, Tool-Use-fähig)

**Tools (AI ruft diese auf, Server mutiert `state`):**

```typescript
{
  update_fields: {
    // Partial-Update auf Top-Level-Felder
    title?, subtitle?, description?, category?, ageBand?,
    brandVoice?, palette?, notesForAdmin?
  },
  set_cast: {
    // Ersetzt komplettes Cast-Array. AI muss begründen pro Rolle.
    cast: [{ actorId, role, reasoning }]
  },
  set_foki: {
    // Ersetzt Fokus-Liste
    fokusTemplateIds: string[]
  },
  add_episode_idea: { title, premise, leadActorId, fokusTemplateId },
  remove_episode_idea: { index: number },
  finalize: {
    // Signalisiert dass Draft bereit für User-Approval ist. Kein Mutation.
    // Frontend highlightet dann den "Show erstellen"-Button.
  }
}
```

**System-Prompt (Skelett):**

```
Du bist Show-Director für die KoalaTree-Plattform.

VERFÜGBARE ACTORS (IDs, Wesen, Sprechweise, Beziehungen):
{actorTable}

VERFÜGBARE FOKUS-TEMPLATES (IDs, Zielalter, Kategorie):
{templateTable}

AKTUELLER DRAFT:
{JSON.stringify(state)}

REGELN:
- Bei jeder User-Nachricht: entscheide welche Felder zu ändern sind
  und rufe die passenden Tools. Mehrere Tools in einem Turn OK.
- Antworte danach in 1-3 Sätzen auf Deutsch was du geändert hast.
- Fragen stellen nur wenn wirklich unklar — default: handle, dann fragen.
- brandVoice: immer konkret (3-5 Sätze), nie generisch.
- Cast-Picks begründen mit personality/backstory, nicht nur Expertise.
```

**Turn-Loop (serverseitig):**
1. Load `conversation` + `state` aus ShowDraft
2. Append User-Message zu `conversation`
3. Call Anthropic mit System + conversation + tools
4. Für jedes Tool-Use: mutate `state`, append ToolResult
5. Loop bis Text-Response (max 5 Runden)
6. Save `state` + `conversation` in einer Transaktion
7. Return `{ state, assistantText }`

**Pitch → initial Draft** (`POST /api/studio/shows/drafts`):
- Gleiche Tools, aber ein synthetischer erster User-Turn: `"Pitch: ..."` → AI füllt via `update_fields` + `set_cast` + `set_foki` + `add_episode_idea × 3`.

---

## Cover-Generation

**Endpoint:** `POST /api/studio/shows/drafts/[id]/cover`

**Ablauf:**
1. Baue Prompt aus: `state.title`, `state.brandVoice` (erster Satz), `state.palette`, Lead-Actor-IDs (für visuelle Konsistenz)
2. Prompt-Template: `"Cover illustration for a podcast show called '{title}'. {oneLineTone}. Featuring {leadActors}. Color palette: {bg}/{ink}/{accent}. Cozy, warm, illustrated style. No text."`
3. Call `fluxKontext({ prompt, aspectRatio: "16:9" })`
4. Upload result to Vercel Blob
5. Update `state.coverUrl` in DB
6. Return `{ coverUrl }`

**Iteration:** User klickt erneut "Cover neu generieren" → anderer Seed, gleicher Prompt. Bis zu 3 Kandidaten anzeigen (optional, später).

**Nicht im Scope:** Charakter-Konsistenz via LoRA (Phase 5 in KONZEPT.md). Anfangs generisch-stilistisch; der User kann später ein Portrait-Frame nachschieben wenn LoRAs fertig sind.

---

## UI-Komponenten (grob)

Neu anzulegen:
- `app/studio/shows/drafts/[id]/page.tsx` — Server Component, lädt Draft
- `app/studio/shows/drafts/[id]/wizard-client.tsx` — Client Component, Cards + Chat
- `app/studio/shows/drafts/[id]/_components/DraftCard.tsx` — wrapped Card mit Edit-Affordance
- `app/studio/shows/drafts/[id]/_components/CastCard.tsx` — Actor-Pick mit Swap-Dropdown
- `app/studio/shows/drafts/[id]/_components/FokusChips.tsx` — Multi-Toggle
- `app/studio/shows/drafts/[id]/_components/ChatPane.tsx` — wie Canzoia-Onboarding-Chat, aber gegen Wizard-API

**Wiederverwendbar aus Canzoia-Onboarding:** Chat-Bubbles, Loading-Dots, Send-Button. Kannst 1:1 copypasten und Endpoint tauschen.

---

## Offene Entscheidungen (dein Input nötig)

| # | Frage | Empfehlung |
|---|---|---|
| 1 | **Actor-Library oder neue Charaktere?** Erlauben wir "Ich will einen neuen Koala als Lead"? | **Phase 1: nur Library.** Actor-Gen (Portrait + Voice-Design) ist teuer + async — kommt in Phase 2 des Wizards rein. |
| 2 | **Cover pro Fokus oder nur Show-weit?** | **Nur Show-weit** im ersten Wurf. Fokus-spezifische Cover = Phase 3. |
| 3 | **Episode-Ideen persistieren?** Landen die später als Episoden in der DB, oder sind sie nur Inspiration? | **Nur Inspiration** im Draft. Bei Commit werden sie NICHT zu ShowEpisodes — sie landen in `Show.description` oder als Notiz im Metadata-Feld. Echte Episoden kommen via S3 (Pilot-Gen). |
| 4 | **Voice-Input im Pitch?** | **Ja, optional.** Web Speech API steht eh auf der Liste (Todo #11). Synergie-Effekt. |
| 5 | **Draft-Auto-Save?** | **Ja.** Nach jeder AI-Antwort serverseitig, kein "Speichern"-Button. Unsaved-States sind ein UX-Albtraum im Wizard-Kontext. |
| 6 | **Multi-Draft pro User?** | **Ja, aber begrenzt.** Max 5 aktive Drafts per User, älteste wird verworfen wenn voll. Verhindert Kosten-Explosion durch Ghost-Drafts. |

---

## Implementierungs-Reihenfolge

1. **Schema + Migration** — `ShowDraft` Tabelle anlegen. (~30 Min)
2. **`draftFromPitch()` Server-Funktion** — wrappt Anthropic mit den 5 Tools, handled Loop. (~3h — der Brain des Wizards)
3. **`POST .../drafts`** + **`POST .../drafts/[id]/message`** Routes (~2h)
4. **`POST .../drafts/[id]/commit`** — Draft → Show+Cast+Foki Transaktion (~1h)
5. **UI: Pitch-Page + Draft-Page + Chat-Pane** (~4-6h, inkl. Cards)
6. **Cover-Gen-Endpoint + Button** (~2h)
7. **Polish: Toasts, Loading, Error-Handling** (~2h)

**Realistisch: 2-3 Arbeitstage** für den kompletten Wizard. S3 (Pilot-Gen-Button + Review) käme danach als eigene Einheit.

---

## Risiken & Trade-offs

1. **Tool-Use-Loops können teuer werden.** Cap auf 5 AI-Runden pro User-Turn, mit Log wenn erreicht. Sonst schreibt der AI sich in Kreisen warm.
2. **Conversation-History wächst.** Nach 20 Turns ist der Context groß. Truncation-Strategie: halte nur letzte 10 Turns + den aktuellen State im Prompt; älteres wird zusammengefasst.
3. **State-Drift** zwischen JSON-State und Realität der Actors/FokusTemplates. Mitigation: bei jeder AI-Runde die aktuellen Actor/Template-IDs validieren und halluzinierte rauswerfen (wie `bootstrap` es schon macht).
4. **Commit-Race-Condition.** Zwei Tabs, derselbe Draft, zwei Commits. Mitigation: `committedShowId` als idempotenz-Flag; zweiter Commit 409.

---

## Was der Wizard NICHT kann (und nicht soll)

- Neue Actors designen (separater Flow in Phase 3)
- Voices klonen / Voice-Design triggern (eigener Pipeline-Step)
- FokusTemplate-Prompt-Skeletons editieren (Studio-UI für Templates existiert)
- Pilot generieren (= S3, separater Button auf der fertigen Show)

Diese Grenzen sind **Feature, nicht Bug** — der Wizard ist schnell weil er nicht alles kann.

---

*Letzte Aktualisierung: 2026-04-20*
