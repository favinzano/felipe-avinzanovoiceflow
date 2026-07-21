function parseWhisperJson(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("invalid whisper json");
  }
  const segments = Array.isArray(parsed.transcription) ? parsed.transcription : [];
  const text = segments.map((s) => (s && typeof s.text === "string" ? s.text : "")).join("").trim();
  if (!text) throw new Error("empty whisper output");
  return { text };
}

module.exports = { parseWhisperJson };
