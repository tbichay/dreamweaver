# ADR: Monorepo-Merge (B) vs. separate Deployments (C)

**Status:** Draft — wartet auf Tom-Entscheidung
**Datum:** 2026-04-21
**Kontext:** Nach Abschluss der Night-Shift (Retry-Queue, Health-Endpoints,
Profil-Signale, Cross-Profil-Banner) und der Signal-Loop-Ausbau
(Feedback-Bar + Generator-reads-signals) stellt sich die Frage: wie
entwickeln wir die beiden Services weiter?

---

## Die zwei Optionen

### B — Monorepo-Merge

Koalatree + Canzoia ziehen in **ein Next.js-Projekt** um. Ein
`package.json`, eine `prisma/schema.prisma` (oder Drizzle), ein
Deployment, ein Vercel-Projekt, ein Auth-System.

Architektur intern:
- `/app/koalatree/*` — Studio + Produktion (bleibt, was wir heute
  als Koalatree kennen)
- `/app/app/*` — User-facing Canzoia
- Gemeinsame Libraries: Profile, Signals, Audio, Auth
- Kein HMAC-signed-Webhook mehr, kein CANZOIA_TO_KOALATREE_SECRET,
  kein Webhook-Retry-Queue — direkte Function-Calls.
- DB: Eine Postgres-Instanz. Entscheidung offen: bleibt Prisma
  (Koalatree) + Supabase (Canzoia) getrennt oder eine DB + ein ORM?

### C — Getrennt bleiben

Status Quo: zwei Deployments, zwei Repos, zwei DBs, HMAC-Webhook
als Integrations-Kanal. Signal-Injection läuft via
`profileSnapshot` im bestehenden Generate-Request (siehe heutige
Commits).

---

## Warum die Frage jetzt kommt

Bis zur Night-Shift war die Grenze zwischen den Services klar:
Koalatree = Studio für Tom (Show-Produktion), Canzoia = Consumer-App
für Familien. Zwei verschiedene User-Typen, zwei Domains, separate
Deployments = sauber.

**Aber:** Mit der Signal-Loop (Feedback-Bar → DB → Generator-Prompt)
haben wir eine **engere Kopplung** geschaffen. Der Koalatree-Generator
will jetzt pro Generation *live* wissen, was der Canzoia-User gestern
gesagt hat. Das ist aktuell via `profileSnapshot` gelöst — funktioniert,
aber:

- Jeder neue Datenpunkt, den der Generator braucht, muss den ganzen
  HTTP-HMAC-Webhook-Pfad durchlaufen. Neues Feld → Canzoia-Änderung +
  Koalatree-Änderung + beide-Seiten-Deployment + Schema-Drift-Risiko.
- Die Signale existieren in der Canzoia-DB. Koalatree kann sie nicht
  abfragen, muss sie geliefert bekommen. Umgekehrt: Episoden-Metadaten
  leben in Koalatree-DB, Canzoia weiß nur, was im Webhook-Payload kam.
- Debugging = Logs in zwei Vercel-Projekten korrelieren, zwei
  CRON-Secrets, zwei Deploy-URLs.

Gleichzeitig **kostet** der Split echte Stunden pro Feature.

---

## Trade-off-Matrix

| Dimension | B (Monorepo) | C (Separate) |
|---|---|---|
| **Dev-Geschwindigkeit neuer Features** | ★★★★★ — ein PR reicht | ★★☆☆☆ — zwei PRs, zwei Deploys, HMAC-Contract-Test |
| **Datenmodell-Iteration** | ★★★★★ — eine Migration | ★★☆☆☆ — Schema-Drift-Gefahr, doppelte Source-of-Truth |
| **Blast-Radius eines Deploys** | ★★☆☆☆ — Studio-Bug kills Consumer | ★★★★★ — getrennt, klare Grenze |
| **Separate Scaling/Cost** | ★★★☆☆ — ein Vercel-Plan für beide | ★★★★★ — Consumer separat skalieren |
| **Auth-Modell-Komplexität** | ★★★★☆ — ein User-Modell, Rollen | ★★☆☆☆ — zwei Auth-Welten, User-Bridging |
| **Sicherheit (Studio nicht-öffentlich)** | ★★★☆☆ — Route-Guard nötig | ★★★★★ — separate Domain, kein Attack-Surface-Mix |
| **Multi-Tenant-Story (später Studio für Dritte öffnen)** | ★★☆☆☆ — Refactor nötig | ★★★★★ — Studio ist schon eigenständig |
| **On-Call / Incident-Response** | ★★★★☆ — ein Dashboard | ★★☆☆☆ — zwei Vercel-Projekte monitoren |
| **Test-Setup für Integration** | ★★★★★ — In-Process-Calls | ★★☆☆☆ — HMAC-Mock, Webhook-Queue, Timing |
| **Einmalige Migration-Kosten** | ★☆☆☆☆ — 3-5 Tage Arbeit | ★★★★★ — 0 |

---

## Was spricht für B (Monorepo)

1. **Signal-Loop wird trivial.** Kein `profileSnapshot`-Payload
   mehr bauen, kein HMAC-Signing, kein Webhook-Retry-Queue. Der
   Generator liest die Tabelle direkt. Every time we add a new signal
   kind, we add one column + one line in the prompt-builder. Done.

2. **Schema-Single-Source.** Heute stehen die Episode-Felder
   teils in `koalatree.episodes` (Prisma) und teils in
   `canzoia.episodes` (Supabase). Jede Änderung = zwei Migrationen
   + Webhook-Contract-Update. Monorepo = eine Tabelle, ein
   Migration-Lauf.

3. **Auth und Multi-Profil gehören zusammen.** Canzoias
   Profile-Membership-Modell (`canzoia_profile_members`) ist das
   echte Identity-Modell der App. Koalatree hat ein separates
   NextAuth-User-Modell nur für Tom + Admin. Wenn wir später
   anderen Autoren Studio-Zugriff geben wollen (= Multi-Tenant),
   muss das sowieso konvergieren.

4. **Webhook-Retry-Queue (T1 von heute) wird redundant.** Die
   ganze Infrastruktur existiert nur, weil die beiden Services
   separat deployen und HTTP-Calls zwischen sich machen. Monorepo
   = function call, kein Netz, kein Retry.

5. **Debugging-Win.** Heute morgen hatten wir den
   `CANZOIA_WEBHOOK_URL`-Bug — der hätte im Monorepo gar nicht
   existiert. Allgemein: Config-Drift zwischen zwei Env-Sets ist
   eine ewige Quelle von Überraschungen.

## Was spricht für C (Separate)

1. **Studio ist NICHT für End-User.** Koalatree-Studio-Routen sind
   mächtige Admin-Tools. In einer Monorepo müssen wir sehr sauber
   über Middleware/Role-Checks verhindern, dass ein neugieriger
   Canzoia-User `/studio/*` abklappert. Separate Domain =
   Attack-Surface ist physisch getrennt.

2. **Unterschiedliche Update-Kadenzen.** Studio-Refactors sind
   risikofrei, weil sie den Consumer nicht runterreißen. In
   Monorepo: ein falscher Refactor an shared libs crasht beide.

3. **Multi-Tenant-Gedanke (wenn's jemals kommt).** Wenn Studio
   irgendwann für andere Autoren offen wird, ist es natürlich,
   dass Studio ein separates Produkt ist. Monorepo müsste dann
   zurück-gesplittet werden.

4. **Die Migration selbst kostet Zeit.** Realistisch 3-5 Tage
   Arbeit für Merge, inkl. DB-Konsolidierung, Auth-Bridging,
   Route-Reshuffle, alle Integrationstests. Das sind 3-5 Tage,
   in denen keine User-facing-Features entstehen.

5. **Status Quo funktioniert.** Die heutige Arbeit zeigt: der
   Split ist betreibbar. Retry-Queue + Health-Checks + Signals
   funktionieren. Die Reibung ist real, aber beherrschbar.

---

## Hybrid-Option (D) — untersucht, verworfen

**D: Ein Deployment, aber zwei Repos via Git-Submodule / npm-link.**
- Klingt wie Best-of-both. Ist in Praxis schlimmer als beides:
  Submodule-Hell, doppelte `package.json`, npm-link-
  Windows-Kompatibilität, Build-Reihenfolge-Problem.
- **Verworfen.** Wenn man merged, dann richtig.

## Hybrid-Option (E) — interessant

**E: Monorepo via Turborepo/Nx mit zwei getrennten Apps.**
- `apps/koalatree/` + `apps/canzoia/` + `packages/shared/`
- Ein Repo, zwei Deployments, geteilter Code.
- Gibt dir Single-Source-Migrations (via `packages/db`), aber
  behält separate Vercel-Projekte + separate Attack-Surfaces.
- **Kompromiss:** Kein Auth-Bridging-Pain, aber auch kein
  Signal-Loop-Direct-Read — HTTP bleibt.
- Einmalkosten: ähnlich wie B (Repo-Umstellung), aber weniger
  laufzeit-kritisch (wir müssen keine HTTP-Integration zerreißen).

---

## Meine Empfehlung (nicht-bindend, Tom entscheidet)

**Kurzfristig (nächste 4-6 Wochen): C bleiben.**
Wir haben gerade die Integration stabilisiert (Retry-Queue,
Health, Signals). Jetzt sollte Feature-Velocity auf User-facing-
Kram liegen: UI-Overhaul (Option 2), Smart-Feedback-Bar, Show-
Wizard. Monorepo-Migration ist 3-5 Tage Infra-Arbeit ohne User-
Mehrwert.

**Mittelfristig (wenn sich eins der folgenden ereignet): B oder E.**
- Mehr als 3x pro Woche ein Feature braucht beide-Seiten-Änderungen.
- Schema-Drift führt zu einem echten Prod-Bug.
- Wir wollen Multi-Tenant (= dann eher C lassen, aber shared-lib
  via E).

**Sofort umsetzbar — unabhängig von B/C/E:**
1. `packages/shared` extrahieren: Types für `GenerateRequest`,
   `WebhookPayload`, `Signal` leben heute mirrored in beiden Repos.
   Via npm-Package oder Copy-Sync-Script synchronisieren.
2. **Contract-Tests** im Koalatree-Repo: beide Canzoia-Types-Änderungen
   müssen durch einen Test, der dokumentiert, was der Webhook-Receiver
   erwartet.
3. **Ein gemeinsames Dashboard/Statuspage** für beide Health-
   Endpoints, damit On-Call nicht zwei Tabs braucht.

Das gibt uns 80% der Monorepo-Ergonomie ohne den Migration-
Aufwand.

---

## Offene Fragen (für die Entscheidung)

1. Wie oft pro Woche müssen wir heute Änderungen synchron auf
   beiden Seiten deployen? (Empirische Frage — lohnt, ein paar
   Wochen zu messen.)
2. Gibt es ein User-Feature auf der Roadmap, das **Live-Reads**
   aus Koalatree-DB in Canzoia-UI braucht? (Z.B. "zeige live den
   Generierungs-Fortschritt mit Zwischenergebnissen".) Das würde
   B deutlich attraktiver machen.
3. Wenn Studio jemals für Dritte geöffnet wird: ist das ein
   separates Produkt (= C) oder ein Role-Bit im Monorepo (= B)?
4. Supabase (Canzoia) vs Prisma (Koalatree) — welches ORM bleibt,
   wenn wir mergen? Supabase-RLS ist ein harter Lock-in für
   Canzoia-Seite; Koalatree könnte leichter wechseln.

---

## Nächste Schritte

- [ ] Tom liest + entscheidet (oder vertagt)
- [ ] Falls C: "Sofort umsetzbar"-Liste oben abarbeiten (Types-
      Sync, Contract-Tests, Shared Dashboard) — alles 1-Tages-Items.
- [ ] Falls B oder E: separate Migration-Plan-ADR erstellen, inkl.
      DB-Cutover, Auth-Merge, Route-Konvention.
- [ ] In beiden Fällen: diese Entscheidung reviewen, wenn der
      nächste "beide Seiten sind betroffen"-Change ansteht.
