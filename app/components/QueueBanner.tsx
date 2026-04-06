"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ActiveJob {
  id: string;
  status: string;
  type?: "audio" | "film";
  step?: string;
  progress?: string;
  position?: number;
  titel?: string;
  geschichteId: string;
  scenesComplete?: number;
  scenesTotal?: number;
}

export default function QueueBanner() {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch("/api/generation-queue/active");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch {
        // ignore
      }
    }

    fetchJobs();
    intervalRef.current = setInterval(fetchJobs, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl bg-[#4a7c59]/10 border border-[#4a7c59]/20 p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-[#a8d5b8] animate-pulse" />
        <p className="text-xs font-medium text-[#a8d5b8]">
          {jobs.length === 1
            ? jobs[0].type === "film" ? "Film wird generiert" : "Audio wird generiert"
            : `${jobs.length} Jobs in der Queue`}
        </p>
      </div>
      <div className="space-y-1.5">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/30 shrink-0">
                  {job.type === "film" ? "🎬" : "🎧"}
                </span>
                <p className="text-xs text-white/50 truncate">
                  {job.titel || "Geschichte"}
                </p>
              </div>
              <p className="text-[10px] text-white/30 mt-0.5">
                {job.type === "film" && job.scenesTotal
                  ? `${job.progress || "Wird generiert..."} (${job.scenesComplete || 0}/${job.scenesTotal} Szenen)`
                  : job.status === "PROCESSING"
                    ? job.step || job.progress || "Wird generiert..."
                    : "Wartet..."}
              </p>
              {/* Film progress bar */}
              {job.type === "film" && job.scenesTotal && job.scenesTotal > 0 && (
                <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1 max-w-[200px]">
                  <div
                    className="h-full bg-[#a8d5b8] rounded-full transition-all duration-500"
                    style={{ width: `${((job.scenesComplete || 0) / job.scenesTotal) * 100}%` }}
                  />
                </div>
              )}
            </div>
            <Link
              href={`/story/result?id=${job.geschichteId}`}
              className="text-[10px] text-[#a8d5b8]/60 hover:text-[#a8d5b8] shrink-0 ml-2"
            >
              Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
