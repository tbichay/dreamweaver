"use client";

/**
 * TaskStatusBar — Shows active tasks inline with live polling.
 *
 * Place this anywhere in the UI to show running AI tasks.
 * Polls /api/studio/tasks every 3 seconds when tasks are active.
 * Works cross-device — reads from DB, not local state.
 */

import { useState, useEffect, useCallback } from "react";

interface Task {
  id: string;
  type: string;
  status: string;
  progress?: string;
  progressPct?: number;
  error?: string;
  project?: { name: string } | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  story: "Geschichte",
  screenplay: "Drehbuch",
  audio: "Audio",
  clip: "Clip",
  portrait: "Portrait",
  landscape: "Landscape",
  "character-sheet": "Character Sheet",
  assemble: "Film Assembly",
  "voice-design": "Stimme",
  "voice-test": "Stimm-Test",
};

export default function TaskStatusBar({ projectId }: { projectId?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: "running" });
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/studio/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch { /* */ }
  }, [projectId]);

  useEffect(() => {
    loadTasks();
    // Poll every 3 seconds
    const interval = setInterval(loadTasks, 3000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const cancelTask = async (taskId: string) => {
    await fetch(`/api/studio/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    loadTasks();
  };

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-3">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#d4a853]/10 border border-[#d4a853]/20">
          <div className="w-3 h-3 border-2 border-[#d4a853] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#d4a853] font-medium">
                {TYPE_LABELS[task.type] || task.type}
              </span>
              {task.progress && (
                <span className="text-[10px] text-white/40 truncate">{task.progress}</span>
              )}
            </div>
            {task.progressPct !== null && task.progressPct !== undefined && task.progressPct > 0 && (
              <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-[#d4a853]/50 rounded-full transition-all" style={{ width: `${task.progressPct}%` }} />
              </div>
            )}
          </div>
          <button
            onClick={() => cancelTask(task.id)}
            className="text-[9px] text-white/20 hover:text-red-400 flex-shrink-0"
            title="Abbrechen"
          >
            &#x2715;
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * TaskBadge — Small badge showing number of active tasks.
 * Use in sidebar navigation.
 */
export function TaskBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () => {
      fetch("/api/studio/tasks?status=running")
        .then((r) => r.json())
        .then((d) => setCount(d.tasks?.length || 0))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-[#d4a853]/30 text-[#d4a853]">
      {count}
    </span>
  );
}
