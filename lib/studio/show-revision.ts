/**
 * Show revision-hash helper.
 *
 * Every mutation of a Show (top-level fields, cast, foki) should bump the
 * revision-hash so Canzoia's cache keys change and clients re-fetch trailer
 * + catalog metadata.
 *
 * We use a simple random 12-char hex — the exact value doesn't matter, only
 * that it differs from the previous one. If you want deterministic hashes
 * later (e.g. sha256 of the Show JSON for diff-detection) this is the single
 * place to change.
 */

import { randomUUID } from "crypto";

export function bumpRevisionHash(_prev: string) {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function newRevisionHash() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}
