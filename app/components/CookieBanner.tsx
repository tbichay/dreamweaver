"use client";

import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("koalatree-cookies-accepted");
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem("koalatree-cookies-accepted", "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a2e1a]/95 border-t border-white/10 px-6 py-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-white/70 text-sm text-center sm:text-left">
          Wir verwenden nur technisch notwendige Cookies für die Anmeldung.
        </p>
        <button
          onClick={handleAccept}
          className="btn-primary text-sm px-6 py-2 shrink-0"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
