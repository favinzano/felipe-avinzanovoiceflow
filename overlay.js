const overlay = document.querySelector("#overlay");
const signal = document.querySelector("#signal");
const message = document.querySelector("#message");
const timer = document.querySelector("#timer");
const brand = window.overlayAPI.brand;

function applyBrand(brand) {
  document.title = brand.displayName;
  document.querySelectorAll("[data-brand-base]").forEach((target) => {
    target.textContent = brand.baseName;
  });
  document.querySelectorAll("[data-brand-suffix]").forEach((target) => {
    target.textContent = brand.suffix;
  });
}

applyBrand(brand);

for (let index = 0; index < 62; index += 1) {
  const bar = document.createElement("i");
  bar.style.setProperty("--delay", `${index * -0.028}s`);
  bar.style.setProperty("--height", `${3 + Math.random() * 15}px`);
  signal.appendChild(bar);
}

window.overlayAPI.onState((state) => {
  overlay.dataset.status = state.status;
  message.textContent = state.message || "";
  timer.textContent = state.timer || "";
});
