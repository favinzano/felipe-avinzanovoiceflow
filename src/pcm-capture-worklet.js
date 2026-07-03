class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.offset = 0;
    this.levelSamples = 0;
    this.levelEnergy = 0;
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
    for (const sample of input) this.levelEnergy += sample * sample;
    this.levelSamples += input.length;
    if (this.levelSamples >= sampleRate / 10) {
      this.port.postMessage({
        type: "level",
        rms: Math.sqrt(this.levelEnergy / this.levelSamples)
      });
      this.levelSamples = 0;
      this.levelEnergy = 0;
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
