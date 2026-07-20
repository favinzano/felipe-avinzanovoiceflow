// Electron's transparent + initially-hidden BrowserWindow can re-run this
// classic script a second time in the same document/global scope once
// showInactive() first paints it (observed via a top-level `const`
// redeclaration SyntaxError on the second pass). Scoping everything inside
// this guarded block means a spurious second run is a harmless no-op
// instead of a crash that leaves the overlay permanently unwired.
if (!window.__voiceflowOverlayInitialized) {
  window.__voiceflowOverlayInitialized = true;

  const overlay = document.querySelector("#overlay");
  const signal = document.querySelector("#signal");
  const message = document.querySelector("#message");
  const timer = document.querySelector("#timer");
  const overlayFallbackAPI = Object.freeze({
    brand: Object.freeze({
      displayName: "felipe avinzano VoiceFlow",
      baseName: "felipe avinzano Voice",
      suffix: "Flow",
      copper: "#B87333"
    }),
    onState: () => {},
    onAudioData: () => {}
  });
  const overlayAPI = window.overlayAPI || overlayFallbackAPI;
  const brand = overlayAPI.brand;

  function applyBrand(brand) {
    document.title = brand.displayName;
    document.querySelectorAll("[data-brand-base]").forEach((target) => {
      target.textContent = brand.baseName;
    });
    document.querySelectorAll("[data-brand-suffix]").forEach((target) => {
      target.textContent = brand.suffix;
    });
    document.querySelectorAll("[data-brand-label]").forEach((target) => {
      const labelSuffix = target.getAttribute("data-brand-label-suffix") || "";
      target.setAttribute("aria-label", `${brand.displayName}${labelSuffix}`);
    });
  }

  applyBrand(brand);

  // The overlay runs in its own Electron renderer process, separate from the
  // main window that owns the actual microphone. Rather than opening a
  // second, independent capture here, the main window's AnalyserNode data is
  // forwarded over IPC (see audio-data-update in main.cjs/renderer.js) and
  // this only ever draws it -- no audio APIs are initialized in this process.
  let drawFrequencyBars;
  let clearVisualizer;
  let visualizerModulePromise;
  let latestFrequencyData = null;
  let rafId = null;

  function loadVisualizerModule() {
    visualizerModulePromise ??= import("./src/audio-visualizer.js").then((module) => {
      drawFrequencyBars = module.drawFrequencyBars;
      clearVisualizer = module.clearVisualizer;
      module.sizeCanvasToClientBounds(signal);
    });
    return visualizerModulePromise;
  }

  // Redraws every animation frame from whatever data last arrived over IPC,
  // instead of only redrawing when a message shows up (~20-30Hz). Decoupling
  // the paint cadence from the IPC cadence is what makes the overlay feel
  // instantaneous: a new sample updates the target and the very next frame
  // already reflects it, with drawFrequencyBars' own smoothing easing the
  // motion in between.
  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop);
    if (overlay.dataset.status === "recording" && drawFrequencyBars && latestFrequencyData) {
      drawFrequencyBars(signal, latestFrequencyData);
    }
  }

  function startRenderLoop() {
    if (rafId === null) rafId = requestAnimationFrame(renderLoop);
  }

  overlayAPI.onState((state) => {
    overlay.dataset.status = state.status;
    message.textContent = state.message || "";
    timer.textContent = state.timer || "";
    if (state.status === "recording") loadVisualizerModule().then(startRenderLoop);
    else clearVisualizer?.(signal);
  });

  overlayAPI.onAudioData((frequencyData) => {
    latestFrequencyData = Uint8Array.from(frequencyData);
  });
}
