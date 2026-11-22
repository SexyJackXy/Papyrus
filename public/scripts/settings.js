; (function () {
  function getCheckboxes() {
    return {
      showWachabteilung: document.getElementById('showWachabteilung'),
      autoLoadTagdienst: document.getElementById('autoLoadTagdienst'),
      showArbeitsdienste: document.getElementById('showArbeitsdienste'),
      showDuty: document.getElementById('showDuty')
    }
  }

  async function loadSettings() {
    var settings = await fetch('/api/settings').then(r => r.json())
    var settingCheckboxes = getCheckboxes()

    Object.entries(settingCheckboxes).forEach(([key, el]) => {
      if (el) el.checked = !!settings[key]
    })

    return settings
  }

  async function saveSettings() {
    var settingCheckboxes = getCheckboxes()
    var settings = {}
    Object.entries(settingCheckboxes).forEach(([key, el]) => {
      settings[key] = el ? el.checked : false
    })

    var result = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).then(r => r.json())
    return result
  }

  async function initSettingsAdjustment() {
    // var settings = await fetch('/api/settings').then(r => r.json())
    // var showWachabteilung = settings.showWachabteilung
    // var dutyTakeout = settings.showDuty
    // var path = window.location.pathname
    // var pageName = path.split('/').pop()

    // if (dutyTakeout === true) {
    //   var showInnerTeamUsed = document.getElementById('teamUsed')
    //   var showteamFree = document.getElementById('teamFree')
    //   showInnerTeamUsed.style.display = 'block'
    //   if (pageName === 'index.html') {
    //     showteamFree.style.width = 'clamp(300px, 15vw, 1440px)'
    //   }
    //   else {
    //     showteamFree.style.width = 'clamp(300px, 45vw, 1440px)'
    //   }
    // }
    // else {
    //   var showteamFree = document.getElementById('teamFree')
    //   showteamFree.style.maxWidth = 'min(90vw, 2560px)'
    // }
    // if (showWachabteilung === true) {
    //   var showStation = document.getElementById('showStation')
    //   showStation.style.display = 'block'
    // }


    return settings
  }

  async function loadUpcomingPlans() {
    console.log('test')

    var list = document.getElementById('upcomingPlansList')
    if (!list) return
    list.innerHTML = ''

    var res = await fetch('/api/load-upcoming-plans').then(r => r.json())

    if (!res.data || res.data.length === 0) {
      var empty = document.createElement('li')
      empty.textContent = 'Keine Pläne vorhanden'
      list.appendChild(empty)
      return
    }

    res.data.forEach(name => {
      var li = document.createElement('li')
      var a = document.createElement('a')
      a.href = '/upcoming-plans/' + encodeURIComponent(name)
      a.target = '_blank'
      a.rel = 'noopener'
      a.textContent = name.replace(/\.pdf$/i, '')
      li.appendChild(a)
      list.appendChild(li)
    })
  }

  // ---------- PDF-Import (nur Settings-Seite) ----------
  function initPdfImport() {
    var inputPdf = document.getElementById('inputPdf')
    var btnUpload = document.getElementById('btnUpload')
    var pdfResult = document.getElementById('pdfResult')
    if (!inputPdf || !btnUpload) return

    inputPdf.addEventListener('change', async () => {
      var file = inputPdf.files[0]
      if (!file) return

      // Datei als Base64 lesen — kein Buffer/Node nötig
      var base = await new Promise((resolve, reject) => {
        var reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      await fetch('/api/save-upcoming-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base, filename: file.name })
      }).then(r => r.json())

      var result = await fetch('/api/extract-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: base })
      }).then(r => r.json())

      localStorage.setItem('dienste_csv', JSON.stringify(result.data))

      if (pdfResult) {
        pdfResult.textContent = 'Erfolgreich importiert'
        setTimeout(() => { pdfResult.textContent = '' }, 2000)
      }

      var p = btnUpload.querySelector('p')
      if (p) {
        var originalText = p.textContent
        p.textContent = 'Gespeichert!'
        setTimeout(() => { p.textContent = originalText }, 2000)
      }
    })

    btnUpload.addEventListener('click', () => inputPdf.click())
  }

  // ---------- Reset-Button (nur Settings-Seite) ----------
  function initReset() {
    var btnReset = document.getElementById('btnReset')
    var resetResult = document.getElementById('resetResult')
    if (!btnReset) return

    btnReset.addEventListener('click', async () => {
      var res = window.Dienste.clearCookies()
      var response = await fetch('/api/reset-schedule', { method: 'POST' })
      var responseTemp = await fetch('/api/reset-temporary-schedule', { method: 'POST' })

      if (!response.ok && !responseTemp.ok) {
        var body = await response.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${response.status}`)
      }

      if (resetResult) {
        resetResult.textContent = res
        setTimeout(() => { resetResult.textContent = '' }, 2000)
      }
    })
  }

  // ---------- Benutzer-Übersicht (braucht /api/users im Backend) ----------
  async function loadUsers() {
    var box = document.querySelector('.userOverview')
    if (!box) return

    try {
      var data = await fetch('/api/users').then(r => r.json())
      if (!data.success) return

      data.users.forEach(function (u) {
        var row = document.createElement('div')
        row.className ='userRow'
        var names = u.names.map(n => n.first_name + ' ' + n.last_name).join(', ')
        row.textContent = u.username + (names ? ' (' + names + ')' : '') + ' – Passwort: ••••••••  '

        var btn = document.createElement('button')
        btn.id = 'reset'
        btn.type = 'button'
        btn.textContent = 'Reset'
        btn.addEventListener('click', async function () {
          var pw = prompt('Neues Passwort für ' + u.username + ' (min. 8 Zeichen):')
          if (!pw) return
          var r = await fetch('/api/users/' + u.id + '/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
          })
          var d = await r.json()
          alert(d.success ? 'Passwort geändert' : d.error)
        })

        row.appendChild(btn)
        box.appendChild(row)
      })
    } catch (err) {
      console.error('Benutzer konnten nicht geladen werden:', err)
    }
  }

  function initSettingsPage() {
    loadSettings()

    var saveBtn = document.getElementById('Save')
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        var p = saveBtn.querySelector('p')
        var originalText = p ? p.textContent : null

        await saveSettings()

        if (p) {
          p.textContent = 'Gespeichert!'
          setTimeout(() => {
            p.textContent = originalText
          }, 2000)
        }
      })
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadUpcomingPlans()
    initPdfImport()
    initReset()
    loadUsers()
    if (document.getElementById('Save')) {
      initSettingsPage()
    }
  })

  window.DiensteSettings = {
    loadSettings,
    saveSettings,
    initSettingsAdjustment,
    loadUpcomingPlans
  }
})()