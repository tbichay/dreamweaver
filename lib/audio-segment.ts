/**
 * KoalaTree Audio Segmentation
 *
 * Proper MP3 segmentation by parsing frame headers instead of
 * blindly slicing at byte offsets. MP3 frames have variable sizes,
 * so byte-offset slicing corrupts the audio.
 *
 * MP3 frame structure:
 * - Sync word: 0xFFE0 (11 bits of 1s)
 * - Each frame has a header (4 bytes) that encodes bitrate, sample rate, padding
 * - Frame size = 144 * bitrate / sampleRate + padding
 * - Each frame represents a fixed duration: 1152 samples / sampleRate seconds
 */

interface Mp3Frame {
  offset: number;      // byte offset in buffer
  size: number;        // frame size in bytes
  timeMs: number;      // start time in milliseconds
  durationMs: number;  // frame duration in milliseconds
}

// MPEG1 Layer III bitrate table (kbps), index by 4-bit value
const BITRATE_TABLE = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];

// MPEG1 sample rate table (Hz), index by 2-bit value
const SAMPLERATE_TABLE = [44100, 48000, 32000, 0];

// Samples per frame for MPEG1 Layer III
const SAMPLES_PER_FRAME = 1152;

/**
 * Parse MP3 frame headers to build a frame index.
 * This allows accurate time-based segmentation.
 */
function parseFrames(buffer: Buffer): Mp3Frame[] {
  const frames: Mp3Frame[] = [];
  let offset = 0;
  let timeMs = 0;

  // Skip ID3v2 tag if present
  if (buffer.length > 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const tagSize = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
    offset = tagSize + 10;
  }

  while (offset < buffer.length - 4) {
    // Look for sync word: 0xFF followed by 0xE0+ (11 bits of 1s)
    if (buffer[offset] !== 0xFF || (buffer[offset + 1] & 0xE0) !== 0xE0) {
      offset++;
      continue;
    }

    const header = buffer.readUInt32BE(offset);

    // Parse header fields
    const version = (header >> 19) & 0x03;  // 00=2.5, 01=reserved, 10=2, 11=1
    const layer = (header >> 17) & 0x03;     // 01=III, 10=II, 11=I
    const bitrateIdx = (header >> 12) & 0x0F;
    const sampleRateIdx = (header >> 10) & 0x03;
    const padding = (header >> 9) & 0x01;

    // We only handle MPEG1 Layer III (most common for speech)
    if (version !== 3 || layer !== 1) {
      // Try MPEG2/2.5 Layer III as well
      if (layer === 1 && (version === 2 || version === 0)) {
        // MPEG2/2.5 — different bitrate/samplerate tables, simpler handling
        // For now, use a heuristic: skip this frame and try next byte
        offset++;
        continue;
      }
      offset++;
      continue;
    }

    const bitrate = BITRATE_TABLE[bitrateIdx];
    const sampleRate = SAMPLERATE_TABLE[sampleRateIdx];

    if (bitrate === 0 || sampleRate === 0) {
      offset++;
      continue;
    }

    // Frame size in bytes
    const frameSize = Math.floor((SAMPLES_PER_FRAME * bitrate * 1000) / (8 * sampleRate)) + padding;
    const frameDuration = (SAMPLES_PER_FRAME / sampleRate) * 1000;

    if (frameSize < 4 || offset + frameSize > buffer.length) {
      offset++;
      continue;
    }

    frames.push({
      offset,
      size: frameSize,
      timeMs,
      durationMs: frameDuration,
    });

    timeMs += frameDuration;
    offset += frameSize;
  }

  return frames;
}

/**
 * Extract a time-range segment from an MP3 buffer.
 * Cuts at frame boundaries to avoid corruption.
 *
 * @param mp3Buffer - Full MP3 audio buffer
 * @param startMs - Start time in milliseconds
 * @param endMs - End time in milliseconds
 * @returns Buffer containing valid MP3 frames covering the requested range
 */
export function segmentMp3(mp3Buffer: Buffer, startMs: number, endMs: number): Buffer {
  const frames = parseFrames(mp3Buffer);

  if (frames.length === 0) {
    console.warn("[Audio] No MP3 frames found, falling back to byte-offset slicing");
    // Fallback to old behavior
    const bytesPerMs = 16;
    const startByte = Math.max(0, Math.floor(startMs * bytesPerMs));
    const endByte = Math.min(mp3Buffer.byteLength, Math.ceil(endMs * bytesPerMs));
    return Buffer.from(mp3Buffer.subarray(startByte, endByte));
  }

  // Find first frame that starts at or after startMs (with small tolerance)
  const startFrame = frames.findIndex((f) => f.timeMs + f.durationMs > startMs);
  // Find last frame that starts before endMs
  const endFrame = frames.findIndex((f) => f.timeMs >= endMs);

  const firstIdx = Math.max(0, startFrame);
  const lastIdx = endFrame === -1 ? frames.length : endFrame;

  if (firstIdx >= lastIdx) {
    console.warn(`[Audio] Empty segment: ${startMs}ms-${endMs}ms (${frames.length} frames total, ${frames[frames.length - 1]?.timeMs.toFixed(0)}ms duration)`);
    return Buffer.alloc(0);
  }

  // Extract frame range
  const firstOffset = frames[firstIdx].offset;
  const lastFrame = frames[lastIdx - 1];
  const endOffset = lastFrame.offset + lastFrame.size;

  const segmentDuration = frames[lastIdx - 1].timeMs + frames[lastIdx - 1].durationMs - frames[firstIdx].timeMs;
  console.log(`[Audio] Segment ${startMs.toFixed(0)}ms-${endMs.toFixed(0)}ms: ${lastIdx - firstIdx} frames, ${segmentDuration.toFixed(0)}ms actual, ${(endOffset - firstOffset)} bytes`);

  return Buffer.from(mp3Buffer.subarray(firstOffset, endOffset));
}
