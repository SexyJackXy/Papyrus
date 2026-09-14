; (function () {
  var cookies = 'dienste_csv'
  var reservedNames = [
    'ALvD',
    'DD',
    'LD 2',
    'HLD',
    'EAL',
    'BvD',
    'LFüGr',
    'Schichtführer',
    'Frei',
    '1. Dispo',
    '2. Dispo',
    '3. Dispo',
    'LD 1',
    'FüAss',
    'LF 1 Fü',
    'LF 1 Ma',
    'LF 1 ATF',
    'LF 1 ATM',
    'LF 1 WTF',
    'LF 1 WTM',
    'LF 2 Fü',
    'LF 2 Ma',
    'LF 2 ATF',
    'LF 2 ATM',
    'LF 2 WTF',
    'LF 2 WTM',
    'LF 2 Ma',
    'Schw.Retter',
    'DLK1 Fü',
    'DLK1 Ma',
    'SoFzg Fü',
    'SoFzg Ma',
    'KEF Fü',
    'KEF Ma',
    'Fwk Fü',
    'Fwk Ma',
    'Maschinist',
    'Kantine',
    'Wäsche',
    'Getränke',
    'ZAW',
    'ZSW',
    'Abrufschicht',
    'KFZ',
    'Kleiderkammer',
    'Kantine1',
    'Kantine2'
  ]

  function captureDefaults() {
    document.querySelectorAll('.person').forEach(el => {
      el.dataset.default = el.textContent.trim()
    })
  }

  function readFromFile(file) {
    file.arrayBuffer().then(b => {
      var candidates = [
        new TextDecoder('utf-8').decode(b),
        new TextDecoder('windows-1252').decode(b),
        new TextDecoder('utf-16le').decode(b)
      ]

      var t = candidates[0],
        best = -1e9

      for (var c of candidates) {
        var sc = 0
        if (c.includes('{')) sc += 5
        if (c.includes(',')) sc += 2
        if (/[a-zA-Z]{3,}/.test(c)) sc += 5
        if (c.includes('�')) sc -= 10
        if (sc > best) (best = sc), (t = c)
      }

      if (t.charCodeAt(0) === 0xfeff) t = t.slice(1)

      var parsed = parseContent(t)

      localStorage.setItem(cookies, JSON.stringify(parsed))
    })

    return 'Datei ' + file.name + ' erfolgreich hochgeladen'
  }

  function parseContent(t) {
    if (!t) return []
    try {
      var data = JSON.parse(t)
      if (!Array.isArray(data)) return []

      return data
        .filter(e => e && typeof e.role === 'string')
        .map(e => ({ role: e.role.trim(), name: (e.name || '').trim() }))
    } catch (e) {
      console.error('Parse Error:', e)
      return []
    }
  }

  function getContent() {
    var raw = localStorage.getItem(cookies)
    return raw ? JSON.parse(raw) : []
  }

  async function loadContent() {
    var res
    var path = window.location.pathname
    var pageName = path.split('/').pop()

    try {
      if (pageName === 'index.html' || pageName === 'dasboard.html') {
        res = await fetch('/api/latest-schedule')
      } else if (pageName === 'temporaryPlan.html') {
        res = await fetch('/api/latest-temporary-schedule')
      } else if (pageName === 'activityPlan.html') {
        res = await fetch('/api/latest-schedule')
      }
      if (res && res.ok) {
        var json = await res.json()
        if (json.success) {
          if (json.data) {
            localStorage.setItem(cookies, JSON.stringify(json.data))
            return json.data
          } else if (json.fixedData) {
            return json.fixedData
          }
          // Server sagt explizit "keine Einteilung vorhanden" (data === null) ->
          // lokalen Cache leeren statt auf alten Stand zurückzufallen.
          localStorage.removeItem(cookies)
          return []
        }
      }
    } catch (e) {
      console.warn(
        'Konnte Einteilung nicht vom Server laden, nutze lokalen Zwischenspeicher:',
        e
      )
      return getContent()
    }

    return getContent()
  }

  function clearCookies() {
    localStorage.removeItem(cookies)
    document.querySelectorAll('.person').forEach(e => (e.textContent = 'Frei'))

    return 'Einteilung Zurückgesetzt'
  }

  function serializeAssignments() {
    var result = []

    document.querySelectorAll('.person[data-role]').forEach(el => {
      var role = el.dataset.role
      var text = el.textContent.trim()
      var name = reservedNames.includes(text) ? '' : text
      result.push({ role, name })
    })

    document.querySelectorAll('#teamFree .card').forEach(el => {
      var name = el.textContent.trim()
      if (name) result.push({ role: 'Frei', name })
    })

    document.querySelectorAll('#teamUsed .card').forEach(el => {
      var name = el.textContent.trim()
      if (name) result.push({ role: 'Used', name })
    })

    document.querySelectorAll('#triggeredSpace .card').forEach(el => {
      var name = el.textContent.trim()
      if (name) result.push({ role: 'Triggerd', name })
    })

    return result
  }

  var saveTimer = null

  // Speichert den aktuellen Stand (leicht verzögert, damit bei schnellen
  // Mehrfachänderungen nicht jede einzelne einen eigenen Request auslöst).
  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      var data = serializeAssignments()
      localStorage.setItem(cookies, JSON.stringify(data))

      try {
        await fetch('/api/save-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        })
      } catch (e) {
        console.warn(
          'Änderung konnte nicht auf dem Server gespeichert werden:',
          e
        )
      }
    }, 400)
  }

  function temporaryScheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      var data = serializeAssignments()
      localStorage.setItem(cookies, JSON.stringify(data))

      try {
        await fetch('/api/save-temporary-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        })
      } catch (e) {
        console.warn(
          'Änderung konnte nicht auf dem Server gespeichert werden:',
          e
        )
      }
    }, 400)
  }

  function activityScheduleSave() {
    clearTimeout(saveTimer)
    var data = serializeAssignments()
    saveTimer = setTimeout(async () => {
      try {
        await fetch('/api/save-activity-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        })
      } catch (e) {
        console.warn(
          'Aktivitätsplan konnte nicht auf dem Server gespeichert werden:',
          e
        )
      }
    }, 400)
  }

  async function removeFromSchedule(draggedEl) {
    clearTimeout(saveTimer)
    var name = draggedEl.textContent
    var department = draggedEl.id

    if(!department){
      return
    }

    try {
      await fetch('/api/delete-schedule-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, name })
      })
    } catch (e) {
      console.warn(
        'Aktivitätsplan konnte nicht auf dem Server gespeichert werden:',
        e
      )
    }
  }

  function renderAssignments(assignment) {
    var i = 0
    var freeTeamParent = document.getElementById('teamFree')
    var freeTeam = freeTeamParent.querySelector('#innerTeam')
    var usedTeamParent = document.getElementById('teamUsed')
    var usedTeam = usedTeamParent.querySelector('#innerTeam')


    if (!freeTeam) return
    if (!usedTeam) return


    assignment.forEach(({ role, name }) => {
      if (!name) return

      if (role === 'Frei') {
        i++

        var d = document.createElement('div')
        d.className = 'card'
        d.setAttribute('draggable', !reservedNames.includes(name))
        d.innerHTML = name
        freeTeam.appendChild(d)
        return
      }

      if (role === 'Used') {
        i++

        var d = document.createElement('div')
        d.className = 'card'
        d.setAttribute('draggable', !reservedNames.includes(name))
        d.innerHTML = name
        usedTeam.appendChild(d)
        return
      }

      if (window.location.pathname.split('/').pop() === 'temporaryPlan.html') {
        var triggertTeamParent = document.getElementById('triggeredSpace')
        var triggerdTeam = triggertTeamParent.querySelector('#innerTeam')

        if (!triggerdTeam) return
        if (role === 'Triggerd') {
          i++

          var d = document.createElement('div')
          d.className = 'card'
          d.setAttribute('draggable', !reservedNames.includes(name))
          d.innerHTML = name
          d.style.backgroundColor = '#af2a1c'
          d.style.color = '#ffffff'
          triggerdTeam.appendChild(d)
          return
        }
      }

      var el = document.querySelector(`.person[data-role="${role}"]`)
      if (!el) return

      el.textContent = name
      updatePersonColor(el)
    })

    if (i > 0) {
      var t = document.querySelector('.freeTeamSpace')
      t.style.display = 'flex'
    }

    importNotWorkingPeople()
  }

  var dnd = window.DragAndDrop
    ? window.DragAndDrop.createDragAndDrop({
      reservedNames,
      scheduleSave,
      temporaryScheduleSave,
      activityScheduleSave,
      exportNotWorkingPeople,
      removeFromSchedule
    })
    : { initDragAndDrop: () => { }, updatePersonColor: () => { } }

  var initDragAndDrop = dnd.initDragAndDrop
  var updatePersonColor = dnd.updatePersonColor

  function initDeleteButtons() {
    var deleteBtns = document.querySelectorAll('.close')
    var poolParent = document.getElementById('teamFree')
    var pool = poolParent.querySelector('#innerTeam')

    deleteBtns.forEach(btn => {
      btn.addEventListener('click', event => {
        var parent = event.target.parentElement
        var persons = parent.querySelectorAll('.person')

        persons.forEach(p => {
          var oldPerson = p.textContent.trim()
          var c = document.createElement('div')

          p.style.backgroundColor = '#D1D5DB'
          c.className = 'card'
          p.textContent = p.dataset.default || 'Frei'
          p.draggable = false
          c.setAttribute('draggable', !reservedNames.includes(oldPerson))
          c.textContent = oldPerson

          pool.appendChild(c)
        })

        scheduleSave()
      })
    })
  }

  async function logout() {
    try {
      var res = await fetch('/api/logout', { method: 'POST' })
      var data = await res.json()
      window.location.href = data.redirect || 'login.html'
    } catch (e) {
      console.error('Logout fehlgeschlagen:', e)
      window.location.href = 'login.html'
    }
  }

  async function exportNotWorkingPeople(movedEl) {
    var parent = movedEl.parentElement
    var departmentShort = parent.parentElement.id
    var person = movedEl.textContent.trim()

    var data = { name: person, department: departmentShort }

    try {
      var res = await fetch('/api/export-not-working-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      var result = await res.json()
    } catch (e) {
      console.error('Export fehlgeschlagen:', e)
    }
  }

  async function importNotWorkingPeople() {
    var res = await fetch('/api/import-not-working-persons', {
      credentials: 'include' // oder 'same-origin'
    })
    var result = await res.json()

    if (result.length > 0) {
      var poolParent = document.getElementById('teamFree')
      var freeTeam = poolParent.querySelector('#innerTeam')

      result.forEach(({ department, name }) => {
        if (!name) return

        var div = document.createElement('div')
        div.className = 'card'
        div.setAttribute('draggable', !reservedNames.includes(name))
        div.innerHTML = name
        div.setAttribute('id', department)
        freeTeam.appendChild(div)
        return
      })
    }
  }

  window.Dienste = {
    readFromFile,
    getContent,
    loadContent,
    clearCookies,
    parseContent,
    renderAssignments,
    initDragAndDrop,
    initDeleteButtons,
    logout,
    importNotWorkingPeople
  }
})()
