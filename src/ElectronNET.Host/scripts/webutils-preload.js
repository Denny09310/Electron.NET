// Framework preload script: exposes a minimal API needed by renderer pages that
// context isolation (and Electron itself) otherwise keeps out of the page's reach.
//
// webUtils.getPathForFile() must run in the preload context: the method exists
// only for preload scripts (see https://www.electronjs.org/docs/latest/api/web-utils
// - "If you want to call this API from a renderer process with context isolation
// enabled, place the API call in your preload script"). It is what replaced the
// removed File.path augmentation, so drag&drop handlers in the page call
// window.electronNET.getPathForFile(file) to obtain the filesystem path.
//
// Exposed is nothing else than the returned path string, so this stays safe to
// load into every framework-created window.
let api;
try {
  const { webUtils } = require("electron");
  api = {
    getPathForFile(file) {
      return webUtils.getPathForFile(file);
    },
  };
} catch (error) {
  console.error("Electron.NET webUtils preload not available:", error);
  return;
}

if (process.contextIsolated) {
  const { contextBridge } = require("electron");
  contextBridge.exposeInMainWorld("electronNET", api);
} else {
  // context isolation disabled: the preload and the page share the same window
  window.electronNET = api;
}
