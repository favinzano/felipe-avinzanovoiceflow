function resampleAudio(input, inputRate, outputRate = 16000) {
  if (inputRate === outputRate) return new Float32Array(input);
  const ratio = inputRate / outputRate;
  const output = new Float32Array(Math.round(input.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const blend = position - left;
    output[index] = input[left] * (1 - blend) + input[right] * blend;
  }
  return output;
}

function trimEdgeSilence(samples, sampleRate = 16000, threshold = 0.003, paddingSeconds = 0.25) {
  const windowSize = Math.round(sampleRate * 0.02);
  const padding = Math.round(sampleRate * paddingSeconds);
  let firstSpeech = 0;
  let lastSpeech = samples.length;
  let detectedSpeech = false;

  for (let start = 0; start < samples.length; start += windowSize) {
    const end = Math.min(samples.length, start + windowSize);
    let energy = 0;
    for (let index = start; index < end; index += 1) energy += samples[index] * samples[index];
    if (Math.sqrt(energy / Math.max(1, end - start)) >= threshold) {
      firstSpeech = Math.max(0, start - padding);
      detectedSpeech = true;
      break;
    }
  }
  if (!detectedSpeech) return new Float32Array(samples);

  for (let end = samples.length; end > 0; end -= windowSize) {
    const start = Math.max(0, end - windowSize);
    let energy = 0;
    for (let index = start; index < end; index += 1) energy += samples[index] * samples[index];
    if (Math.sqrt(energy / Math.max(1, end - start)) >= threshold) {
      lastSpeech = Math.min(samples.length, end + padding);
      break;
    }
  }
  return samples.slice(firstSpeech, lastSpeech);
}

module.exports = { resampleAudio, trimEdgeSilence };
