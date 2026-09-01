var { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  runBuild: () => ipcRenderer.invoke("run-build"),
  // saveJson: (jsonString) => ipcRenderer.invoke("save-json", jsonString),
  extractAndSave: (base64) => ipcRenderer.invoke("extract-and-save", base64),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  exportNotWorkingPerson: (data) => ipcRenderer.invoke("export-not-working-person", data),
});