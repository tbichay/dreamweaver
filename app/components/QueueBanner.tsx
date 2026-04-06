"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ActiveJob {
  id: string;
  status: string;
  step?: string;
  position?: number;
  titel?: string;
  geschichteId: string;
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
          {jobs.length === 1 ? "Audio wird generiert" : `${jobs.length} Audios in der Queue`}
        </p>
      </div>
      <div className="space-y-1.5">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50 truncate">
                {job.titel || "Geschichte"}
              </p>
              <p className="text-[10px] text-white/30">
                {job.status === "PROCESSING"
                  ? job.step || "Wird generiert..."
                  : job.position !== undefined && job.position > 0
                    ? `Position ${job.position + 1}`
                    : "Wartet..."}
              </p>
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
