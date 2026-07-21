function createTranscriptionEngine({ whisperCpp, fallback, preferWhisperCpp = true, logger = console } = {}) {
  let fallbackForced = false;
  // `device` is threaded to the fallback so an explicit user inference-device
  // choice (e.g. the advanced-settings DirectML opt-in) is honored. The
  // whisper.cpp engine is CPU-only and ignores it.
  async function transcribe(float32, language, profile, device) {
    if (preferWhisperCpp && !fallbackForced && whisperCpp && whisperCpp.isAvailable()) {
      try {
        return await whisperCpp.transcribe(float32, language, profile);
      } catch (error) {
        fallbackForced = true;
        logger.warn?.("whisper.cpp failed; falling back to transformers.js for this session:", error);
      }
    }
    return fallback.transcribe(float32, language, profile, device);
  }
  return { transcribe };
}

module.exports = { createTranscriptionEngine };
