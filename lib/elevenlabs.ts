export async function generateAudio(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY nicht gesetzt");

  // Audio-Marker aus dem Text entfernen und in Pausen umwandeln
  const cleanedText = text
    .replace(/\[ATEMPAUSE\]/g, "... ... ...")
    .replace(/\[PAUSE\]/g, "... ...")
    .replace(/\[LANGSAM\]/g, "")
    .replace(/\[DANKBARKEIT\]/g, "")
    .replace(/\[KOALA\]/g, "");

  // Voice ID — wird später auf Koala-Stimme gesetzt
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  console.log(`[ElevenLabs] Generating audio: ${cleanedText.length} chars, voice: ${voiceId}`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: cleanedText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.80,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[ElevenLabs] API Error ${response.status}:`, errorBody);
    throw new Error(`ElevenLabs API Fehler: ${response.status} — ${errorBody}`);
  }

  const buffer = await response.arrayBuffer();
  console.log(`[ElevenLabs] Audio generated: ${buffer.byteLength} bytes`);
  return buffer;
}
