const { contextBridge, ipcRenderer } = require("electron");
const brand = require("./brand-config.cjs");

const rendererBrand = Object.freeze({
  displayName: brand.displayName,
  baseName: brand.baseName,
  suffix: brand.suffix,
  copper: brand.copper
});

contextBridge.exposeInMainWorld("overlayAPI", {
  brand: rendererBrand,
  onState: (callback) => ipcRenderer.on("overlay:state", (_event, state) => callback(state))
});
