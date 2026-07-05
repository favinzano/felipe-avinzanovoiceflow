function createVoiceActivityDetector(options = {}) {
  const minimumSpeechThreshold = options.speechThreshold ?? 0.008;
  const minimumSilenceThreshold = options.silenceThreshold ?? 0.004;
  const silenceTimeoutMs = options.silenceTimeoutMs ?? 1800;
  let noiseFloor = options.initialNoiseFloor ?? 0.001;
  let speechDetected = false;
  let silenceStartedAt;
  let lastNoiseFloorUpdateAt;
  let stopped = false;

  return {
    update(rms, now = Date.now()) {
      if (stopped) return false;
      const speechThreshold = Math.max(minimumSpeechThreshold, noiseFloor * 3);
      const silenceThreshold = Math.max(minimumSilenceThreshold, noiseFloor * 1.8);
      if (rms >= speechThreshold) {
        speechDetected = true;
        silenceStartedAt = undefined;
        return false;
      }
      if (!speechDetected) {
        // Scaled by elapsed time (not call count) so the noise-floor calibration
        // speed stays constant regardless of how often the caller samples rms
        // (e.g. the mic level worklet's update cadence).
        const elapsedMs = now - (lastNoiseFloorUpdateAt ?? now - 100);
        lastNoiseFloorUpdateAt = now;
        const alpha = 1 - Math.pow(0.9, elapsedMs / 100);
        noiseFloor = noiseFloor * (1 - alpha) + rms * alpha;
      }
      if (!speechDetected || rms > silenceThreshold) {
        silenceStartedAt = undefined;
        return false;
      }
      silenceStartedAt ??= now;
      if (now - silenceStartedAt < silenceTimeoutMs) return false;
      stopped = true;
      return true;
    }
  };
}

module.exports = { createVoiceActivityDetector };
