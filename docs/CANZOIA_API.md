# Canzoia API — Koalatree side

This document is the **source of truth** for the HTTP contract between
Canzoia (consumer) and Koalatree (content factory). Both repos implement
against this spec.

Schema definitions and runtime validators live in the separate package
[`@tbichay/canzoia-contracts`](https://github.com/tbichay/canzoia-contracts).
This document covers only the operational concerns: endpoints, auth,
retry semantics, deployment topology.

---

## 1. Architecture at a glance

```
                 User               (browser / mobile)
                   │
                   │  1. Browse catalog, fill form, tap Generate
                   ▼
            ┌──────────────┐              7. Deliver audio
            │   CANZOIA    │◄───────────────────────────────┐
            │  (Next.js)   │                                │
            │              │  2. POST /generate (signed)    │
            │              │──────────────────────────────► │
            │              │  202 Accepted (jobId)          │
            │              │◄───────────────────────────────│
            │              │                                │
            │              │  5. webhook: completed         │
            │              │ ◄──────────────────────────────│
            │              │                                │
            │              │  6. GET signed R2 URL,         │
            │              │     copy to Canzoia R2         │
            │              │  ─────────────────────────────►│
            └──────────────┘                        ┌──────────────┐
                   ▲                                │  KOALATREE   │
                   │  3. show.published webhook      │  (Next.js +  │
                   │                                 │   Inngest)   │
                   │◄───────────────────────────────│              │
                                                    │ Claude       │
                                                    │ ElevenLabs   │
                                                    │ Azure TTS    │
                                                    │ R2 (source)  │
                                                    └──────────────┘
                                                           ▲
                                                           │ 4. async job
                                                           │    runs
```

**Directional split:**

- Canzoia → Koalatree: **API calls** (show registry, trigger generation, poll)
- Koalatree → Canzoia: **webhooks** (registry events, generation events)

Each direction has its own signing secret (see §3).

---

## 2. Environment topology

| Env | Koalatree base URL | Canzoia base URL |
|---|---|---|
| local | `http://localhost:3000` | `http://localhost:3001` |
| preview | `https://*-koalatree.vercel.app` | `https://*-canzoia.vercel.app` |
| prod | `https://studio.koalatree.app` | `https://canzoia.app` |

Canzoia exposes one webhook endpoint: `POST /api/hooks/koalatree`.
Koalatree exposes the Canzoia API under `/api/canzoia/*`.

---

## 3. Authentication (HMAC-SHA256 v1)

Every request and webhook is signed. Implementation helpers live in
`@tbichay/canzoia-contracts` under `common/signature`.

### 3.1 Secrets

Two independent secrets, one per direction:

| Env var | Held by | Used to |
|---|---|---|
| `CANZOIA_TO_KOALATREE_SECRET` | Canzoia (sign), Koalatree (verify) | Sign Canzoia→Koalatree requests |
| `KOALATREE_TO_CANZOIA_SECRET` | Koalatree (sign), Canzoia (verify) | Sign Koalatree→Canzoia webhooks |

Rotate with a 24h overlap: add `_NEXT` variants, redeploy, swap, remove old.

### 3.2 Canonical string to sign

```
${timestamp}.${METHOD}.${path}.${sha256Hex(body)}
```

- `timestamp` — current Unix seconds (integer)
- `METHOD` — uppercase HTTP method
- `path` — URL path only, no host, no query string
- `sha256Hex(body)` — SHA-256 hex of raw request body bytes; for empty
  body, use `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

### 3.3 Header format

```
X-Canzoia-Signature: t=1712000000,v1=<64-hex-char HMAC-SHA256>
```

### 3.4 Verification rules

Verifiers MUST reject the request if any of the following hold:

1. Header missing or malformed (`parseSignatureHeader` returns `null`).
2. `|now - t| > 300` (5-minute replay window, `TIMESTAMP_TOLERANCE_SEC`).
3. Constant-time `v1` mismatch with locally-computed HMAC.

All three map to HTTP `401 UNAUTHORIZED` with `ErrorResponse` body.

---

## 4. Endpoints

### 4.1 List published shows

```
GET /api/canzoia/shows?cursor=<opaque>&category=<category>&limit=<1..100>
```

**Response 200:** `ShowRegistryPage` (see schema)

```json
{
  "shows": [ /* ShowManifest[] */ ],
  "nextCursor": "opaque-string-or-omitted"
}
```

- `cursor` — opaque pagination token from previous response. Omit for first page.
- `category` — optional filter.
- `limit` — page size, defaults to 50, max 100.

**Canzoia caching:** Koalatree sets `ETag` + `Cache-Control: private, max-age=60`.
Canzoia SHOULD respect these; the registry-sync webhooks invalidate the cache.

### 4.2 Fetch a single manifest

```
GET /api/canzoia/shows/:slug
```

**Response 200:** `ShowManifest`

**Errors:**
- `404 SHOW_NOT_FOUND` — no show with this slug.
- `404 SHOW_NOT_PUBLISHED` — show exists but is in draft state.

Canzoia uses this to refresh a single show after a `show.updated` webhook
without refetching the whole page.

### 4.3 Trigger generation

```
POST /api/canzoia/shows/:slug/generate
Content-Type: application/json
X-Canzoia-Signature: t=...,v1=...
```

**Body:** `GenerationRequest` (see schema)

**Response 202:** `GenerationAccepted`

```json
{
  "jobId": "01909e00-...",
  "status": "queued",
  "idempotencyKey": "req_...",
  "estimatedReadyAt": "2026-04-20T10:02:00.000Z",
  "pollAfterSec": 30
}
```

**Idempotency:**
- Same `idempotencyKey` within 24h with **identical payload** → returns the
  original `GenerationAccepted` (same jobId).
- Same key with **different payload** → `409 IDEMPOTENCY_CONFLICT`.
- Keys older than 24h MAY be reused (Koalatree does not enforce).

**Errors (see `HTTP_STATUS_FOR_ERROR` map):**
- `400 INVALID_INPUT` — payload failed schema or manifest-input-schema check
- `404 SHOW_NOT_FOUND` / `SHOW_NOT_PUBLISHED`
- `409 STALE_REVISION` — `showRevisionHash` no longer current
- `409 IDEMPOTENCY_CONFLICT`
- `429 QUOTA_EXCEEDED` — creator or tenant exceeded generation budget
- `503 VOICE_UNAVAILABLE` — provider outage; retry later

### 4.4 Poll job status

```
GET /api/canzoia/jobs/:job_id
```

**Response 200:** `JobStatus`

Canzoia prefers webhooks; polling is the fallback path for reconciliation
and debugging. Respect `pollAfterSec` from the initial 202 — default 30s.

---

## 5. Webhooks (Koalatree → Canzoia)

### 5.1 Delivery target

Canzoia registers **one** URL per environment:

| Env | URL |
|---|---|
| local | `http://localhost:3001/api/hooks/koalatree` |
| prod | `https://canzoia.app/api/hooks/koalatree` |

Koalatree stores this URL per tenant/env; registration happens out-of-band
for now (config in Koalatree), later via a creator-admin UI.

### 5.2 Event types

Discriminated on `event` field:

**Registry events** (`RegistryWebhook`):
- `show.published`
- `show.unpublished`
- `show.updated`

**Generation events** (`GenerationWebhook`):
- `generation.completed`
- `generation.failed`
- `generation.progress` (best-effort, may be dropped)

### 5.3 Delivery guarantees

- **At-least-once.** Canzoia MUST dedupe by
  `(event, jobId or slug, idempotencyKey)`.
- **Signed** with `KOALATREE_TO_CANZOIA_SECRET`; see §3.
- **Retry schedule** on non-2xx response:
  `+0s, +30s, +2m, +10m, +1h, +6h, +24h` — then dead-letter.
- `generation.progress` is NOT retried; drop-on-failure.

### 5.4 Canzoia handler responsibilities

1. **Verify signature BEFORE parsing body.**
2. Respond 2xx within 1 second — queue downstream work async.
3. For `generation.completed`:
   - Download from `result.audioUrl` (signed, ~1h validity)
   - Re-upload to Canzoia's own R2 bucket
   - Deduct `result.cost.totalMinutesBilled` from the user's budget
   - Emit `episode.ready` internally for the listening UI
4. For `show.published` / `.updated`: refresh local `show_cache` row.
5. For `show.unpublished`: flag local `show_cache` as hidden, don't delete
   (existing episodes still reference it).

---

## 6. Generation flow (sequence detail)

This is the hot path. Every box matters.

```
Canzoia                              Koalatree
   │                                     │
   │ 1. GET /shows (list, cached 60s)   │
   │ ──────────────────────────────────►│
   │ 2. ShowManifest[]                  │
   │ ◄──────────────────────────────────│
   │                                    │
   │ 3. User picks show, fills form     │
   │                                    │
   │ 4. Local validate userInputs       │
   │    against manifest.userInputSchema│
   │                                    │
   │ 5. POST /shows/:slug/generate      │
   │    (signed, idempotent)            │
   │ ──────────────────────────────────►│
   │                                  6.│ Enqueue Inngest job
   │                                    │ Return 202 immediately
   │ 7. 202 GenerationAccepted          │
   │ ◄──────────────────────────────────│
   │                                    │
   │ 8. Show "Wird erstellt …" UI       │
   │                                    │
   │                                  9.│ Inngest worker:
   │                                    │   a) Claude script gen
   │                                    │   b) TTS synthesis
   │                                    │   c) Upload to Koalatree R2
   │                                    │      (signed URL with 1h TTL)
   │                                    │
   │ 10. webhook generation.progress    │
   │     (stage: scripting, 20%)        │
   │ ◄──────────────────────────────────│  (best-effort)
   │ 11. webhook generation.progress    │
   │     (stage: synthesizing, 60%)     │
   │ ◄──────────────────────────────────│
   │                                    │
   │ 12. webhook generation.completed   │
   │     (signed R2 URL in body)        │
   │ ◄──────────────────────────────────│
   │                                    │
   │ 13. Verify sig, dedupe             │
   │ 14. Download audioUrl              │
   │     ───── GET to Koalatree R2 ───► │
   │     ◄───── MP3 bytes ──────────────│
   │ 15. Upload to Canzoia R2           │
   │ 16. INSERT episode row             │
   │ 17. Deduct from user budget        │
   │ 18. Push "Episode bereit" notif    │
   │                                    │
```

**Why Canzoia re-uploads** instead of hot-linking: single-source billing
for R2 egress, Canzoia can purge audio independently when a user deletes
their profile (DSGVO), and the signed URL expires in ~1h anyway.

---

## 7. Error semantics

### 7.1 Error envelope (always, for every non-2xx)

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "userInputs.topic: too long (max 100 chars)",
    "details": { "issues": [ /* Zod issues */ ] },
    "incidentId": "018f..."
  }
}
```

### 7.2 Retry matrix

| Code | Retry? | Client action |
|---|---|---|
| `UNAUTHORIZED` | No | Fix signing, don't retry blindly |
| `INVALID_INPUT` | No | Fix payload, resubmit with new idempotencyKey |
| `SHOW_NOT_FOUND` | No | Refresh local catalog |
| `SHOW_NOT_PUBLISHED` | No | Remove from UI |
| `STALE_REVISION` | Yes (once) | Refetch manifest, re-validate inputs, resubmit |
| `VOICE_UNAVAILABLE` | Yes | Exp backoff starting at 30s, max 3 tries |
| `IDEMPOTENCY_CONFLICT` | No | Generate a new idempotencyKey |
| `QUOTA_EXCEEDED` | No | Show upgrade prompt |
| `GENERATION_TIMEOUT` | Yes | Resubmit with new idempotencyKey |
| `INTERNAL_ERROR` | Yes | Exp backoff, max 3 tries, then escalate |

---

## 8. Rate limits

| Endpoint | Limit | Window | Scope |
|---|---|---|---|
| `GET /shows` | 60 req | 1 min | per signing-secret |
| `GET /shows/:slug` | 120 req | 1 min | per signing-secret |
| `POST /generate` | 10 req | 1 min | per signing-secret |
| `GET /jobs/:id` | 120 req | 1 min | per signing-secret |

Exceeding → `429` with `Retry-After` header in seconds.

Canzoia is the only consumer for now, so these are per-Canzoia-deployment.
Multi-creator-tenant scoping is added when a second consumer signs up.

---

## 9. Multi-creator design notes

For the MVP, Koalatree has a single signing-secret pair — one Canzoia
deployment. When a second creator ships shows to their own Canzoia (or a
different consumer app) we'll need:

1. Per-tenant signing secret pair
2. `X-Canzoia-Tenant` header to select which secret verifies
3. `ShowManifest.ownerOrgId` already supports the data model
4. Per-tenant webhook URL registration

None of this is implemented yet, but the schema is ready for it.

---

## 10. Local development

### 10.1 Running both sides locally

```bash
# terminal 1
cd koalatree && PORT=3000 npm run dev

# terminal 2
cd canzoia && PORT=3001 npm run dev
```

### 10.2 Env vars needed

**Koalatree `.env.local`:**
```
CANZOIA_TO_KOALATREE_SECRET=<64-hex-char-random>
KOALATREE_TO_CANZOIA_SECRET=<64-hex-char-random>
CANZOIA_WEBHOOK_URL=http://localhost:3001/api/hooks/koalatree
```

**Canzoia `.env.local`:**
```
CANZOIA_TO_KOALATREE_SECRET=<same as Koalatree>
KOALATREE_TO_CANZOIA_SECRET=<same as Koalatree>
KOALATREE_API_URL=http://localhost:3000
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 10.3 Testing the contract locally without publishing

While `@tbichay/canzoia-contracts` is not yet published, use a local
file-reference in both `package.json`s:

```json
"dependencies": {
  "@tbichay/canzoia-contracts": "file:../canzoia-contracts"
}
```

Run `npm run build` in `canzoia-contracts` before `npm install` in the
consumers. Switch to the registry version once `v0.1.0` is published.

---

## 11. Open decisions

Tracked here until resolved, then moved into the main spec:

- **Webhook URL registration UI** — currently manual env var; needed when
  multi-creator lands (§9).
- **Trailer regeneration** — when a show updates, should the trailer
  auto-regenerate? Proposal: flag on `ShowManifest`
  (`regenerateTrailerOnUpdate: boolean`).
- **Episode purging** — when Canzoia deletes a user profile, does
  Koalatree also purge the source audio from its R2? Probably yes, via a
  reverse-webhook `profile.deleted`. Not scoped for v0.1.
