function createTranscriptionEngine({ whisperCpp, fallback, preferWhisperCpp = true, logger = console } = {}) {
  let fallbackForced = false;
  async function transcribe(float32, language, profile) {
    if (preferWhisperCpp && !fallbackForced && whisperCpp && whisperCpp.isAvailable()) {
      try {
        return await whisperCpp.transcribe(float32, language, profile);
      } catch (error) {
        fallbackForced = true;
        logger.warn?.("whisper.cpp failed; falling back to transformers.js for this session:", error);
      }
    }
    return fallback.transcribe(float32, language, profile);
  }
  return { transcribe };
}

module.exports = { createTranscriptionEngine };
