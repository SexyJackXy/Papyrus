const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { runBuild } = require("./scripts/build");
const SETTINGS_PATH = path.join(__dirname, "globalVariables", "settings.json");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "scripts", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "views", "dashboard.html"));
}

ipcMain.handle("run-build", async () => {
  return runBuild();
});

// ipcMain.handle("save-json", async (event, jsonString) => {
//   const { filePath, canceled } = await dialog.showSaveDialog({
//     title: "Schicht speichern",
//     defaultPath: "schicht.json",
//     filters: [{ name: "JSON", extensions: ["json"] }],
//   });

//   if (canceled || !filePath) return { success: false };

//   fs.writeFileSync(filePath, jsonString, "utf-8");
//   return { success: true, filePath };
// });

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

const { extractShiftFromPdf } = require("./scripts/pdfExtractor");

ipcMain.handle("extract-and-save", async (event, base64) => {
  const buffer = Buffer.from(base64, "base64");
  const shiftJson = await extractShiftFromPdf(buffer);

  const outputDir = path.join(__dirname, "structuredSeating");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const baseName = `Einteilung_${dd}${MM}${yyyy}`;

  // Eindeutigen Dateinamen finden
  let fileName = `${baseName}.json`;
  let counter = 1;
  while (fs.existsSync(path.join(outputDir, fileName))) {
    fileName = `${baseName} (${counter}).json`;
    counter++;
  }

  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(shiftJson, null, 2), "utf-8");

  return { success: true, filePath };
});

ipcMain.handle("save-settings", async (event, settings) => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
  return { success: true };
});

ipcMain.handle("load-settings", async () => {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
  return JSON.parse(raw);
});