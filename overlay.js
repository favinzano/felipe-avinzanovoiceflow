const overlay = document.querySelector("#overlay");
const signal = document.querySelector("#signal");
const message = document.querySelector("#message");
const timer = document.querySelector("#timer");
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
});

overlayAPI.onLevel((levels) => {
  if (!Array.isArray(levels) || levels.length !== signal.children.length) return;
  Array.from(signal.children).forEach((bar, index) => {
    const level = Math.max(0, Math.min(1, Number(levels[index]) || 0));
    bar.style.transform = `scaleY(${(0.17 + level * 0.83).toFixed(3)})`;
  });
});
