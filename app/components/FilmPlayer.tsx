"use client";

import { useState, useRef, useEffect } from "react";

interface Clip {
  index: number;
  videoUrl: string;
  characterId?: string;
  duration?: number;
}

interface Props {
  clips: Clip[];
  onClose?: () => void;
}

export default function FilmPlayer({ clips, onClose }: Props) {
  const [currentClip, setCurrentClip] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const playableClips = clips.filter((c) => c.videoUrl);

  useEffect(() => {
    // Auto-play when clips change
    if (videoRef.current && isPlaying) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentClip, isPlaying]);

  const handleEnded = () => {
    if (currentClip < playableClips.length - 1) {
      setCurrentClip(currentClip + 1);
    } else {
      setIsPlaying(false);
      setCurrentClip(0);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const clipProgress = videoRef.current.currentTime / (videoRef.current.duration || 1);
    const overall = (currentClip + clipProgress) / playableClips.length;
    setTotalProgress(overall * 100);
  };

  const playAll = () => {
    setCurrentClip(0);
    setIsPlaying(true);
    setTimeout(() => videoRef.current?.play().catch(() => {}), 100);
  };

  if (playableClips.length === 0) {
    return (
      <div className="bg-black rounded-xl aspect-[9/16] max-h-[500px] flex items-center justify-center text-white/30 text-xs">
        Keine Clips zum Abspielen
      </div>
    );
  }

  const clip = playableClips[currentClip];

  return (
    <div className="relative bg-black rounded-xl overflow-hidden">
      {/* Video */}
      <div className="aspect-[9/16] max-h-[500px]">
        <video
          ref={videoRef}
          key={clip.videoUrl}
          src={clip.videoUrl}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls={!isPlaying}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Film progress bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2">
        {/* Overall progress */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#a8d5b8] rounded-full transition-all duration-200"
            style={{ width: `${totalProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                onClick={playAll}
                className="w-8 h-8 rounded-full bg-[#4a7c59]/50 flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </button>
            ) : (
              <button
                onClick={() => { videoRef.current?.pause(); setIsPlaying(false); }}
                className="w-8 h-8 rounded-full bg-[#4a7c59]/50 flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              </button>
            )}
            <span className="text-[10px] text-white/50">
              Clip {currentClip + 1}/{playableClips.length}
            </span>
          </div>

          {/* Clip navigation */}
          <div className="flex gap-1">
            <button
              onClick={() => { setCurrentClip(Math.max(0, currentClip - 1)); }}
              disabled={currentClip === 0}
              className="text-[10px] text-white/30 hover:text-white/60 disabled:opacity-30 px-1"
            >
              ←
            </button>
            <button
              onClick={() => { setCurrentClip(Math.min(playableClips.length - 1, currentClip + 1)); }}
              disabled={currentClip === playableClips.length - 1}
              className="text-[10px] text-white/30 hover:text-white/60 disabled:opacity-30 px-1"
            >
              →
            </button>
          </div>

          {onClose && (
            <button onClick={onClose} className="text-[10px] text-white/30 hover:text-white/60">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Clip dots */}
      <div className="absolute top-2 left-0 right-0 flex justify-center gap-1">
        {playableClips.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentClip(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i === currentClip ? "bg-[#a8d5b8] scale-125" : i < currentClip ? "bg-[#a8d5b8]/40" : "bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
