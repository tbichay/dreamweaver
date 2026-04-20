/**
 * Admin-Auth helper for Studio Shows system.
 *
 * The Shows-System in /studio is admin-only (same gate as /studio/layout.tsx
 * via /api/admin/onboarding). This helper re-checks the admin email server-side
 * so API routes can reject non-admin sessions even if a UI gate is bypassed.
 */

import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "tom@bichay.de").toLowerCase();

export type AdminSession = Session & { user: { id: string; email: string } };

export async function requireAdmin(): Promise<AdminSession | null> {
  const session = await auth();
  if (!session?.user?.email || !session.user.id) return null;
  if (session.user.email.toLowerCase() !== ADMIN_EMAIL) return null;
  return session as AdminSession;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
