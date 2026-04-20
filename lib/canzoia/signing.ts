/**
 * HMAC-SHA256 request signing v1 — matches docs/CANZOIA_API.md §3 and the
 * shared `@tbichay/canzoia-contracts` package (common/signature.ts).
 *
 * Header:   X-Canzoia-Signature: t=<unix_seconds>,v1=<64-hex-char HMAC>
 * Canonical: `${timestamp}.${METHOD_UPPER}.${path}.${sha256Hex(body)}`
 *            (path is pathname only — no host, no query string)
 * Window:   ±300s (TIMESTAMP_TOLERANCE_SEC) replay protection
 *
 * Two directional secrets:
 *   CANZOIA_TO_KOALATREE_SECRET  — verify here, sign in Canzoia
 *   KOALATREE_TO_CANZOIA_SECRET  — sign here (webhooks), verify in Canzoia
 *
 * We keep the implementation inline rather than depending on the
 * canzoia-contracts package so Koalatree can ship before contracts v0.1.0
 * is published to npm. When contracts ships, replace these helpers with
 * `import { parseSignatureHeader, canonicalStringToSign, ... } from "@tbichay/canzoia-contracts"`.
 */

import { createHmac, createHash, timingSafeEqual } from "crypto";

export const SIGNATURE_HEADER = "X-Canzoia-Signature";
export const TIMESTAMP_TOLERANCE_SEC = 300;
/** SHA-256 hex of empty string. */
export const EMPTY_BODY_SHA256_HEX =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export type SigningResult =
  | { ok: true }
  | { ok: false; status: number; code: "UNAUTHORIZED"; message: string };

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("hex");
}

/** Canonical string for signing — MUST match canzoia-contracts exactly. */
export function canonicalStringToSign(
  timestamp: number,
  method: string,
  path: string,
  bodySha256Hex: string
): string {
  return `${timestamp}.${method.toUpperCase()}.${path}.${bodySha256Hex}`;
}

type ParsedSig = { t: number; v1?: string };

function parseSignatureHeader(raw: string | null): ParsedSig | null {
  if (!raw || raw.length === 0 || raw.length > 512) return null;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let t: number | undefined;
  let v1: string | undefined;
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq <= 0) return null;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    if (!k || !v) return null;
    if (k === "t") {
      if (!/^\d+$/.test(v)) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) return null;
      t = n;
    } else if (k === "v1") {
      if (!/^[0-9a-f]{64}$/i.test(v)) return null;
      v1 = v.toLowerCase();
    }
    // Unknown keys ignored (forward-compat for v2+).
  }
  if (t === undefined) return null;
  return { t, v1 };
}

/**
 * Verify an incoming request signed with `CANZOIA_TO_KOALATREE_SECRET`.
 * Caller passes the RAW body bytes exactly as the client hashed them.
 */
export function verifyCanzoiaRequest(req: Request, rawBody: string): SigningResult {
  const secret = process.env.CANZOIA_TO_KOALATREE_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 500,
      code: "UNAUTHORIZED",
      message: "Server misconfigured: CANZOIA_TO_KOALATREE_SECRET missing",
    };
  }

  const header = req.headers.get(SIGNATURE_HEADER.toLowerCase()) ?? req.headers.get(SIGNATURE_HEADER);
  const parsed = parseSignatureHeader(header);
  if (!parsed || !parsed.v1) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Missing or malformed signature header" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.t) > TIMESTAMP_TOLERANCE_SEC) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Timestamp outside tolerance window" };
  }

  const url = new URL(req.url);
  // Path only — no query string per spec §3.2.
  const path = url.pathname;
  const bodyHash = rawBody.length === 0 ? EMPTY_BODY_SHA256_HEX : sha256Hex(rawBody);
  const expected = hmacSha256Hex(
    canonicalStringToSign(parsed.t, req.method, path, bodyHash),
    secret
  );

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parsed.v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Signature mismatch" };
  }
  return { ok: true };
}

/** Build a signed outgoing webhook header set using KOALATREE_TO_CANZOIA_SECRET. */
export function signOutgoingWebhook(params: {
  method: string;
  path: string;
  rawBody: string;
}): { headers: Record<string, string> } | null {
  const secret = process.env.KOALATREE_TO_CANZOIA_SECRET;
  if (!secret) return null;
  const t = Math.floor(Date.now() / 1000);
  const bodyHash = params.rawBody.length === 0 ? EMPTY_BODY_SHA256_HEX : sha256Hex(params.rawBody);
  const v1 = hmacSha256Hex(canonicalStringToSign(t, params.method, params.path, bodyHash), secret);
  return {
    headers: {
      [SIGNATURE_HEADER]: `t=${t},v1=${v1}`,
      "content-type": "application/json",
    },
  };
}
