"use client";

import StoryVisualPlayer from "@/app/components/StoryVisualPlayer";

interface TimelineEntry {
  characterId: string;
  startMs: number;
  endMs: number;
}

interface Props {
  audioUrl: string;
  timeline: TimelineEntry[];
  title: string;
  knownDuration?: number;
}

export default function SharedStoryPlayer({ audioUrl, timeline, title, knownDuration }: Props) {
  return (
    <StoryVisualPlayer
      audioUrl={audioUrl}
      timeline={timeline}
      title={title}
      knownDuration={knownDuration}
    />
  );
}
