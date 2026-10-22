const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronApp", {
  version: "1.1.1",
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_, version) => cb(version)),
  onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", () => cb()),
  installUpdate: () => ipcRenderer.send("install-update"),
});
