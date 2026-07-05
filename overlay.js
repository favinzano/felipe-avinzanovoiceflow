const overlay = document.querySelector("#overlay");
const signal = document.querySelector("#signal");
const message = document.querySelector("#message");
const timer = document.querySelector("#timer");
const waveform = new VoiceflowWaveform(signal, { color: "#b66d45", lineWidth: 2, baseline: 0.16 });
const overlayFallbackAPI = Object.freeze({
  brand: Object.freeze({
    displayName: "felipe avinzano VoiceFlow",
    baseName: "felipe avinzano Voice",
    suffix: "Flow",
    copper: "#B66D45"
  }),
  onState: () => {},
  onLevel: () => {}
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

overlayAPI.onState((state) => {
  overlay.dataset.status = state.status;
  message.textContent = state.message || "";
  timer.textContent = state.timer || "";
  if (state.status === "idle") waveform.hide();
  else waveform.setStatus(state.status);
});

overlayAPI.onLevel((amplitude) => {
  waveform.setAmplitude(Number(amplitude) || 0);
});
