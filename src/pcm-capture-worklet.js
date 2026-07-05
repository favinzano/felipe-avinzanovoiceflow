class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.offset = 0;
    this.levelSamples = 0;
    this.levelEnergy = 0;
    this.levelBars = new Float64Array(9);
    this.levelBarSamples = new Uint32Array(9);
    this.port.onmessage = (event) => {
      if (event.data === "flush") this.flush();
    };
  }

  flush() {
    if (!this.offset) return;
    const chunk = this.buffer.slice(0, this.offset);
    this.port.postMessage(chunk, [chunk.buffer]);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    // The overlay/waveform bars use an 80ms CSS transition per update; at the
    // prior 10Hz (100ms) cadence each transition finished before the next
    // update landed, so bars visibly stepped. 24Hz keeps several transitions
    // overlapping in flight for continuous-looking motion.
    const levelWindowSamples = Math.max(9, Math.round(sampleRate / 24));
    for (const sample of input) {
      const energy = sample * sample;
      const barIndex = Math.min(8, Math.floor(this.levelSamples * 9 / levelWindowSamples));
      this.levelEnergy += energy;
      this.levelBars[barIndex] += energy;
      this.levelBarSamples[barIndex] += 1;
      this.levelSamples += 1;
      if (this.levelSamples >= levelWindowSamples) {
        this.port.postMessage({
          type: "level",
          rms: Math.sqrt(this.levelEnergy / this.levelSamples),
          levels: Array.from(this.levelBars, (barEnergy, index) => (
            Math.sqrt(barEnergy / Math.max(1, this.levelBarSamples[index]))
          ))
        });
        this.levelSamples = 0;
        this.levelEnergy = 0;
        this.levelBars.fill(0);
        this.levelBarSamples.fill(0);
      }
    }
    let sourceOffset = 0;
    while (sourceOffset < input.length) {
      const length = Math.min(input.length - sourceOffset, this.buffer.length - this.offset);
      this.buffer.set(input.subarray(sourceOffset, sourceOffset + length), this.offset);
      this.offset += length;
      sourceOffset += length;
      if (this.offset === this.buffer.length) this.flush();
    }
    return true;
  }
}

registerProcessor("voiceflow-pcm-capture", PcmCaptureProcessor);
