"use client";

export function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white/5 p-5 h-[80px] flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-white/5 shimmer flex-shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-4 w-24 rounded bg-white/5 shimmer" />
        <div className="h-3 w-16 rounded bg-white/5 shimmer" />
      </div>
    </div>
  );
}

export function SkeletonStoryCard() {
  return (
    <div className="rounded-2xl bg-white/5 p-4 h-[120px] flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-white/5 shimmer flex-shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-4 w-32 rounded bg-white/5 shimmer" />
        <div className="h-3 w-48 rounded bg-white/5 shimmer" />
        <div className="h-8 w-20 rounded-lg bg-white/5 shimmer mt-auto" />
      </div>
    </div>
  );
}
