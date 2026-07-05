// Shared by index.html (via <script>, alongside the esbuild-bundled dist/renderer.js)
// and overlay.html (via <script>, alongside overlay.js). Loaded as a plain global —
// neither host uses ES modules for these files, so this intentionally has no
// import/export and attaches itself to `window`.
class VoiceflowWaveform {
  static STATUS_PRESETS = {
    recording: { mode: "live", color: "#b66d45" },
    processing: { mode: "pulse", color: "#83a9c8" },
    success: { mode: "success", color: "#f4f1eb" },
    error: { mode: "flat", color: "#d17d61" }
  };

  constructor(canvas, { color = "#b66d45", lineWidth = 2, baseline = 0.16 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.color = color;
    this.lineWidth = lineWidth;
    this.baseline = baseline;
    this.amplitude = 0;
    this.targetAmplitude = 0;
    this.alpha = 1;
    this.mode = "live";
    this.modeStartedAt = 0;
    this.phase1 = 0;
    this.phase2 = 0;
    this.phase3 = 0;
    this.visible = false;
    this.raf = null;
    this.lastTick = 0;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.width = 0;
    this.height = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.round(this.width * dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.visible) this.draw();
  }

  setColor(color) {
    this.color = color;
    if (this.visible && this.reduceMotion) this.draw();
  }

  setAmplitude(level) {
    if (this.mode !== "live") return;
    this.targetAmplitude = Math.max(0, Math.min(1, Number(level) || 0));
    if (this.reduceMotion) {
      this.amplitude = this.targetAmplitude;
      if (this.visible) this.draw();
    }
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.modeStartedAt = performance.now();
    if (mode === "success") this.successFrom = this.amplitude;
    if (mode === "success" || mode === "flat") this.targetAmplitude = this.baseline * 0.4;
    if (this.reduceMotion) {
      this.amplitude = this.targetAmplitude;
      if (this.visible) this.draw();
    }
  }

  setStatus(status) {
    const preset = VoiceflowWaveform.STATUS_PRESETS[status];
    if (!preset) {
      this.hide();
      return;
    }
    this.setColor(preset.color);
    this.setMode(preset.mode);
    this.show();
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.alpha = 1;
    this.lastTick = 0;
    if (this.reduceMotion) {
      this.draw();
      return;
    }
    this.loop(performance.now());
  }

  hide() {
    this.visible = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  loop(now) {
    if (!this.visible) return;
    this.step(now);
    this.draw();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  step(now) {
    const elapsed = this.lastTick ? now - this.lastTick : 0;
    this.lastTick = now;

    if (this.mode === "success") {
      const t = Math.min(1, (now - this.modeStartedAt) / 450);
      const eased = 1 - (1 - t) ** 3;
      this.amplitude = this.successFrom + (this.targetAmplitude - this.successFrom) * eased;
      this.alpha = 1 - eased * 0.65;
      return;
    }

    this.alpha = 1;
    if (this.mode === "pulse") {
      this.targetAmplitude = 0.24 + 0.16 * (0.5 + 0.5 * Math.sin(now / 380));
    }
    // Renderer-side code already EMA-smooths the raw rms before calling
    // setAmplitude(); this second stage only interpolates between those
    // ~42ms-spaced updates so the line doesn't visibly step. A short time
    // constant (previously 90ms, stacked on top of the renderer's own EMA)
    // made real voice onsets look laggy — most of a syllable's rise happened
    // before the line caught up.
    const responsiveness = 1 - Math.exp(-elapsed / 30);
    this.amplitude += (this.targetAmplitude - this.amplitude) * responsiveness;
    this.phase1 += elapsed * 0.0028;
    this.phase2 += elapsed * 0.0044;
    this.phase3 -= elapsed * 0.0021;
  }

  draw() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);
    if (!width || !height) return;

    const midY = height / 2;
    const amp = (this.baseline + this.amplitude * (1 - this.baseline)) * (height / 2);
    const count = this.reduceMotion ? 20 : 40;
    const points = [];
    // One dominant sine plus two light harmonics (was 0.55/0.3/0.15, near-even
    // weights that rarely crest together) so the curve reliably reaches close
    // to `amp` instead of averaging ~38% of it across random phase offsets.
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const x = t * width;
      const envelope = Math.sin(t * Math.PI);
      const y = this.reduceMotion
        ? midY - envelope * amp
        : midY
          + Math.sin(this.phase1 + t * 6.2) * amp * 0.78 * envelope
          + Math.sin(this.phase2 + t * 9.4) * amp * 0.15 * envelope
          + Math.sin(this.phase3 + t * 3.1) * amp * 0.07 * envelope;
      points.push({ x, y });
    }

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.reduceMotion ? 0 : 10 + this.amplitude * 10;

    const buildPath = () => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i += 1) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midPointY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midPointY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    };

    // Two extra soft, wide, low-alpha passes underneath build the glow halo;
    // the crisp top stroke keeps the line itself sharp instead of blurry.
    if (!this.reduceMotion) {
      ctx.globalAlpha = this.alpha * 0.35;
      ctx.lineWidth = this.lineWidth * 4;
      buildPath();
      ctx.stroke();
      ctx.globalAlpha = this.alpha * 0.55;
      ctx.lineWidth = this.lineWidth * 2;
      buildPath();
      ctx.stroke();
    }

    ctx.globalAlpha = this.alpha;
    ctx.lineWidth = this.lineWidth;
    ctx.shadowBlur = this.reduceMotion ? 0 : 6 + this.amplitude * 6;
    buildPath();
    ctx.stroke();
    ctx.restore();
  }
}

window.VoiceflowWaveform = VoiceflowWaveform;
