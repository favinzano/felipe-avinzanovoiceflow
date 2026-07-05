// A bare <canvas> defaults to a 300x150 backing buffer regardless of its CSS
// display size; without sizing it to its actual layout box first, bars draw
// into that buffer and get stretched/squished instead of being responsive.
export function sizeCanvasToClientBounds(canvasElement) {
  canvasElement.width = Math.max(1, canvasElement.clientWidth);
  canvasElement.height = Math.max(1, canvasElement.clientHeight);
}

const BAR_WIDTH = 4;
const BAR_GAP = 2;
// Fully rounded (stadium/pill) ends on every bar -- at rest a bar is exactly
// BAR_WIDTH tall, so this radius turns it into a perfect dot, matching the
// reference captures where quiet bars read as a row of dots, not tombstones.
const BAR_RADIUS = BAR_WIDTH / 2;

// Exponential smoothing factor blended in per frame: 1 would snap instantly
// to the raw analyser reading (the old behavior, visibly jittery since
// getByteFrequencyData changes every ~16ms); this keeps bars gliding between
// samples instead of jumping.
const SMOOTHING = 0.35;

// One smoothed-amplitude buffer per canvas, so the main window and the
// overlay -- two independent canvases sharing this module -- each ease
// toward their own target values instead of fighting over shared state.
const smoothedAmplitudesByCanvas = new WeakMap();

function smoothedAmplitudesFor(canvasElement, barCount) {
  let smoothed = smoothedAmplitudesByCanvas.get(canvasElement);
  if (!smoothed || smoothed.length !== barCount) {
    smoothed = new Float32Array(barCount);
    smoothedAmplitudesByCanvas.set(canvasElement, smoothed);
  }
  return smoothed;
}

// Fallbacks match the exact values confirmed in styles.css (--blue,
// --blue-light) -- used only if a document has no such custom property
// defined, which should not happen once both index.html and overlay.html
// declare them.
const FALLBACK_BLUE = "#2c5f8a";
const FALLBACK_BLUE_LIGHT = "#83a9c8";

const colorCacheByDocument = new WeakMap();

// Reads --blue / --blue-light from the page's own stylesheet rather than
// hardcoding a second copy of the palette here, so this stays a single
// source of truth with styles.css/overlay.css. Cached per document since
// getComputedStyle is only worth paying for once, not every frame.
function resolvePaletteColors(canvasElement) {
  const doc = canvasElement.ownerDocument;
  const cached = colorCacheByDocument.get(doc);
  if (cached) return cached;

  const rootStyles = getComputedStyle(doc.documentElement);
  const blue = rootStyles.getPropertyValue("--blue").trim() || FALLBACK_BLUE;
  const blueLight = rootStyles.getPropertyValue("--blue-light").trim() || FALLBACK_BLUE_LIGHT;
  const colors = { blue: hexToRgb(blue), blueLight: hexToRgb(blueLight) };
  colorCacheByDocument.set(doc, colors);
  return colors;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const expanded = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = parseInt(expanded, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

// --blue is the resting/base tone; --blue-light only takes over as a bar's
// own amplitude climbs (peak intensity), giving the equalizer depth without
// ever reaching for --copper, which is reserved for active-recording state.
function barColor(blue, blueLight, t) {
  const r = Math.round(blue.r + (blueLight.r - blue.r) * t);
  const g = Math.round(blue.g + (blueLight.g - blue.g) * t);
  const b = Math.round(blue.b + (blueLight.b - blue.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// Pure render step: draws one frame of fixed-width, evenly-spaced "disco"
// frequency bars from a Uint8Array of the same shape getByteFrequencyData
// produces. Shared by the live AnalyserNode loop below (main window) and the
// overlay, which has no microphone access of its own and only ever receives
// this same shaped data forwarded over IPC -- one drawing routine keeps both
// canvases visually identical.
export function drawFrequencyBars(canvasElement, dataArray) {
  const ctx = canvasElement.getContext("2d");
  const width = canvasElement.width;
  const height = canvasElement.height;
  ctx.clearRect(0, 0, width, height);

  const { blue, blueLight } = resolvePaletteColors(canvasElement);
  const step = BAR_WIDTH + BAR_GAP;
  const barCount = Math.max(1, Math.floor(width / step));
  const samplesPerBar = Math.max(1, Math.floor(dataArray.length / barCount));
  const smoothed = smoothedAmplitudesFor(canvasElement, barCount);

  for (let i = 0; i < barCount; i += 1) {
    const start = i * samplesPerBar;
    let sum = 0;
    for (let j = 0; j < samplesPerBar; j += 1) sum += dataArray[start + j] || 0;
    const target = sum / samplesPerBar / 255;
    smoothed[i] += (target - smoothed[i]) * SMOOTHING;

    // Centered on the track's vertical midline (not bottom-anchored) so bars
    // grow symmetrically up and down, exactly like the reference captures.
    const barHeight = Math.max(BAR_WIDTH, smoothed[i] * height);
    const x = i * step;
    const y = (height - barHeight) / 2;

    ctx.fillStyle = barColor(blue, blueLight, smoothed[i]);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_RADIUS);
    else ctx.rect(x, y, BAR_WIDTH, barHeight);
    ctx.fill();
  }
}

export function clearVisualizer(canvasElement) {
  const ctx = canvasElement.getContext("2d");
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  smoothedAmplitudesByCanvas.delete(canvasElement);
}

export function initializeVisualizer(canvasElement, audioContext, sourceNode, options = {}) {
  const { onFrequencyData, frequencyDataIntervalMs = 50 } = options;
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  sourceNode.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  sizeCanvasToClientBounds(canvasElement);

  let rafId = null;
  let lastSentAt = 0;

  function draw(now) {
    rafId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    drawFrequencyBars(canvasElement, dataArray);

    // Forwarding a fresh IPC message every rAF frame (~60Hz) would flood the
    // main process; a fellow renderer only needs enough samples to look
    // continuous, not every frame.
    if (onFrequencyData && now - lastSentAt >= frequencyDataIntervalMs) {
      lastSentAt = now;
      onFrequencyData(dataArray);
    }
  }

  rafId = requestAnimationFrame(draw);

  return function stopVisualizer() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    analyser.disconnect();
    clearVisualizer(canvasElement);
  };
}
