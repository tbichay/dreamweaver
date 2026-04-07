/**
 * KoalaTree Video Mastering
 *
 * Post-processing step after all scene clips are generated:
 * 1. Normalize audio levels (-16 LUFS broadcast standard)
 * 2. Apply color grading (warm KoalaTree palette)
 * 3. Add crossfade transitions between clips
 * 4. Add intro title card + outro
 * 5. Mix in background music
 * 6. Final render to MP4
 *
 * Note: ffmpeg is required. On Vercel (no ffmpeg), this runs
 * as a post-processing step via local script or cloud service.
 * The pipeline stores individual clips; mastering assembles them.
 */

// --- Mastering Config ---

export interface MasteringConfig {
  /** Intro title text */
  introTitle?: string;
  /** Intro subtitle */
  introSubtitle?: string;
  /** Duration of intro card in seconds */
  introDuration?: number;
  /** Duration of outro card in seconds */
  outroDuration?: number;
  /** Crossfade duration between clips in seconds */
  crossfadeDuration?: number;
  /** Background music volume (0.0 - 1.0, relative to speech) */
  musicVolume?: number;
  /** Color temperature adjustment (-1.0 cold to 1.0 warm) */
  warmth?: number;
  /** Target audio loudness in LUFS */
  targetLUFS?: number;
}

export const DEFAULT_MASTERING: MasteringConfig = {
  introTitle: "KoalaTree",
  introSubtitle: "präsentiert",
  introDuration: 3,
  outroDuration: 4,
  crossfadeDuration: 0.5,
  musicVolume: 0.08,
  warmth: 0.3,
  targetLUFS: -16,
};

// --- ffmpeg Command Builders ---

/**
 * Build ffmpeg command to normalize audio to target LUFS
 */
export function buildAudioNormalizeCommand(input: string, output: string, targetLUFS = -16): string {
  return `ffmpeg -y -i "${input}" -af "loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11" -c:v copy "${output}"`;
}

/**
 * Build ffmpeg command for color grading (warm KoalaTree look)
 */
export function buildColorGradeCommand(input: string, output: string, warmth = 0.3): string {
  // Warm color grade: slightly increase red/yellow, decrease blue
  const tempShift = Math.round(warmth * 1000); // colortemperature filter
  return `ffmpeg -y -i "${input}" -vf "colortemperature=${6500 + tempShift},eq=brightness=0.02:saturation=1.1" -c:a copy "${output}"`;
}

/**
 * Build ffmpeg concat command with crossfade transitions
 */
export function buildConcatWithCrossfadeCommand(
  inputs: string[],
  output: string,
  crossfade = 0.5
): string {
  if (inputs.length === 0) throw new Error("No inputs");
  if (inputs.length === 1) return `ffmpeg -y -i "${inputs[0]}" -c copy "${output}"`;

  // For 2+ clips: use xfade filter
  const inputArgs = inputs.map((f) => `-i "${f}"`).join(" ");

  // Build xfade filter chain
  // [0][1]xfade=transition=fade:duration=0.5:offset=X[v01]
  // [v01][2]xfade=...
  const filterParts: string[] = [];
  let prevLabel = "0:v";

  for (let i = 1; i < inputs.length; i++) {
    const outLabel = i === inputs.length - 1 ? "[vout]" : `[v${i}]`;
    // offset = total duration of all previous clips minus crossfade overlap
    // We don't know durations here — caller must provide or we use a simpler approach
    filterParts.push(
      `[${prevLabel}][${i}:v]xfade=transition=fade:duration=${crossfade}:offset=OFFSET_${i}${outLabel}`
    );
    prevLabel = outLabel.replace("[", "").replace("]", "");
  }

  // For audio: concat all audio streams
  const audioFilter = inputs.map((_, i) => `[${i}:a]`).join("") +
    `concat=n=${inputs.length}:v=0:a=1[aout]`;

  // Note: OFFSET_X placeholders must be replaced by the caller with actual timestamps
  return `ffmpeg -y ${inputArgs} -filter_complex "${filterParts.join(";")};${audioFilter}" -map "[vout]" -map "[aout]" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k "${output}"`;
}

/**
 * Build simple concat (no transitions, just join clips)
 */
export function buildSimpleConcatCommand(
  inputs: string[],
  concatListPath: string,
  output: string
): string {
  return `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${output}"`;
}

/**
 * Build ffmpeg command to add background music under video
 */
export function buildAddMusicCommand(
  videoInput: string,
  musicInput: string,
  output: string,
  musicVolume = 0.08,
  fadeOutDuration = 3
): string {
  return `ffmpeg -y -i "${videoInput}" -i "${musicInput}" -filter_complex "[1:a]volume=${musicVolume},afade=t=out:st=MUSIC_FADEOUT:d=${fadeOutDuration}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "${output}"`;
}

/**
 * Build ffmpeg command to create a title card (solid color + text)
 */
export function buildTitleCardCommand(
  output: string,
  title: string,
  subtitle: string,
  duration = 3,
  width = 720,
  height = 1280
): string {
  // Create a dark green background with centered text
  return `ffmpeg -y -f lavfi -i "color=c=0x1a2e1a:s=${width}x${height}:d=${duration}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${duration} -vf "drawtext=text='${title}':fontsize=64:fontcolor=0xf5eed6:x=(w-text_w)/2:y=(h-text_h)/2-40:fontfile=/System/Library/Fonts/Helvetica.ttc,drawtext=text='${subtitle}':fontsize=28:fontcolor=0xa8d5b8:x=(w-text_w)/2:y=(h-text_h)/2+40:fontfile=/System/Library/Fonts/Helvetica.ttc" -c:v libx264 -preset fast -crf 18 -c:a aac -shortest "${output}"`;
}

/**
 * Build ffmpeg command to create outro card
 */
export function buildOutroCardCommand(
  output: string,
  duration = 4,
  width = 720,
  height = 1280
): string {
  return `ffmpeg -y -f lavfi -i "color=c=0x1a2e1a:s=${width}x${height}:d=${duration}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${duration} -vf "drawtext=text='Erstellt mit':fontsize=24:fontcolor=0xa8d5b880:x=(w-text_w)/2:y=(h-text_h)/2-30:fontfile=/System/Library/Fonts/Helvetica.ttc,drawtext=text='KoalaTree':fontsize=48:fontcolor=0xf5eed6:x=(w-text_w)/2:y=(h-text_h)/2+20:fontfile=/System/Library/Fonts/Helvetica.ttc" -c:v libx264 -preset fast -crf 18 -c:a aac -shortest "${output}"`;
}

// --- Mastering Pipeline ---

export interface MasteringStep {
  name: string;
  description: string;
}

export const MASTERING_STEPS: MasteringStep[] = [
  { name: "normalize", description: "Audio-Lautstärke normalisieren" },
  { name: "colorgrade", description: "Farbkorrektur (warme KoalaTree-Palette)" },
  { name: "intro", description: "Intro-Titelkarte erstellen" },
  { name: "outro", description: "Outro erstellen" },
  { name: "concat", description: "Szenen zusammenschneiden" },
  { name: "music", description: "Hintergrundmusik unterlegen" },
  { name: "final", description: "Finaler Export" },
];
