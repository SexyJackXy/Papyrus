// server.js
const express = require('express')
const path = require('path')
const fs = require('fs')
const bcrypt = require('bcrypt')
const session = require('express-session')
const SQLiteStore = require('connect-sqlite3')(session)
const { extractShiftFromPdf } = require('./scripts/pdfExtractor')
const { getUserByUsername, getNamesForUser, createUser, addNameToUser } = require('./db')

const app = express()
const SETTINGS_PATH = path.join(__dirname, 'globalVariables', 'settings.json')

// Seiten, die ohne Login erreichbar sein müssen (Login-Seite + ihre Assets).
const PUBLIC_PATHS = new Set([
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

function updateArray(currentdata, data) {
  data.forEach(item => {
    const index = currentdata.findIndex(
      cur => cur.role === item.role && cur.name === item.name
    );
    if (index === -1) {
      currentdata.push(item);
    } else {
      currentdata[index] = item;
    }
  });
  return currentdata;
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
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, error: 'Benutzername und Passwort erforderlich' })
  }

  const user = getUserByUsername(username)
  if (!user) {
    return res
      .status(401)
      .json({ success: false, error: 'Benutzername oder Passwort falsch' })
  }

  const ok = await bcrypt.compare(password, user.password_hash)
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
  const names = getNamesForUser(req.session.userId)
  res.json({ success: true, username: req.session.username, names })
})

app.post('/api/create-user', async (req, res) => {
  try {
    const { username, password, } = req.body || {}

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Benutzername, Passwort sind erforderlich'
      })
    }

    if (getUserByUsername(username)) {
      return res.status(409).json({ success: false, error: 'Benutzername existiert bereits' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const userId = createUser(username, passwordHash)

    res.json({ success: true, userId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/extract-and-save', async (req, res) => {
  try {
    const { base64 } = req.body
    const buffer = Buffer.from(base64, 'base64')
    const shiftJson = await extractShiftFromPdf(buffer)

    const outputDir = path.join(__dirname, 'dailySchedule')
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const MM = String(now.getMonth() + 1).padStart(2, '0')
    const yyyy = now.getFullYear()
    const baseName = `current`

    let fileName = `${baseName}.json`
    let counter = 1
    while (fs.existsSync(path.join(outputDir, fileName))) {
      fileName = `${baseName} (${counter}).json`
      counter++
    }

    const filePath = path.join(outputDir, fileName)
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
    const dir = path.join(__dirname, 'dailySchedule')
    const notWorkingPeople = path.join(
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

    const archiveDir = path.join(dir, 'archive')
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir)

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    const stamp = Date.now()

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
    const { data } = req.body || {}
    if (!Array.isArray(data)) {
      return res
        .status(400)
        .json({ success: false, error: 'data muss ein Array sein' })
    }

    const dir = path.join(__dirname, 'dailySchedule')
    if (!fs.existsSync(dir)) {

      fs.mkdirSync(dir)

      fs.writeFileSync(
        path.join(dir, 'current.json'),
        JSON.stringify(data, null, 2),
        'utf-8')
    }
    else {
      const savefiles = fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const full = path.join(dir, f)
          return { name: f, mtime: fs.statSync(full).mtimeMs }
        })
        .sort((a, b) => b.mtime - a.mtime)

      const latest = savefiles[0]
      const currentdata = JSON.parse(
        fs.readFileSync(path.join(dir, latest.name), 'utf-8')
      )
      
      const multiRoles = ['Frei', 'Used'];
      const neu = [];
      const geaendert = [];
      const geloescht = [];

      // Snapshot vom alten Stand, BEVOR currentdata verändert wird
      const alterStand = currentdata.map(x => ({ ...x }));

      data.forEach(item => {
        const index = multiRoles.includes(item.role)
          ? currentdata.findIndex(cur => cur.role === item.role && cur.name === item.name)
          : currentdata.findIndex(cur => cur.role === item.role);

        if (index === -1) {
          neu.push(item);
          currentdata.push(item);
        } else if (JSON.stringify(currentdata[index]) !== JSON.stringify(item)) {
          geaendert.push({ vorher: currentdata[index], nachher: item });
          currentdata[index] = item;
        }
      });

      // Einträge, die im alten Stand waren, aber in data fehlen -> gelöscht
      const ignoreRoles = ['Wäsche', 'Getränke', 'ZAW', 'ZSW', 'KFZ', 'Abrufschicht', 'Kantine2', 'Kantine1'];

      alterStand.forEach(cur => {
        if (ignoreRoles.includes(cur.role)) return; // diese Rollen nie als "gelöscht" werten

        const nochVorhanden = multiRoles.includes(cur.role)
          ? data.some(item => item.role === cur.role && item.name === cur.name)
          : data.some(item => item.role === cur.role);

        if (!nochVorhanden) {
          geloescht.push(cur);
          const idx = currentdata.findIndex(c => JSON.stringify(c) === JSON.stringify(cur));
          if (idx !== -1) currentdata.splice(idx, 1);
        }
      });

      fs.writeFileSync(
        path.join(dir, 'current.json'),
        JSON.stringify(currentdata, null, 2),
        'utf-8')
    }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/save-activity-schedule', (req, res) => {
  try {
    const { data } = req.body || {}
    if (!Array.isArray(data)) {
      return res
        .status(400)
        .json({ success: false, error: 'data muss ein Array sein' })
    }

    const dir = path.join(__dirname, 'activitySchedule')
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

app.post('/api/reset-temporary-schedule', (req, res) => {
  try {
    const dir = path.join(__dirname, 'temporarySchedule')
    if (!fs.existsSync(dir)) {
      return res.json({ success: true })
    }

    const archiveDir = path.join(dir, 'archive')
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir)

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    const stamp = Date.now()

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
    const { data } = req.body || {}
    if (!Array.isArray(data)) {
      return res
        .status(400)
        .json({ success: false, error: 'data muss ein Array sein' })
    }

    const dir = path.join(__dirname, 'temporarySchedule')
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
    const dir = path.join(__dirname, 'dailySchedule')
    if (!fs.existsSync(dir)) {
      return res.json({ success: true, data: null })
    }

    const files = fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const full = path.join(dir, f)
        return { name: f, mtime: fs.statSync(full).mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)

    if (!files.length) {
      return res.json({ success: true, data: null })
    }

    const latest = files[0]
    const data = JSON.parse(
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
    const dir = path.join(__dirname, 'temporarySchedule')
    const currentFile = path.join(__dirname, 'temporarySchedule', 'current.json')
    if (!fs.existsSync(currentFile)) {
      const fixSchedule = path.join(__dirname, 'dailySchedule')

      if (!fs.existsSync(fixSchedule)) {
        console.warn('There is now File odr directory "', fixSchedule, '"')
        return res.json({ success: true, data: null })
      }
      else {
        const files = fs
          .readdirSync(fixSchedule)
          .filter(f => f.endsWith('.json'))
          .map(f => {
            const full = path.join(fixSchedule)
            return { name: f, mtime: fs.statSync(full).mtimeMs }
          })
          .sort((a, b) => b.mtime - a.mtime)

        if (!files.length) {
          return res.json({ success: true, data: null })
        }

        const fixedLatest = files[0]
        const fixedData = JSON.parse(
          fs.readFileSync(path.join(fixSchedule, fixedLatest.name), 'utf-8')
        )

        return res.json({ success: true, fileName: fixedLatest.name, fixedData })
      }

    }

    const files = fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const full = path.join(dir, f)
        return { name: f, mtime: fs.statSync(full).mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)

    if (!files.length) {
      return res.json({ success: true, data: null })
    }

    const latest = files[0]
    const data = JSON.parse(
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
  const data = req.body

  const outputDir = path.join(__dirname, 'exportedPersons')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  const filePath = path.join(outputDir, `exportedPersons.json`)
  if (fs.existsSync(filePath)) {
    fs.readFile(filePath, 'utf-8', function (err, fileData) {
      if (err) {
        console.error('Konnte Datei nicht lesen:', err)
        return
      }

      const json = JSON.parse(fileData)
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
  const filePath = path.join(
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

const PORT = process.env.PORT || 3000
app.listen(PORT, '127.0.0.1', () =>
  console.log(`Server läuft auf Port ${PORT}`)
)
