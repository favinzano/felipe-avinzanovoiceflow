const { contextBridge, ipcRenderer } = require("electron");

function readEncodedArgument(prefix) {
  const argument = process.argv.filter((value) => value.startsWith(prefix)).at(-1);
  if (!argument) throw new Error(`Missing required preload argument: ${prefix}`);
  return decodeURIComponent(argument.slice(prefix.length));
}

const rendererBrand = Object.freeze({
  displayName: readEncodedArgument("--voiceflow-brand-display-name="),
  baseName: readEncodedArgument("--voiceflow-brand-base-name="),
  suffix: readEncodedArgument("--voiceflow-brand-suffix="),
  copper: readEncodedArgument("--voiceflow-brand-copper=")
});

contextBridge.exposeInMainWorld("overlayAPI", {
  brand: rendererBrand,
  onState: (callback) => ipcRenderer.on("overlay:state", (_event, state) => callback(state)),
  onLevel: (callback) => ipcRenderer.on("overlay:level", (_event, level) => callback(level))
});
