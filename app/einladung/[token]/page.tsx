"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import PageTransition from "@/app/components/PageTransition";
import Stars from "@/app/components/Stars";

interface InviteInfo {
  profilName: string;
  profilAvatar: string | null;
  eingeladenVon: string;
  sichtbarkeit: string[];
  status: string;
}

export default function EinladungPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const token = params.token as string;

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Einladung nicht gefunden");
          return;
        }
        setInfo(await res.json());
      })
      .catch(() => setError("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    const res = await fetch(`/api/invite/${token}`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Fehler beim Annehmen");
      setAccepting(false);
      return;
    }

    setAccepted(true);
    setAccepting(false);

    // Redirect to dashboard after 2 seconds
    setTimeout(() => router.push("/dashboard"), 2000);
  };

  if (loading) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-12 min-h-screen">
        <Stars />
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="h-8 w-48 mx-auto rounded bg-white/5 shimmer mb-4" />
          <div className="h-32 rounded-xl bg-white/5 shimmer" />
        </div>
      </main>
    );
  }

  if (error && !info) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-12 min-h-screen">
        <Stars />
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="card p-8">
            <p className="text-lg text-white/60 mb-4">{error}</p>
            <Link href="/dashboard" className="btn-primary text-sm px-6 py-2">
              Zur Startseite
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!info) return null;

  return (
    <PageTransition>
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-12 min-h-screen">
        <Stars />
        <div className="relative z-10 w-full max-w-md">
          <div className="card p-8 text-center">
            {/* Koala Icon */}
            <div className="mx-auto mb-4 w-20 h-20 rounded-2xl overflow-hidden bg-[#1a2e1a]">
              <Image src="/api/images/koda-portrait.png" alt="Koda" width={80} height={80} className="object-cover" unoptimized />
            </div>

            <h1 className="text-xl font-bold text-[#f5eed6] mb-2">
              Einladung von {info.eingeladenVon}
            </h1>
            <p className="text-white/50 text-sm mb-6">
              Du wurdest eingeladen, {info.profilName}s Geschichten am KoalaTree anzuhören.
            </p>

            {info.sichtbarkeit.length > 0 && (
              <div className="mb-6 p-3 bg-white/5 rounded-xl">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Du kannst sehen:</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {info.sichtbarkeit.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-full bg-[#4a7c59]/20 text-[#a8d5b8] text-xs capitalize">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {accepted ? (
              <div className="p-4 bg-[#4a7c59]/20 rounded-xl border border-[#4a7c59]/30">
                <p className="text-[#a8d5b8] font-medium">Einladung angenommen!</p>
                <p className="text-xs text-white/40 mt-1">Du wirst weitergeleitet...</p>
              </div>
            ) : authStatus === "authenticated" ? (
              <div className="space-y-3">
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="btn-primary w-full py-3 text-sm disabled:opacity-50"
                >
                  {accepting ? "Wird angenommen..." : "Einladung annehmen"}
                </button>
                <p className="text-[10px] text-white/30">
                  Angemeldet als {session?.user?.email}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-white/50 mb-3">
                  Melde dich an, um die Einladung anzunehmen.
                </p>
                <Link
                  href={`/sign-in?callbackUrl=/einladung/${token}`}
                  className="btn-primary block w-full py-3 text-sm text-center"
                >
                  Anmelden
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
