// server.js
require('dotenv').config()

var express = require('express')
var path = require('path')
var fs = require('fs')
var bcrypt = require('bcrypt')
var session = require('express-session')
var SQLiteStore = require('connect-sqlite3')(session)
var { extractShiftFromPdf } = require('./public/scripts/pdfExtractor')
var { getUserByUsername, getNamesForUser, createUser, addNameToUser } = require('./db')

var app = express()
var SETTINGS_PATH = path.join(__dirname, 'public', 'globalVariables', 'settings.json')
var MULTI_ROLES = ['Frei', 'Used']
var IGNORE_ROLES = ['Wäsche', 'Getränke', 'ZAW', 'ZSW', 'KFZ', 'Abrufschicht', 'Kantine2', 'Kantine1','BvD','Schichtführer']
var UPCOMMING_PLANS_DIR = path.join(__dirname, 'data', 'upcomming-plans')
if (!fs.existsSync(UPCOMMING_PLANS_DIR)) {
  fs.mkdirSync(UPCOMMING_PLANS_DIR, { recursive: true })
}
var MONATE = "januar,februar,märz,april,mai,juni,juli,august,september,oktober,november,dezember".split(",")
// Seiten, die ohne Login erreichbar sein müssen (Login-Seite + ihre Assets).
var PUBLIC_PATHS = new Set([
  '/',
  '/views/dashboard.html',
  '/views/login.html',
  '/views/alternativPlanes/activityPlan.html',
  '/views/alternativPlanes/temporaryPlan.html'
])

function isPublicRequest(req) {
  if (PUBLIC_PATHS.has(req.path)) return true
  // Statische Assets (CSS, Bilder, Client-Scripts) müssen immer ladbar sein,
  // sonst kann die Login-Seite selbst nicht gerendert werden.
  if (
    req.path.startsWith('/styles/') ||
    req.path.startsWith('/img/') ||
    req.path.startsWith('/scripts/')
  ) {
    return true
  }
  return false
}

function findMatch(list, item) {
  return MULTI_ROLES.includes(item.role)
    ? list.findIndex(x => x.role === item.role && x.name === item.name)
    : list.findIndex(x => x.role === item.role)
}

function diffSchedule(currentdata, data) {
  var merged = [...currentdata]
  var neu = [], geaendert = [], geloescht = []

  for (var item of data) {
    var idx = findMatch(merged, item)
    if (idx === -1) {
      neu.push(item)
      merged.push(item)
    } else if (JSON.stringify(merged[idx]) !== JSON.stringify(item)) {
      geaendert.push({ vorher: merged[idx], nachher: item })
      merged[idx] = item
    }
  }

  for (var cur of currentdata) {
    if (IGNORE_ROLES.includes(cur.role)) continue
    var nochVorhanden
    if (MULTI_ROLES.includes(cur.role)) {
      nochVorhanden = data.some(item => item.role === cur.role && item.name === cur.name)
    }
    else {
      nochVorhanden = data.some(item => item.role === cur.role)
    }

    if (!nochVorhanden) {
      geloescht.push(cur)
      var i = merged.findIndex(m => JSON.stringify(m) === JSON.stringify(cur))
      if (i !== -1) merged.splice(i, 1)
    }
  }

  return { merged, neu, geaendert, geloescht }
}

function checkActivitys(currentdata, data) {
  var curData = [...currentdata]
  var neu = [], geaendert = [], geloescht = []

  var roles = []

  data.forEach(data => {
    roles.push(data.role)
  })

  var curDataRoles = curData.filter(item => roles.includes(item.role));

  for (var item of data) {
    var idx = findMatch(curData, item)
    if (idx === -1) {
      neu.push(item)
      curData.push(item)
    } else if (JSON.stringify(curData[idx]) !== JSON.stringify(item)) {
      geaendert.push({ vorher: curData[idx], nachher: item })
      curData[idx] = item
    }
  }

  for (var cur of curDataRoles) {
    if (!IGNORE_ROLES.includes(cur.role)) continue
    var nochVorhanden = MULTI_ROLES.includes(cur.role)
      ? data.some(item => item.role === cur.role && item.name === cur.name)
      : data.some(item => item.role === cur.role)

    if (!nochVorhanden) {
      geloescht.push(cur)
      var i = curData.findIndex(m => JSON.stringify(m) === JSON.stringify(cur))
      if (i !== -1) curData.splice(i, 1) // ✅ korrekt: curData
    }
  }


  return { neu, geaendert, geloescht, curData }
}

function dateFromName(name) {
  var [, d, m, y] = name.match(/(\d+)\.\s*(\S+)\s*(\d+)/)
  return new Date(y, MONATE.indexOf(m.toLowerCase()), d)
}

app.use(express.json({ limit: '25mb' })) // PDFs kommen als Base64 → können groß werden

if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET ist nicht gesetzt. Server wird nicht gestartet.')
  process.exit(1)
}

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12
    }
  })
)

var PUBLIC_GET_APIS = new Set([
  '/api/latest-activity-schedule',
  '/api/latest-schedule',
  '/api/latest-temporary-schedule',
  '/api/settings',
  '/api/load-upcoming-plans'
])

app.use((req, res, next) => {
  if (
    isPublicRequest(req) ||
    req.path.startsWith('/api/login') ||
    (req.path === '/api/create-user' && req.method === 'POST') ||
    (req.method === 'GET' && PUBLIC_GET_APIS.has(req.path))
  ) {
    return next()
  }
  if (req.session && req.session.userId) {
    return next()
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: 'Nicht eingeloggt' })
  }
  return res.redirect('/views/login.html')
})

app.use(express.static(path.join(__dirname, 'public')))
app.use('/upcoming-plans', express.static(UPCOMMING_PLANS_DIR))

app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/views/index.html')
  }
  return res.redirect('/views/dashboard.html')
})

var rateLimit = require('express-rate-limit')

var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10, // max. 10 Versuche pro IP
  message: { success: false, error: 'Zu viele Login-Versuche, bitte später erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false
})

var createUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // max. 5 Registrierungen pro IP
  message: { success: false, error: 'Zu viele Registrierungen, bitte später erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false
})

app.post('/api/login', loginLimiter, async (req, res) => {
  var { username, password } = req.body || {}

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, error: 'Benutzername und Passwort erforderlich' })
  }

  var user = getUserByUsername(username)
  if (!user) {
    return res
      .status(401)
      .json({ success: false, error: 'Benutzername oder Passwort falsch' })
  }

  var ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    return res
      .status(401)
      .json({ success: false, error: 'Benutzername oder Passwort falsch' })
  }

  req.session.userId = user.id
  req.session.username = user.username

  res.json({ success: true, redirect: '/views/index.html' })
})

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid')
    res.json({ success: true, redirect: '/views/login.html' })
  })
})

app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false })
  }
  var names = getNamesForUser(req.session.userId)
  res.json({ success: true, username: req.session.username, names })
})

app.post('/api/create-user', createUserLimiter, async (req, res) => {
  try {
    var { username, password, names } = req.body || {}

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Benutzername, Passwort sind erforderlich' })
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Passwort muss mindestens 8 Zeichen lang sein' })
    }
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Ungültiger Benutzername' })
    }
    if (getUserByUsername(username)) {
      return res.status(409).json({ success: false, error: 'Benutzername existiert bereits' })
    }

    var passwordHash = await bcrypt.hash(password, 12)
    var userId = createUser(username, passwordHash)

    names.forEach(({ firstName, lastName }) => {
      if (firstName && lastName) addNameToUser(userId, firstName, lastName)
    })

    res.json({ success: true, userId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/extract-and-save', async (req, res) => {
  try {
    var { base64 } = req.body
    var buffer = Buffer.from(base64, 'base64')
    var shiftJson = await extractShiftFromPdf(buffer)

    var outputDir = path.join(__dirname, 'dailySchedule')
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

    var archiveDir = path.join(outputDir, 'archive')
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir)

    // Historie: ein Snapshot pro Import, sauber mit Zeitstempel
    var stamp = new Date().toISOString().replace(/[:.]/g, '-')
    fs.writeFileSync(
      path.join(archiveDir, `${stamp}.json`),
      JSON.stringify(shiftJson, null, 2),
      'utf-8'
    )

    // Aktueller Stand
    fs.writeFileSync(
      path.join(outputDir, 'current.json'),
      JSON.stringify(shiftJson, null, 2),
      'utf-8'
    )

    res.json({ success: true, data: shiftJson })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/save-upcoming-plans', async (req, res) => {
  try {
    var { base, filename } = req.body
    var buffer = Buffer.from(base, 'base64')
    var content = await extractShiftFromPdf(buffer)
    var upcomming_Date;

    content.forEach(({ role, name }) => {
      if (!name) return

      if (role === 'Date') {
        upcomming_Date = name.trimStart()
        return
      }
    })

    var safeName = upcomming_Date + '.pdf'
    var savePath = path.join(UPCOMMING_PLANS_DIR, safeName)
    fs.writeFileSync(savePath, buffer)

    res.json({ success: true, data: content, filename, savedAs: safeName })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/load-upcoming-plans', (req, res) => {
  if (!fs.existsSync(UPCOMMING_PLANS_DIR)) {
    return res.json({ success: true, data: null })
  }

  var files = fs
    .readdirSync(UPCOMMING_PLANS_DIR)
    .filter(f => f.endsWith('.pdf'))
    .sort((a, b) => dateFromName(b) - dateFromName(a))
    .map(name => ({ name, path: `/upcoming-plans/${encodeURIComponent(name)}` })) // NEU: URL statt Serverpfad

  if (!files.length) {
    return res.json({ success: true, data: null })
  }

  return res.json({ success: true, data: files })
})

app.post('/api/reset-schedule', (req, res) => {
  try {
    var dir = path.join(__dirname, 'dailySchedule')
    var notWorkingPeople = path.join(
      __dirname,
      'exportedPersons',
      `exportedPersons.json`
    )
    if (!fs.existsSync(dir)) {
      return res.json({ success: true })
    }

    if (fs.existsSync(notWorkingPeople)) {
      fs.rmSync(notWorkingPeople)
    }

    var archiveDir = path.join(dir, 'archive')
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir)

    var files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    var stamp = Date.now()

    files.forEach(f => {
      fs.renameSync(path.join(dir, f), path.join(archiveDir, `${stamp}_${f}`))
    })

    res.json({ success: true, archived: files.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/save-schedule', (req, res) => {
  try {
    var { data } = req.body || {}
    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, error: 'data muss ein Array sein' })
    }

    var dir = path.join(__dirname, 'dailySchedule')
    var currentFile = path.join(dir, 'current.json')

    var merged = data
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    } else if (fs.existsSync(currentFile)) {
      var currentdata = JSON.parse(fs.readFileSync(currentFile, 'utf-8'))
      merged = diffSchedule(currentdata, data).merged
    }

    fs.writeFileSync(currentFile, JSON.stringify(merged, null, 2), 'utf-8')
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/save-activity-schedule', (req, res) => {
  try {
    var { data } = req.body || {}
    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, error: 'data muss ein Array sein' })
    }

    var dir = path.join(__dirname, 'dailySchedule')
    var currentFile = path.join(dir, 'current.json')

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
      fs.writeFileSync(currentFile, JSON.stringify(data, null, 2), 'utf-8')
      return res.json({ success: true }) // ✅ ergänzt
    }

    var currentdata = JSON.parse(fs.readFileSync(currentFile, 'utf-8'))
    var newData = checkActivitys(currentdata, data).curData
    fs.writeFileSync(currentFile, JSON.stringify(newData, null, 2), 'utf-8')
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/delete-schedule-entry', (req, res) => {
  try {
    var { department, name } = req.body || {}
    var dir = path.join(__dirname, 'exportedPersons')
    var currentFile = path.join(dir, 'exportedPersons.json')

    if (!fs.existsSync(currentFile)) {
      return res.json({ success: true })
    }

    var currentData = JSON.parse(fs.readFileSync(currentFile, 'utf-8'))
    var filtered = currentData.filter(item => !(item.department === department && item.name === name))

    fs.writeFileSync(currentFile, JSON.stringify(filtered, null, 2), 'utf-8')
    res.json({ success: true, removed: currentData.length !== filtered.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/reset-temporary-schedule', (req, res) => {
  try {
    var dir = path.join(__dirname, 'temporarySchedule')
    if (!fs.existsSync(dir)) {
      return res.json({ success: true })
    }

    var archiveDir = path.join(dir, 'archive')
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir)

    var files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    var stamp = Date.now()

    files.forEach(f => {
      fs.renameSync(path.join(dir, f), path.join(archiveDir, `${stamp}_${f}`))
    })

    res.json({ success: true, archived: files.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/save-temporary-schedule', (req, res) => {
  try {
    var { data } = req.body || {}
    if (!Array.isArray(data)) {
      return res
        .status(400)
        .json({ success: false, error: 'data muss ein Array sein' })
    }

    var dir = path.join(__dirname, 'temporarySchedule')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir)

    fs.writeFileSync(
      path.join(dir, 'current.json'),
      JSON.stringify(data, null, 2),
      'utf-8'
    )

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/latest-schedule', (req, res) => {
  try {
    var dir = path.join(__dirname, 'dailySchedule')
    if (!fs.existsSync(dir)) {
      return res.json({ success: true, data: null })
    }

    var files = fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        var full = path.join(dir, f)
        return { name: f, mtime: fs.statSync(full).mtimeMs }
      })

    if (!files.length) {
      return res.json({ success: true, data: null })
    }

    var latest = files[0]
    var data = JSON.parse(
      fs.readFileSync(path.join(dir, latest.name), 'utf-8')
    )

    res.json({ success: true, fileName: latest.name, data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/latest-temporary-schedule', (req, res) => {
  try {
    var dir = path.join(__dirname, 'temporarySchedule')
    var currentFile = path.join(__dirname, 'temporarySchedule', 'current.json')
    if (!fs.existsSync(currentFile)) {
      var fixSchedule = path.join(__dirname, 'dailySchedule')

      if (!fs.existsSync(fixSchedule)) {
        console.warn('There is now File odr directory "', fixSchedule, '"')
        return res.json({ success: true, data: null })
      }
      else {
        var files = fs
          .readdirSync(fixSchedule)
          .filter(f => f.endsWith('.json'))
          .map(f => {
            var full = path.join(fixSchedule)
            return { name: f, mtime: fs.statSync(full).mtimeMs }
          })
          .sort((a, b) => b.mtime - a.mtime)

        if (!files.length) {
          return res.json({ success: true, data: null })
        }

        var fixedLatest = files[0]
        var fixedData = JSON.parse(
          fs.readFileSync(path.join(fixSchedule, fixedLatest.name), 'utf-8')
        )

        return res.json({ success: true, fileName: fixedLatest.name, fixedData })
      }

    }

    var files = fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        var full = path.join(dir, f)
        return { name: f, mtime: fs.statSync(full).mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)

    if (!files.length) {
      return res.json({ success: true, data: null })
    }

    var latest = files[0]
    var data = JSON.parse(
      fs.readFileSync(path.join(dir, latest.name), 'utf-8')
    )

    res.json({ success: true, fileName: latest.name, data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/settings', (req, res) => {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(req.body, null, 2), 'utf-8')
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/settings', (req, res) => {
  if (!fs.existsSync(SETTINGS_PATH)) return res.json({})
  res.json(JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')))
})

app.post('/api/export-not-working-person', (req, res) => {
  var data = req.body

  var outputDir = path.join(__dirname, 'exportedPersons')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  var filePath = path.join(outputDir, `exportedPersons.json`)
  if (fs.existsSync(filePath)) {
    fs.readFile(filePath, 'utf-8', function (err, fileData) {
      if (err) {
        console.error('Konnte Datei nicht lesen:', err)
        return
      }

      var json = JSON.parse(fileData)
      json.push(data)

      fs.writeFile(filePath, JSON.stringify(json, null, 2), 'utf-8', err => {
        if (err) console.error('Konnte Datei nicht schreiben:', err)
      })
    })
  } else {
    fs.writeFileSync(filePath, JSON.stringify([data], null, 2), 'utf-8')
  }

  res.json({ success: true, filePath })
})

app.get('/api/import-not-working-persons', (req, res) => {
  var filePath = path.join(
    __dirname,
    'exportedPersons',
    'exportedPersons.json'
  )

  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') return res.json([])
      return res.status(500).json({ success: false, error: 'Lesefehler' })
    }

    res.json(JSON.parse(data))
  })
})

var PORT = process.env.PORT || 3000
app.listen(PORT, '127.0.0.1', () =>
  console.log(`Server läuft auf Port ${PORT}`)
)
