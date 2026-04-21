"use client";

/**
 * Episode-Detail — Admin-Debug-View fuer genau eine ShowEpisode.
 *
 * Gedacht fuer:
 *   - "Warum ist das fehlgeschlagen?" (errorCode + errorMessage + Prompts)
 *   - "Was hat Claude wirklich bekommen?" (promptSystem + promptUser)
 *   - "Klingt das wie erwartet?" (Audio-Player + Transkript)
 *   - "Noch mal probieren" (Retry-Button, rebuildet nix — nimmt Snapshot,
 *     den die Row schon hat)
 *
 * Nicht gedacht fuer:
 *   - End-Customer-Zugriff. Auth-Gate durch Studio-Layout +
 *     requireAdmin() auf allen API-Calls.
 */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TimelineEntry {
  kind?: string;
  text?: string;
  characterId?: string;
  startMs?: number;
  endMs?: number;
  [k: string]: unknown;
}

interface EpisodeDetail {
  id: string;
  canzoiaJobId: string;
  idempotencyKey: string;
  canzoiaProfileId: string;
  showRevisionHash: string;

  status: string;
  progressPct: number;
  progressStage: string | null;

  title: string | null;
  text: string | null;
  audioUrl: string | null;
  durationSec: number | null;
  timeline: TimelineEntry[] | null;

  promptSystem: string | null;
  promptUser: string | null;

  userInputs: Record<string, unknown> | null;
  profileSnapshot: Record<string, unknown> | null;

  inputTokens: number | null;
  outputTokens: number | null;
  ttsChars: number | null;
  totalMinutesBilled: number | null;

  errorCode: string | null;
  errorMessage: string | null;

  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;

  show: { id: string; slug: string; title: string };
  showFokus: {
    id: string;
    label: string;
    emoji: string | null;
    enabled: boolean;
  };
}

type Params = { slug: string; id: string };

export default function EpisodeDetailPage({ params }: { params: Promise<Params> }) {
  const { slug, id } = use(params);
  const router = useRouter();

  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio/shows/${slug}/episodes/${id}`);
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || `HTTP ${res.status}`);
        return;
      }
      setEpisode(d.episode as EpisodeDetail);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [slug, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-Poll waehrend Generation laeuft: wenn der Status nicht terminal
  // ist, alle 3s neu laden, damit progressPct + progressStage live
  // tickern. Sobald completed/failed, stoppt das Polling.
  useEffect(() => {
    if (!episode) return;
    if (episode.status === "completed" || episode.status === "failed") return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [episode, load]);

  async function triggerRetry() {
    if (!episode || retrying) return;
    setRetrying(true);
    setRetryMessage(null);
    try {
      const res = await fetch(`/api/studio/shows/${slug}/episodes/${id}/retry`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) {
        setRetryMessage(`Fehler: ${d.error || `HTTP ${res.status}`}`);
        return;
      }
      setRetryMessage("Retry angestossen — Episode laeuft neu.");
      await load();
    } catch (e) {
      setRetryMessage(`Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 text-white/40 text-sm">Lade Episode…</div>
    );
  }

  if (error || !episode) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-red-400 text-sm mb-4">{error || "Episode nicht gefunden"}</p>
        <Link
          href={`/studio/shows/${slug}`}
          className="text-[#C8A97E] text-sm hover:underline"
        >
          ← Zurueck zur Show
        </Link>
      </div>
    );
  }

  const canRetry =
    episode.status === "failed" ||
    episode.status === "queued" ||
    episode.status === "scripting" ||
    episode.status === "synthesizing" ||
    episode.status === "uploading";

  const isRunning =
    episode.status === "queued" ||
    episode.status === "scripting" ||
    episode.status === "synthesizing" ||
    episode.status === "uploading";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/studio/shows/${slug}`}
          className="text-[11px] text-white/40 hover:text-white/70"
        >
          ← {episode.show.title}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#f5eed6]">
              {episode.title ?? "(kein Titel)"}
            </h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-white/50">
              <StatusBadge status={episode.status} />
              <span>•</span>
              <span>
                {episode.showFokus.emoji ?? ""} {episode.showFokus.label}
              </span>
              <span>•</span>
              <span>{formatDate(episode.createdAt)}</span>
              {episode.durationSec != null && (
                <>
                  <span>•</span>
                  <span>{formatDuration(episode.durationSec)}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {canRetry && (
              <button
                type="button"
                onClick={triggerRetry}
                disabled={retrying}
                className="px-3 py-1.5 text-xs rounded-lg bg-[#C8A97E] text-[#141414] font-medium hover:bg-[#d4b88c] disabled:opacity-50 transition"
              >
                {retrying ? "Starte…" : episode.status === "failed" ? "Retry" : "Neu starten"}
              </button>
            )}
            {retryMessage && (
              <p className="text-[11px] text-white/60 max-w-xs text-right">{retryMessage}</p>
            )}
          </div>
        </div>
      </div>

      {/* Progress-Bar waehrend Generation */}
      {isRunning && (
        <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>{episode.progressStage ?? "laeuft…"}</span>
            <span>{episode.progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-[#C8A97E] transition-all"
              style={{ width: `${episode.progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error-Panel */}
      {episode.status === "failed" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
              {episode.errorCode ?? "UNKNOWN"}
            </span>
            <span className="text-xs text-white/60">Fehlgeschlagen</span>
          </div>
          {episode.errorMessage && (
            <pre className="text-[11px] text-red-200/80 font-mono whitespace-pre-wrap leading-relaxed">
              {episode.errorMessage}
            </pre>
          )}
        </div>
      )}

      {/* Audio */}
      {episode.audioUrl && (
        <section className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4">
          <h2 className="text-xs uppercase tracking-wide text-white/50 mb-3">Audio</h2>
          <audio src={episode.audioUrl} controls className="w-full" />
          <div className="mt-2 flex items-center gap-3 text-[10px] text-white/40 font-mono">
            <a href={episode.audioUrl} target="_blank" rel="noreferrer" className="hover:text-white/70 truncate">
              {episode.audioUrl}
            </a>
          </div>
        </section>
      )}

      {/* Grid: Stats + Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Tokens (in / out)" value={formatTokenPair(episode.inputTokens, episode.outputTokens)} />
        <StatCard label="TTS-Chars" value={formatNumber(episode.ttsChars)} />
        <StatCard label="Billable Minutes" value={episode.totalMinutesBilled?.toFixed(2) ?? "—"} />
        <StatCard label="Revision" value={<code className="font-mono">{episode.showRevisionHash.slice(0, 8)}</code>} />
        <StatCard label="Canzoia Profile" value={<code className="font-mono text-[10px]">{episode.canzoiaProfileId}</code>} />
        <StatCard label="Canzoia Job" value={<code className="font-mono text-[10px]">{episode.canzoiaJobId}</code>} />
      </div>

      {/* Timeline */}
      {Array.isArray(episode.timeline) && episode.timeline.length > 0 && (
        <details className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4">
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-white/50 hover:text-white/80">
            Timeline ({episode.timeline.length} Eintraege)
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-white/40 border-b border-white/10">
                <tr>
                  <th className="text-left py-1.5 pr-2 font-normal">#</th>
                  <th className="text-left py-1.5 pr-2 font-normal">Start</th>
                  <th className="text-left py-1.5 pr-2 font-normal">Dauer</th>
                  <th className="text-left py-1.5 pr-2 font-normal">Kind</th>
                  <th className="text-left py-1.5 pr-2 font-normal">Actor</th>
                  <th className="text-left py-1.5 font-normal">Text</th>
                </tr>
              </thead>
              <tbody>
                {episode.timeline.map((entry, i) => {
                  const start = Number(entry.startMs ?? 0);
                  const end = Number(entry.endMs ?? 0);
                  const dur = end - start;
                  return (
                    <tr key={i} className="border-b border-white/5 text-white/70">
                      <td className="py-1.5 pr-2 text-white/30 font-mono">{i + 1}</td>
                      <td className="py-1.5 pr-2 font-mono">{formatMs(start)}</td>
                      <td className="py-1.5 pr-2 font-mono">{formatMs(dur)}</td>
                      <td className="py-1.5 pr-2">{entry.kind ?? "—"}</td>
                      <td className="py-1.5 pr-2 font-mono text-[10px]">
                        {entry.characterId ?? "—"}
                      </td>
                      <td className="py-1.5 text-white/60 truncate max-w-xs">
                        {entry.text ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Script */}
      {episode.text && (
        <details className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4" open>
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-white/50 hover:text-white/80">
            Script ({episode.text.length} Zeichen)
          </summary>
          <pre className="mt-3 text-[11px] text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
            {episode.text}
          </pre>
        </details>
      )}

      {/* Prompts */}
      {(episode.promptSystem || episode.promptUser) && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-white/50">Gesendete Prompts</h2>
          {episode.promptSystem && (
            <details className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4">
              <summary className="cursor-pointer text-[11px] text-white/60 hover:text-white/80">
                system ({episode.promptSystem.length} Zeichen)
              </summary>
              <pre className="mt-3 text-[11px] text-white/60 whitespace-pre-wrap font-mono leading-relaxed">
                {episode.promptSystem}
              </pre>
            </details>
          )}
          {episode.promptUser && (
            <details className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4">
              <summary className="cursor-pointer text-[11px] text-white/60 hover:text-white/80">
                user ({episode.promptUser.length} Zeichen)
              </summary>
              <pre className="mt-3 text-[11px] text-white/60 whitespace-pre-wrap font-mono leading-relaxed">
                {episode.promptUser}
              </pre>
            </details>
          )}
        </section>
      )}

      {/* Inputs */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-white/50">Eingaben</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <JsonCard label="userInputs" value={episode.userInputs} />
          <JsonCard label="profileSnapshot" value={episode.profileSnapshot} />
        </div>
      </section>

      {/* Audit */}
      <section className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4">
        <h2 className="text-xs uppercase tracking-wide text-white/50 mb-3">Audit</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
          <AuditRow label="Erstellt" value={formatDateTime(episode.createdAt)} />
          <AuditRow label="Gestartet" value={formatDateTime(episode.startedAt)} />
          <AuditRow label="Fertig" value={formatDateTime(episode.completedAt)} />
          {episode.startedAt && episode.completedAt && (
            <AuditRow
              label="Laufzeit"
              value={formatRuntime(episode.startedAt, episode.completedAt)}
            />
          )}
          <AuditRow
            label="Idempotency-Key"
            value={<code className="font-mono text-[10px] break-all">{episode.idempotencyKey}</code>}
          />
        </dl>
      </section>

      {/* Footer-Nav */}
      <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
        <button
          type="button"
          onClick={() => router.push(`/studio/shows/${slug}`)}
          className="hover:text-white/70"
        >
          ← {episode.show.title}
        </button>
        <button type="button" onClick={() => void load()} className="hover:text-white/70">
          Aktualisieren
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    completed: "bg-green-500/20 text-green-300",
    failed: "bg-red-500/20 text-red-300",
    queued: "bg-white/10 text-white/60",
    scripting: "bg-yellow-500/20 text-yellow-300",
    synthesizing: "bg-yellow-500/20 text-yellow-300",
    uploading: "bg-blue-500/20 text-blue-300",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${palette[status] ?? "bg-white/10 text-white/50"}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-sm text-[#f5eed6]">{value ?? "—"}</div>
    </div>
  );
}

function JsonCard({ label, value }: { label: string; value: unknown }) {
  const isEmpty =
    value == null ||
    (typeof value === "object" && value !== null && Object.keys(value as object).length === 0);
  return (
    <details className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3" open={!isEmpty}>
      <summary className="cursor-pointer text-[11px] text-white/60 hover:text-white/80">
        {label}
      </summary>
      <pre className="mt-2 text-[10px] text-white/70 font-mono whitespace-pre-wrap">
        {isEmpty ? "{}" : JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function AuditRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/70">{value ?? "—"}</dd>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("de-DE");
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("de-DE");
  } catch {
    return iso;
  }
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")} min`;
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatNumber(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("de-DE");
}

function formatTokenPair(input: number | null, output: number | null) {
  if (input == null && output == null) return "—";
  return `${input ?? 0} / ${output ?? 0}`;
}

function formatRuntime(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const ms = Math.max(0, end - start);
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
