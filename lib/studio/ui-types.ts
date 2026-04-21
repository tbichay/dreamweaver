/**
 * Shared UI type definitions for Studio components.
 * ONE place for types used across engine/page.tsx, library/page.tsx, etc.
 */

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost?: boolean;
}

export interface CharacterSheet {
  front?: string;
  profile?: string;
  fullBody?: string;
}

export interface DigitalActor {
  id: string;
  name: string;
  description?: string;
  voiceDescription?: string;
  voiceId?: string;
  voiceSettings?: VoiceSettings | null;
  voicePreviewUrl?: string;
  portraitAssetId?: string;
  style?: string;
  outfit?: string;
  traits?: string;
  characterSheet?: CharacterSheet | null;
  tags: string[];
  createdAt?: string;
  libraryVoiceId?: string;
  libraryVoice?: { name: string };
  // Unification-Bridge (Phase 2): gesetzt wenn DigitalActor bereits in den
  // Unified `Actor`-Pool gespiegelt wurde. Library-UI nutzt das fuer einen
  // "Neu editieren via /studio/shows/actors/[actorId]"-Link.
  actorId?: string | null;
  _count?: { characters: number };
}
