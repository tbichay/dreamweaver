/**
 * Transition type configuration — ONE place for labels, icons, colors.
 */

export interface TransitionConfig {
  id: string;
  label: string;
  icon: string;
  stripeA: string;
  stripeB: string;
  border: string;
  text: string;
}

export const TRANSITIONS: Record<string, TransitionConfig> = {
  seamless: { id: "seamless", label: "Nahtlos", icon: "\u2197", stripeA: "rgba(34,197,94,0.06)", stripeB: "rgba(34,197,94,0.18)", border: "border-green-500/25", text: "text-green-300/70" },
  "match-cut": { id: "match-cut", label: "Kamera-Schnitt", icon: "\u2194", stripeA: "rgba(249,115,22,0.06)", stripeB: "rgba(249,115,22,0.18)", border: "border-orange-500/25", text: "text-orange-300/70" },
  "hard-cut": { id: "hard-cut", label: "Harter Schnitt", icon: "\u2702", stripeA: "rgba(239,68,68,0.06)", stripeB: "rgba(239,68,68,0.18)", border: "border-red-500/25", text: "text-red-300/70" },
  "fade-to-black": { id: "fade-to-black", label: "Schwarzblende", icon: "\u25FC", stripeA: "rgba(255,255,255,0.02)", stripeB: "rgba(255,255,255,0.08)", border: "border-white/15", text: "text-white/50" },
};

export const TRANSITION_OPTIONS = Object.values(TRANSITIONS);

/** Get label for a transition type */
export function getTransitionLabel(id: string): string {
  return TRANSITIONS[id]?.label || id;
}
