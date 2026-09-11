// parseShift.js
// Wandelt das extrahierte PDF-Array in eine strukturierte JSON-Datei um

var fs = require('fs')
var path = require('path')

// Template laden
var template = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'globalVariables', 'template.json'), 'utf-8')
)

var nameBeforeRole = new Set([
  '1. Dispo',
  '2. Dispo',
  '3. Dispo',
  'LF 2 Fü',
  'FüAss',
  'LF 2 Ma',
  'Schw.Retter',
  'LF 2 ATF',
  'LF 1 Fü',
  'LF 2 ATM',
  'LF 1 Ma',
  'LF 2 WTF',
  'LF 1 ATF',
  'LF 2 WTM',
  'LF 1 ATM',
  'LF 1 WTF',
  'LF 1 WTM',
  'DLK1 Fü',
  'DLK1 Ma',
  'SoFzg Fü',
  'SoFzg Ma',
  'KEF Fü',
  'KEF Ma',
  'Fwk Fü',
  'Fwk Ma',
  'Frei'
])
var forbiddenLines = new Set([
  'Schichtführer',
  'Feuerwehr Heilbronn',
  'Diensteinteilung',
  'Wäsche',
  'Gäste',
  'ILS',
  'LF 2',
  'LF 1',
  'GW-Wasser',
  'DLK / RW',
  'Sonderfahrzeuge',
  'GW-G / WLF',
  'KEF',
  'GW-T (Unimog)',
  'Fw',
  'K / GW-Rüst',
  'Kantine',
  'ALvD',
  'LD 1',
  'LD 2',
  'HLD',
  'DD',
  'LFüGr',
  'EAL',
  'Abrufschicht',
  'ELW'
])
/**
 * Konvertiert das extrahierte Zeilen-Array in das Template-Format.
 * @param {string[]} lines - Das rohe Array aus der PDF-Extraktion
 * @returns {object[]} - Array mit { role, name } Objekten
 */
function parseShiftArray(lines) {
  var roleSet = new Set(template.map(t => t.role))

  lines.forEach(line => {
    line.replace(/(?<=[a-zäöüß])[A-ZÄÖÜ].*$/, '')
  })


  var nameOccurrences = {}
  lines.forEach((line, idx) => {
    var entry = line.trim()
    if (entry === '') return
    if (!nameOccurrences[entry]) nameOccurrences[entry] = []
    nameOccurrences[entry].push(idx)
  })

  var result = template.map(t => ({ role: t.role, name: '' }))
  var roleIndexTracker = {}
  result.forEach((item, idx) => {
    if (!roleIndexTracker[item.role]) roleIndexTracker[item.role] = []
    roleIndexTracker[item.role].push(idx)
  })
  var roleFillCount = {}

  let i = 0
  while (i < lines.length) {
    var entry = lines[i].trim()

    if (entry === 'Wäsche') {
      if (lines.length < 100) {
        var firstCafeteria = lines[i - 1].trim()
        var secondCafetaria = lines[i - 2].trim()

        result.push({ role: 'Kantine1', name: firstCafeteria })
        result.push({ role: 'Kantine2', name: secondCafetaria })

      } else {
        var firstCafeteria = lines[i - 1].trim()

        result.push({ role: 'Kantine2', name: firstCafeteria })

        Object.entries(nameOccurrences).forEach(([name, indices]) => {
          if (indices.length <= 1) return // nur Duplikate weiterverarbeiten

          if (nameBeforeRole.has(name)) {
            // ...
          } else if (forbiddenLines.has(name)) {
            // ...
          } else {
            var rollenProIndex = indices
              .map(idx => {
                // nächste nicht-leere Zeile darüber
                let j = idx - 1
                while (j >= 0 && lines[j].trim() === '') j--
                var above = j >= 0 ? lines[j].trim() : ''

                // nächste nicht-leere Zeile darunter
                let k = idx + 1
                while (k < lines.length && lines[k].trim() === '') k++
                var below = k < lines.length ? lines[k].trim() : ''

                var role = roleSet.has(above) ? above : (roleSet.has(below) ? below : null)
                return { idx, role }
              })
              .filter(eintrag => eintrag.role === null && eintrag.idx !== 0)

            if (rollenProIndex.length > 0) {

              result.push({ role: 'Kantine1', name: name })
            }
          }
        })
      }
    }

    if (roleSet.has(entry)) {
      var role = entry
      let name = ''

      if (nameBeforeRole.has(role)) {
        // Name rückwärts suchen — letzter nicht-leerer Eintrag vor dieser Rolle
        let j = i - 1
        while (j >= 0) {
          var prev = lines[j].trim()
          if (prev === '') {
            j--
            continue
          }
          if (roleSet.has(prev)) break // anderer Rollenname → kein Name
          name = prev
          lines[j] = '' // verbraucht markieren, damit er nicht doppelt genutzt wird
          break
        }
      } else {
        // Name vorwärts suchen
        let j = i + 1
        while (j < lines.length) {
          var next = lines[j].trim()
          if (next === '') {
            j++
            continue
          }
          if (roleSet.has(next)) break
          name = next
          i = j
          break
        }
      }

      var fillCount = roleFillCount[role] || 0
      var indices = roleIndexTracker[role] || []
      if (indices[fillCount] !== undefined) {
        result[indices[fillCount]].name = name
        roleFillCount[role] = fillCount + 1
      }
    }

    i++
  }

  var ld1Entry = result.find(r => r.role === 'LD 1')
  if (ld1Entry) {
    result.forEach(r => {
      if (r.role === 'ELW') {
        r.name = ld1Entry.name
      }
    })
  }

  var assignedNames = new Set(result.filter(r => r.name).map(r => r.name))

  var dateLineRegex =
    /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s*\d{1,2}\.\s*\w+\s*\d{4}$/

  var freiNames = new Set()
  lines.forEach(line => {
    var entry = line.trim()

    if (entry === '') return
    if (roleSet.has(entry)) return
    if (nameBeforeRole.has(entry)) return
    if (assignedNames.has(entry)) return
    if (freiNames.has(entry)) return
    if (forbiddenLines.has(entry)) return
    if (dateLineRegex.test(entry)) return

    freiNames.add(entry)
    result.push({ role: 'Frei', name: entry })
  })

  return result
}

module.exports = { parseShiftArray }
