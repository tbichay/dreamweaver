"use client";

import Link from "next/link";

const PIPELINE_STEPS = [
  { icon: "✎", label: "Geschichte", desc: "Text, Upload oder AI" },
  { icon: "◧", label: "Drehbuch", desc: "Szenen & Regie" },
  { icon: "♫", label: "Audio", desc: "Stimmen & Sound" },
  { icon: "▶", label: "Film", desc: "Clips & Assembly" },
];

export default function EngineLandingPage() {
  return (
    <div style={{ background: "#141414", color: "#E8E8E8", minHeight: "100vh" }}>
      {/* Minimal Top Bar */}
      <div className="flex items-center justify-between px-6 h-12" style={{ borderBottom: "1px solid #1E1E1E" }}>
        <span className="text-sm tracking-wide" style={{ color: "#C8A97E" }}>koalatree.io</span>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-[11px] transition-colors" style={{ color: "#555" }}>
            Login
          </Link>
          <Link
            href="/sign-up"
            className="text-[11px] px-4 py-1.5 rounded-lg transition-all"
            style={{ border: "1px solid #C8A97E", color: "#C8A97E" }}
          >
            Registrieren
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <div className="mb-4">
          <span className="text-[11px] tracking-[0.2em] uppercase" style={{ color: "#555" }}>
            Story-to-Film Engine
          </span>
        </div>
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.1] mb-6"
          style={{ color: "#E8E8E8", letterSpacing: "-0.02em" }}
        >
          Verwandle jede
          <br />
          Geschichte in einen
          <br />
          <span style={{ color: "#C8A97E" }}>animierten Film.</span>
        </h1>
        <p className="text-base max-w-lg mb-10" style={{ color: "#8A8A8A", lineHeight: 1.7 }}>
          Von der Idee zum fertigen Film in Minuten.
          AI-generierte Geschichten, professionelle Sprachausgabe,
          cinematische Video-Clips — alles in einer Pipeline.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/studio/engine"
            className="px-6 py-2.5 rounded-lg text-sm tracking-wide transition-all hover:opacity-90"
            style={{ border: "1px solid #C8A97E", color: "#C8A97E" }}
          >
            Engine starten →
          </Link>
        </div>
      </div>

      {/* Pipeline */}
      <div className="max-w-4xl mx-auto px-6 py-16" style={{ borderTop: "1px solid #1E1E1E" }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={i} className="text-center">
              <div
                className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#1E1E1E", border: "1px solid #2A2A2A" }}
              >
                <span style={{ color: i === 3 ? "#C8A97E" : "#8A8A8A" }}>{step.icon}</span>
              </div>
              <p className="text-[11px] font-medium mb-0.5" style={{ color: "#E8E8E8" }}>{step.label}</p>
              <p className="text-[10px]" style={{ color: "#555" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-16" style={{ borderTop: "1px solid #1E1E1E" }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { title: "Jeder Style", desc: "2D Disney, 3D Pixar, Ghibli, Realistisch, Claymation — oder dein eigener Style. Die AI passt sich an." },
            { title: "Multi-Provider", desc: "Kling, Seedance, Veo, ElevenLabs — automatisch der beste Provider pro Szene. Kosten im Blick." },
            { title: "Volle Kontrolle", desc: "Clip fuer Clip generieren, vergleichen, ersetzen. Kostenvorschau vor jedem Schritt. Keine Ueberraschungen." },
          ].map((f, i) => (
            <div key={i}>
              <h3 className="text-sm font-medium mb-2" style={{ color: "#E8E8E8" }}>{f.title}</h3>
              <p className="text-[11px] leading-relaxed" style={{ color: "#555" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-6 py-8" style={{ borderTop: "1px solid #1E1E1E" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "#333" }}>koalatree.io</span>
          <div className="flex items-center gap-6">
            <Link href="/sign-in" className="text-[10px]" style={{ color: "#555" }}>Login</Link>
            <Link href="/sign-up" className="text-[10px]" style={{ color: "#555" }}>Registrieren</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
