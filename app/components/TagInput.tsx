"use client";

/**
 * TagInput — free-string chips with optional autocomplete.
 *
 * Used wherever we need a `string[]` field that should grow organically
 * (Actor.expertise, Actor.catchphrases, later: FokusTemplate tags). Accepts
 * an optional `suggestions` list from the caller — matches are filtered as
 * the user types. Nothing stops the user from entering a brand-new tag,
 * the suggestions are guidance, not a whitelist.
 *
 * Keyboard:
 *   Enter / Comma → commit current draft as chip
 *   Backspace on empty input → remove last chip
 */

import { useMemo, useRef, useState } from "react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxChips?: number;
  allowDuplicates?: boolean;
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Tag eingeben…",
  maxChips,
  allowDuplicates = false,
}: Props) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const atCap = maxChips !== undefined && value.length >= maxChips;

  // Filter suggestions: case-insensitive contains, not already a chip.
  const filtered = useMemo(() => {
    const d = draft.trim().toLowerCase();
    if (!d) {
      return suggestions.filter((s) => !value.includes(s)).slice(0, 8);
    }
    return suggestions
      .filter((s) => s.toLowerCase().includes(d) && !value.includes(s))
      .slice(0, 8);
  }, [draft, suggestions, value]);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (atCap) return;
    if (!allowDuplicates && value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
    // Keep focus for fast entry
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function removeTag(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1.5 min-h-[40px] bg-[#1A1A1A] border border-white/10 rounded-lg px-2 py-1.5 focus-within:border-[#C8A97E]/50"
      >
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#C8A97E]/15 text-[#C8A97E] text-[11px]"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="text-[#C8A97E]/60 hover:text-[#C8A97E] -mr-0.5"
              aria-label={`${tag} entfernen`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Tiny delay so clicks on suggestions register before close.
            setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKey}
          placeholder={atCap ? "" : value.length === 0 ? placeholder : ""}
          disabled={atCap}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white/90 outline-none disabled:opacity-50"
        />
      </div>

      {open && filtered.length > 0 && !atCap && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-auto rounded-lg border border-white/10 bg-[#141414] shadow-lg">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // onMouseDown fires before onBlur, avoiding the race
                  e.preventDefault();
                  addTag(s);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
