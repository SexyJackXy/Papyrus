// server.js
var express = require('express')
var path = require('path')
var fs = require('fs')
var bcrypt = require('bcrypt')
var session = require('express-session')
var SQLiteStore = require('connect-sqlite3')(session)
var { extractShiftFromPdf } = require('./scripts/pdfExtractor')
var { getUserByUsername, getNamesForUser, createUser, addNameToUser } = require('./db')

var app = express()
var SETTINGS_PATH = path.join(__dirname, 'globalVariables', 'settings.json')
var MULTI_ROLES = ['Frei', 'Used']
var IGNORE_ROLES = ['Wäsche', 'Getränke', 'ZAW', 'ZSW', 'KFZ', 'Abrufschicht', 'Kantine2', 'Kantine1']

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
    req.path.startsWith('/views/styles/') ||
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
    var nochVorhanden = MULTI_ROLES.includes(cur.role)
      ? data.some(item => item.role === cur.role && item.name === cur.name)
      : data.some(item => item.role === cur.role)

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
      if (i !== -1) merged.splice(i, 1)
    }
  }


  return { neu, geaendert, geloescht,curData }
}


app.use(express.json({ limit: '25mb' })) // PDFs kommen als Base64 → können groß werden

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
    secret: process.env.SESSION_SECRET || 'bitte-in-produktion-aendern',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 12 // 12 Stunden
      // secure: true, // aktivieren, sobald der Server über HTTPS läuft
    }
  })
)

// Zugriffsschutz: alles außer Login-Seite + zugehörige statische Assets
// erfordert eine eingeloggte Session.
app.use((req, res, next) => {
  if (
    isPublicRequest(req) ||
    req.path.startsWith('/api/login') ||
    (req.method === 'POST' && req.path === '/api/create-user') ||
    (req.method === 'POST' && req.path === '/api/save-schedule') ||
    (req.method === 'POST' && req.path === '/api/save-temporary-schedule') ||
    (req.method === 'GET' && req.path === '/api/latest-activity-schedule') ||
    (req.method === 'GET' && req.path === '/api/latest-schedule') ||
    (req.method === 'GET' && req.path === '/api/latest-temporary-schedule') ||
    (req.method === 'GET' && req.path === '/api/import-not-working-persons') ||
    (req.method === 'GET' && req.path === '/api/settings')
  ) {
    return next()
  }

  // War bisher komplett vergessen: eingeloggte Sessions einfach durchlassen.
  if (req.session && req.session.userId) {
    return next()
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: 'Nicht eingeloggt' })
  }
  return res.redirect('/views/login.html')
})

app.use(express.static(__dirname)) // liefert views/, scripts/, img/, styles/ aus

app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/views/index.html')
  }
  return res.redirect('/views/dashboard.html')
})

app.post('/api/login', async (req, res) => {
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

app.post('/api/create-user', async (req, res) => {
  try {
    var { username, password, } = req.body || {}

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Benutzername, Passwort sind erforderlich'
      })
    }

    if (getUserByUsername(username)) {
      return res.status(409).json({ success: false, error: 'Benutzername existiert bereits' })
    }

    var passwordHash = await bcrypt.hash(password, 12)
    var userId = createUser(username, passwordHash)

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

    var now = new Date()
    var dd = String(now.getDate()).padStart(2, '0')
    var MM = String(now.getMonth() + 1).padStart(2, '0')
    var yyyy = now.getFullYear()
    var baseName = `current`

    let fileName = `${baseName}.json`
    let counter = 1
    while (fs.existsSync(path.join(outputDir, fileName))) {
      fileName = `${baseName} (${counter}).json`
      counter++
    }

    var filePath = path.join(outputDir, fileName)
    fs.writeFileSync(filePath, JSON.stringify(shiftJson, null, 2), 'utf-8')

    // Importierte Einteilung wird zugleich der neue "aktuelle Stand",
    // den alle Geräte über /api/latest-schedule bekommen.
    fs.writeFileSync(
      path.join(outputDir, 'current.json'),
      JSON.stringify(shiftJson, null, 2),
      'utf-8'
    )

    res.json({ success: true, filePath, data: shiftJson })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
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

    let merged = data
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
      return res
        .status(400)
        .json({ success: false, error: 'data muss ein Array sein' })
    }

    var dir = path.join(__dirname, 'dailySchedule')
    let merged = data
    var currentFile = path.join(dir, 'current.json')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
      fs.writeFileSync(
        path.join(dir, 'current.json'),
        JSON.stringify(data, null, 2),
        'utf-8'
      )
    }
    else {
      var currentdata = JSON.parse(fs.readFileSync(currentFile, 'utf-8'))
      var newData = checkActivitys(currentdata, data).curData

    fs.writeFileSync(currentFile, JSON.stringify(newData, null, 2), 'utf-8')
    res.json({ success: true })
    }
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
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(req.body, null, 2), 'utf-8')
  res.json({ success: true })
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
