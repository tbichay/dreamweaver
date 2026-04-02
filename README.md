# KoalaTree

> *Setz dich hin. Atme tief ein. Der alte Koala im Baum hat eine Geschichte nur fuer dich.*

Personalisierte KI-Hoerspiele fuer Kinder & Erwachsene. Der weise Koala **Koda** und seine freche Freundin **Kiki** erzaehlen Geschichten, die genau auf den Hoerer zugeschnitten sind.

**Live:** [koalatree.ai](https://koalatree.ai)

---

## Tech Stack

| Komponente | Technologie |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) |
| Auth | Clerk (deDE Lokalisierung) |
| Datenbank | Neon PostgreSQL via Prisma |
| KI-Geschichten | Anthropic Claude API (Streaming SSE) |
| Audio/TTS | ElevenLabs `eleven_multilingual_v2` (Multi-Voice) |
| Sound Effects | ElevenLabs Sound Generation API |
| Audio-Speicher | Vercel Blob |
| Hosting | Vercel (Auto-Deploy via GitHub) |
| PWA | Manifest + Media Session API |

## Features

- **Multi-Charakter Hoerspiel** — Koda und Kiki erzaehlen zusammen, mit echten Soundeffekten
- **Personalisierung** — Name, Alter, Interessen, Eigenschaften fliessen in jede Geschichte
- **Koala-Gedaechtnis** — Koda erinnert sich an fruehere Geschichten
- **8 Story-Formate** — Traumreise, Fabel, Abenteuer, Meditation, Reflexion u.v.m.
- **7 paedagogische Ziele** — Selbstbewusstsein, Mut, Empathie, Achtsamkeit...
- **Altersadaptiv** — 3-5, 6-8, 9-12, 13+ Jahre (auch Erwachsene)
- **PWA** — Background-Audio auf iPhone, Lockscreen-Controls
- **Sleep Timer** — Automatisches Stoppen nach 15/30/45/60 Minuten

## Setup

```bash
# Dependencies installieren
npm install

# Environment Variables (.env.local)
ANTHROPIC_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_KODA=...
ELEVENLABS_VOICE_KIKI=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
DATABASE_URL=...
BLOB_READ_WRITE_TOKEN=...

# Datenbank
npx prisma db push

# Dev Server
npm run dev
```

## Projekt-Struktur

```
lib/
  types.ts          — Character-System, Story-Formate, Typen
  prompts.ts        — Multi-Charakter Prompt-Builder (Koda + Kiki)
  story-parser.ts   — [KODA]/[KIKI]/[SFX:...] Marker-Parser
  elevenlabs.ts     — Multi-Voice TTS + SFX Audio-Pipeline
  db.ts             — Prisma Client

app/
  page.tsx           — Landing Page (6 Charaktere, Auth-Redirect)
  dashboard/         — Profil-Uebersicht
  story/             — Story-Konfiguration + Ergebnis
  geschichten/       — Geschichten-Bibliothek mit AudioPlayer
  sign-in/           — Clerk Sign-In
  sign-up/           — Clerk Sign-Up
  api/
    generate-story/  — Claude Streaming Story-Generierung
    generate-audio/  — ElevenLabs Multi-Voice + SFX → Vercel Blob
    profile/         — CRUD fuer Hoerer-Profile
    geschichten/     — Geschichten-API

scripts/
  design-voices.ts   — ElevenLabs Voice Design CLI

public/
  manifest.json      — PWA Manifest
  koda-*.png         — Koda Charakter-Bilder
  kiki-*.png         — Kiki Charakter-Bilder
  *-portrait.png     — Alle Charakter-Portraits
```

## Custom Voices erstellen

```bash
npx tsx scripts/design-voices.ts
```

Generiert Voice-Kandidaten ueber die ElevenLabs Voice Design API. Preview-Audio wird in `voice-previews/` gespeichert. Die beste Stimme pro Charakter auswaehlen und die Voice ID in `.env.local` + Vercel setzen.

## Dokumentation

- **[KONZEPT.md](./KONZEPT.md)** — Vision, Charakter-Familie, Story-Architektur, Roadmap
- **[AGENTS.md](./AGENTS.md)** — Next.js Agent-Regeln

---

*Letzte Aktualisierung: 2. April 2026*
