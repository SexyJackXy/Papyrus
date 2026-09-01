var { app, BrowserWindow, ipcMain, dialog } = require("electron");
var path = require("path");
var fs = require("fs");
var { runBuild } = require("./scripts/build");
var SETTINGS_PATH = path.join(__dirname, "globalVariables", "settings.json");

function createWindow() {
  var win = new BrowserWindow({
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
//   var { filePath, canceled } = await dialog.showSaveDialog({
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

var { extractShiftFromPdf } = require("./scripts/pdfExtractor");

ipcMain.handle("extract-and-save", async (event, base64) => {
  var buffer = Buffer.from(base64, "base64");
  var shiftJson = await extractShiftFromPdf(buffer);

  var outputDir = path.join(__dirname, "structuredSeating");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  var now = new Date();
  var dd = String(now.getDate()).padStart(2, "0");
  var MM = String(now.getMonth() + 1).padStart(2, "0");
  var yyyy = now.getFullYear();
  var baseName = `Einteilung_${dd}${MM}${yyyy}`;

  // Eindeutigen Dateinamen finden
  var fileName = `${baseName}.json`;
  var counter = 1;
  while (fs.existsSync(path.join(outputDir, fileName))) {
    fileName = `${baseName} (${counter}).json`;
    counter++;
  }

  var filePath = path.join(outputDir, fileName);
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
  var raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
  return JSON.parse(raw);
});