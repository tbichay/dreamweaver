/**
 * Health check for the LipSync spike.
 *
 * Diagnoses "Forbidden" failures by probing each dependency individually:
 *   1. FAL_KEY env present + fal.storage.upload() round-trip with a 1x1 PNG
 *   2. BLOB_READ_WRITE_TOKEN env present + put() round-trip with a tiny blob
 *
 * Returns a per-check pass/fail + error message so the test page can tell
 * the user WHICH credential is broken instead of guessing.
 */

import { auth } from "@/lib/auth";
import { put, del } from "@vercel/blob";

export const maxDuration = 30;

interface Check {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
  detail?: string;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const checks: Check[] = [];

  // 1x1 transparent PNG (smallest possible to not waste credits)
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );

  // ── 1. FAL_KEY present? ──
  checks.push({
    name: "FAL_KEY env",
    ok: !!process.env.FAL_KEY,
    ms: 0,
    error: process.env.FAL_KEY ? undefined : "FAL_KEY is not set in the environment",
  });

  // ── 2. fal.storage.upload round-trip ──
  if (process.env.FAL_KEY) {
    const t = Date.now();
    try {
      const { uploadToFal } = await import("@/lib/fal");
      const url = await uploadToFal(tinyPng, "health-check.png", "image/png");
      checks.push({
        name: "fal.storage.upload",
        ok: true,
        ms: Date.now() - t,
        detail: url.slice(0, 120),
      });
    } catch (err) {
      checks.push({
        name: "fal.storage.upload",
        ok: false,
        ms: Date.now() - t,
        error: (err as Error).message,
      });
    }
  }

  // ── 3. BLOB_READ_WRITE_TOKEN present? ──
  checks.push({
    name: "BLOB_READ_WRITE_TOKEN env",
    ok: !!process.env.BLOB_READ_WRITE_TOKEN,
    ms: 0,
    error: process.env.BLOB_READ_WRITE_TOKEN ? undefined : "BLOB_READ_WRITE_TOKEN is not set",
  });

  // ── 4. Vercel Blob put + del round-trip ──
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const t = Date.now();
    const path = `studio/health/${session.user.id}-${Date.now()}.png`;
    try {
      const blob = await put(path, tinyPng, { access: "private", contentType: "image/png" });
      await del(blob.url).catch(() => {});
      checks.push({
        name: "vercel blob put+del",
        ok: true,
        ms: Date.now() - t,
        detail: blob.url.slice(0, 120),
      });
    } catch (err) {
      checks.push({
        name: "vercel blob put+del",
        ok: false,
        ms: Date.now() - t,
        error: (err as Error).message,
      });
    }
  }

  const allOk = checks.every((c) => c.ok);
  return Response.json({ ok: allOk, checks });
}
