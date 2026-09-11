// pdfExtractor.js
// Ausgelagerte Logik: PDF lesen → Array extrahieren → JSON parsen
// Wird vom Renderer-Script aufgerufen

var pdfParse = require("pdf-parse-fork");
var { parseShiftArray } = require("./parseShift");

var reservedNames = [
  "ALvD", "DD", "LD 1", "LD2", "HLD", "EAL", "BvD", "LFüGr",
  "Schichtführer", "1. Dispo", "2. Dispo", "3. Dispo", "ELW", "FüAss",
  "Schw.Retter", "LF 1 Fü", "LF 1 Ma", "LF 1 ATF", "LF 1 ATM",
  "LF 1 WTF", "LF 1 WTM", "LF 2 Fü", "LF 2 Ma", "LF 2 ATF",
  "LF 2 ATM", "LF 2 WTF", "LF 2 WTM", "DLK1 Fü", "DLK1 Ma",
  "SoFzg Fü", "SoFzg Ma", "KEF Fü", "KEF Ma", "Fwk Fü", "Fwk Ma",
  "Kantine", "Wäsche", "Getränke", "ZAW", "ZSW", "Abrufschicht", "Frei"
];

/**
 * Liest eine PDF-Datei als Buffer und gibt das befüllte Template zurück.
 * @param {Buffer} fileBuffer - Inhalt der PDF-Datei als Buffer
 * @returns {Promise<object[]>} - Befülltes Template-Array
 */
async function extractShiftFromPdf(fileBuffer) {
  var result = await pdfParse(fileBuffer);
  var extractedText = result.text;

  var regex = new RegExp(
    `(${reservedNames.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g"
  );

  var formattedText = extractedText.replace(regex, "\n$1\n");

  var lines = [];
  for (var rawLine of formattedText.split("\n")) {
    if (rawLine === "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
      continue;
    }

    var trimmed = rawLine.trim();

    // Reserved Names bleiben unangetastet
    if (reservedNames.includes(trimmed)) {
      lines.push(rawLine);
      continue;
    }

    // Schritt 2: nur bei "normalen" Zeilen an Klein→Groß-Übergängen splitten
    var subLines = rawLine
      .replace(/([a-zäöüß])(?=[A-ZÄÖÜ])/g, "$1\n")
      .split("\n");

    for (var sub of subLines) {
      if (sub.length > 0) {
        lines.push(sub);
      }
    }
  };

  return parseShiftArray(lines);
}

module.exports = { extractShiftFromPdf };