"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

const CHARACTERS = [
  {
    id: "koda",
    name: "Koda",
    role: "Der Weise",
    desc: "Euer Geschichtenerzähler — warm, geduldig und voller Liebe.",
    portrait: "/koda-portrait.png",
    color: "#a8d5b8",
    bgGlow: "rgba(168, 213, 184, 0.15)",
  },
  {
    id: "kiki",
    name: "Kiki",
    role: "Die Lustige",
    desc: "Der freche Kookaburra bringt Humor in jede Geschichte!",
    portrait: "/kiki-portrait.png",
    color: "#e8c547",
    bgGlow: "rgba(232, 197, 71, 0.15)",
  },
  {
    id: "luna",
    name: "Luna",
    role: "Die Träumerin",
    desc: "Sanfte Traumreisen und Meditationen zum Einschlafen.",
    portrait: "/luna-portrait.png",
    color: "#b8a0d5",
    bgGlow: "rgba(184, 160, 213, 0.15)",
  },
  {
    id: "mika",
    name: "Mika",
    role: "Der Mutige",
    desc: "Spannende Abenteuer und Herausforderungen meistern.",
    portrait: "/mika-portrait.png",
    color: "#d4884a",
    bgGlow: "rgba(212, 136, 74, 0.15)",
  },
  {
    id: "pip",
    name: "Pip",
    role: "Der Entdecker",
    desc: "Rätsel lösen und die Welt entdecken.",
    portrait: "/pip-portrait.png",
    color: "#6bb5c9",
    bgGlow: "rgba(107, 181, 201, 0.15)",
  },
  {
    id: "sage",
    name: "Sage",
    role: "Der Stille",
    desc: "Tiefe Gedanken und stille Reflexion.",
    portrait: "/sage-portrait.png",
    color: "#8a9e7a",
    bgGlow: "rgba(138, 158, 122, 0.15)",
  },
];

export default function CharacterShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const active = CHARACTERS[activeIndex];

  // Auto-rotate when not playing audio
  useEffect(() => {
    if (isPlaying) return;

    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CHARACTERS.length);
    }, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const handleCharacterClick = useCallback((index: number) => {
    setActiveIndex(index);
    // Reset auto-rotate timer
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const handlePlayDemo = useCallback(() => {
    setHasInteracted(true);
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  return (
    <div className="relative">
      {/* Hidden audio for demo */}
      <audio
        ref={audioRef}
        src="/api/audio/onboarding"
        preload="none"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Main showcase area */}
      <div className="relative flex flex-col items-center">
        {/* Active character portrait — large, with glow */}
        <div className="relative mb-8">
          {/* Glow behind portrait */}
          <div
            className="absolute inset-0 rounded-full blur-3xl transition-colors duration-1000"
            style={{ background: active.bgGlow, transform: "scale(1.5)" }}
          />

          {/* Portrait */}
          <div
            className="relative w-36 h-36 md:w-48 md:h-48 rounded-3xl overflow-hidden border-2 transition-all duration-700"
            style={{ borderColor: `${active.color}40` }}
          >
            {CHARACTERS.map((char, i) => (
              <div
                key={char.id}
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: i === activeIndex ? 1 : 0 }}
              >
                <Image
                  src={char.portrait}
                  alt={char.name}
                  fill
                  className="object-cover"
                  sizes="192px"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Name + Role */}
        <div className="text-center mb-2 min-h-[4.5rem]">
          <h3
            className="text-2xl md:text-3xl font-bold mb-1 transition-colors duration-500"
            style={{ color: active.color }}
          >
            {active.name}
          </h3>
          <p className="text-white/50 text-sm font-medium">{active.role}</p>
          <p className="text-white/40 text-sm mt-2 max-w-xs mx-auto">{active.desc}</p>
        </div>

        {/* Character dots / selector */}
        <div className="flex items-center gap-3 mt-6 mb-6">
          {CHARACTERS.map((char, i) => (
            <button
              key={char.id}
              onClick={() => handleCharacterClick(i)}
              className="relative group"
              aria-label={`${char.name} anzeigen`}
            >
              {/* Mini portrait circle */}
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 transition-all duration-300 ${
                  i === activeIndex
                    ? "scale-110 shadow-lg"
                    : "opacity-50 hover:opacity-80 scale-90"
                }`}
                style={{
                  borderColor: i === activeIndex ? char.color : "rgba(255,255,255,0.1)",
                  boxShadow: i === activeIndex ? `0 0 20px ${char.color}30` : "none",
                }}
              >
                <Image
                  src={char.portrait}
                  alt={char.name}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              </div>

              {/* Name tooltip */}
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {char.name}
              </span>
            </button>
          ))}
        </div>

        {/* Play demo button */}
        <button
          onClick={handlePlayDemo}
          className="mt-2 flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 text-sm font-medium"
          style={{
            background: isPlaying
              ? `linear-gradient(135deg, ${active.color}30, ${active.color}15)`
              : "rgba(255,255,255,0.07)",
            border: `1px solid ${isPlaying ? `${active.color}50` : "rgba(255,255,255,0.1)"}`,
            color: isPlaying ? active.color : "rgba(255,255,255,0.6)",
          }}
        >
          {isPlaying ? (
            <>
              <div className="flex gap-[2px] items-end h-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-[2.5px] rounded-full animate-eq"
                    style={{
                      backgroundColor: active.color,
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </div>
              Hörprobe läuft...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {hasInteracted ? "Weiter anhören" : "Hörprobe abspielen"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
