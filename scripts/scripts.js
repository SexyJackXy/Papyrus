; (function () {
  const cookies = 'dienste_csv'
  const reservedNames = [
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
      const candidates = [
        new TextDecoder('utf-8').decode(b),
        new TextDecoder('windows-1252').decode(b),
        new TextDecoder('utf-16le').decode(b)
      ]

      let t = candidates[0],
        best = -1e9

      for (const c of candidates) {
        let sc = 0
        if (c.includes('{')) sc += 5
        if (c.includes(',')) sc += 2
        if (/[a-zA-Z]{3,}/.test(c)) sc += 5
        if (c.includes('�')) sc -= 10
        if (sc > best) (best = sc), (t = c)
      }

      if (t.charCodeAt(0) === 0xfeff) t = t.slice(1)

      const parsed = parseContent(t)

      localStorage.setItem(cookies, JSON.stringify(parsed))
    })

    return 'Datei ' + file.name + ' erfolgreich hochgeladen'
  }

  function parseContent(t) {
    if (!t) return []
    try {
      const data = JSON.parse(t)
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
    const raw = localStorage.getItem(cookies)
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
      }
      if (res.ok) {
        const json = await res.json()
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
    const result = []

    document.querySelectorAll('.person[data-role]').forEach(el => {
      const role = el.dataset.role
      const text = el.textContent.trim()
      const name = reservedNames.includes(text) ? '' : text
      result.push({ role, name })
    })

    document.querySelectorAll('#teamFree .card').forEach(el => {
      const name = el.textContent.trim()
      if (name) result.push({ role: 'Frei', name })
    })

    document.querySelectorAll('#teamUsed .card').forEach(el => {
      const name = el.textContent.trim()
      if (name) result.push({ role: 'Used', name })
    })

    document.querySelectorAll('#triggeredSpace .card').forEach(el => {
      const name = el.textContent.trim()
      if (name) result.push({ role: 'Triggerd', name })
    })

    return result
  }

  let saveTimer = null

  // Speichert den aktuellen Stand (leicht verzögert, damit bei schnellen
  // Mehrfachänderungen nicht jede einzelne einen eigenen Request auslöst).
  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const data = serializeAssignments()
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
      const data = serializeAssignments()
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
    const data = serializeAssignments()
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

  function renderAssignments(assignment) {
    let i = 0
    const freeTeamParent = document.getElementById('teamFree')
    const freeTeam = freeTeamParent.querySelector('#innerTeam')
    const usedTeamParent = document.getElementById('teamUsed')
    const usedTeam = usedTeamParent.querySelector('#innerTeam')


    if (!freeTeam) return
    if (!usedTeam) return


    assignment.forEach(({ role, name }) => {
      if (!name) return

      if (role === 'Frei') {
        i++

        const d = document.createElement('div')
        d.className = 'card'
        d.setAttribute('draggable', !reservedNames.includes(name))
        d.innerHTML = name
        freeTeam.appendChild(d)
        return
      }

      if (role === 'Used') {
        i++

        const d = document.createElement('div')
        d.className = 'card'
        d.setAttribute('draggable', !reservedNames.includes(name))
        d.innerHTML = name
        usedTeam.appendChild(d)
        return
      }

      if (window.location.pathname.split('/').pop() === 'temporaryPlan.html') {
        const triggertTeamParent = document.getElementById('triggeredSpace')
        const triggerdTeam = triggertTeamParent.querySelector('#innerTeam')

        if (!triggerdTeam) return
        if (role === 'Triggerd') {
          i++

          const d = document.createElement('div')
          d.className = 'card'
          d.setAttribute('draggable', !reservedNames.includes(name))
          d.innerHTML = name
          d.style.backgroundColor = '#af2a1c'
          d.style.color = '#ffffff'
          triggerdTeam.appendChild(d)
          return
        }
      }

      const el = document.querySelector(`.person[data-role="${role}"]`)
      if (!el) return

      el.textContent = name
      updatePersonColor(el)
    })

    if (i > 0) {
      const t = document.querySelector('.freeTeamSpace')
      t.style.display = 'flex'
    }

    importNotWorkingPeople()
  }

  function initDragAndDrop() {
    let dragged = null
    var path = window.location.pathname
    var pageName = path.split('/').pop()
    let freePool = null
    let innerFreePool = null
    let usedPool = null
    let innerUsedPool = null
    let triggerPool = null

    freePool = document.getElementById('teamFree')
    usedPool = document.getElementById('teamUsed')
    triggerPool = document.getElementById('triggeredSpace')


    if (freePool) innerFreePool = freePool.querySelector('#innerTeam')
    if (usedPool) innerUsedPool = usedPool.querySelector('#innerTeam')
    if (triggerPool) triggerPool = triggerPool.querySelector('#innerTeam')

    function clearHighlights() {
      document
        .querySelectorAll('.drop-target')
        .forEach(el => el.classList.remove('drop-target'))
    }

    // Gemeinsame Drop-Logik, wird sowohl von der Maus-basierten (Desktop)
    // als auch von der Touch-basierten (Handy/Tablet) Variante genutzt.
    function performDrop(draggedEl, dropElement) {
      if (!draggedEl || !dropElement) return

      const personTarget = dropElement.closest('.person')
      const departmentTarget = dropElement.closest('.abteilungspersonal')
      const freePoolTarget = dropElement.closest('#teamFree')
      const usedPoolTarget = dropElement.closest('#teamUsed')
      const triggerPoolTarget = dropElement.closest('#triggeredSpace')
      const trashTarget = dropElement.closest('#trash')
      const draggedRole = draggedEl.dataset.role
      const addPerson = dropElement.closest('#addPerson')

      // CARD -> PERSON
      if (draggedEl.classList.contains('card') && personTarget) {
        const targetText = personTarget.textContent.trim()
        const newCard = document.createElement('div')

        newCard.className = 'card'
        newCard.draggable = true
        newCard.textContent = personTarget.textContent

        if (!reservedNames.includes(targetText)) {
          innerFreePool.appendChild(newCard)
        }

        personTarget.textContent = draggedEl.textContent
        updatePersonColor(personTarget)

        draggedEl.remove()
      }

      // PERSON -> PERSON (tauschen)
      else if (draggedEl.classList.contains('person') && personTarget && draggedEl !== personTarget
      ) {
        const draggedText = draggedEl.textContent.trim()
        const targetText = personTarget.textContent.trim()
        const targetIsEmpty = reservedNames.includes(targetText)

        personTarget.textContent = draggedText

        if (targetIsEmpty) {
          draggedEl.textContent = draggedRole === 'ELW' ? 'LD 1' : draggedRole
        } else {
          draggedEl.textContent = targetText
        }

        updatePersonColor(draggedEl)
        updatePersonColor(personTarget)
      }

      // CARD -> ABTEILUNG
      else if (draggedEl.classList.contains('card') && departmentTarget) {
        departmentTarget.appendChild(draggedEl)
      }

      // PERSON -> FREE POOL
      else if (draggedEl.classList.contains('person') && freePoolTarget) {
        const name = draggedEl.textContent.trim()

        if (!reservedNames.includes(name)) {
          const newCard = document.createElement('div')

          newCard.className = 'card'
          newCard.draggable = true
          newCard.textContent = name

          innerFreePool.appendChild(newCard)

          draggedEl.textContent = draggedRole
          updatePersonColor(draggedEl)
        }
      }

      // PERSON -> USED POOL
      else if (draggedEl.classList.contains('person') && usedPoolTarget) {
        const name = draggedEl.textContent.trim()

        if (!reservedNames.includes(name)) {
          const newCard = document.createElement('div')

          newCard.className = 'card'
          newCard.draggable = true
          newCard.textContent = name

          innerUsedPool.appendChild(newCard)

          draggedEl.textContent = draggedRole
          updatePersonColor(draggedEl)
        }
      }

      // PERSON -> TRIGGERT POOL
      else if (draggedEl.classList.contains('person') && triggerPoolTarget) {
        const name = draggedEl.textContent.trim()


        if (!reservedNames.includes(name)) {
          const newCard = document.createElement('div')

          newCard.className = 'card'
          newCard.draggable = true
          newCard.textContent = name

          triggerPool.appendChild(newCard)

          draggedEl.textContent = draggedRole
          updatePersonColor(draggedEl)
        }
      }

      // CARD -> FREEPOOL
      else if (draggedEl.classList.contains('card') && freePoolTarget) {
        innerFreePool.appendChild(draggedEl)
      } else if (draggedEl.classList.contains('card') && usedPoolTarget) {
        innerUsedPool.appendChild(draggedEl)
      } else if (draggedEl.classList.contains('card') && triggerPoolTarget) {
        var newCard = document.createElement('div')
        newCard.className = 'card'
        newCard.draggable = true
        newCard.textContent = draggedEl.textContent
        newCard.setAttribute('data-role', 'triggerd')
        newCard.style.backgroundColor = '#ff2a1c'
        newCard.style.color = '#ffffff'

        triggerPool.appendChild(newCard)
        draggedEl.remove()
      }

      //FREEPOOL <-> USED POOL
      else if (draggedEl.classList.contains('person') && usedPoolTarget) {
        const name = draggedEl.textContent.trim()

        if (!reservedNames.includes(name)) {
          const newCard = document.createElement('div')

          newCard.className = 'card'
          newCard.draggable = true
          newCard.textContent = name
          newCard.setAttribute('data-role', 'used')
          innerUsedPool.appendChild(newCard)

          draggedEl.textContent = draggedRole
          updatePersonColor(draggedEl)
        }
      } else if (draggedEl.classList.contains('card') && trashTarget) {
        draggedEl.remove()
      } else if (draggedEl.classList.contains('card') && addPerson && pageName === 'shiftSchedule.html'
      ) {
        draggedEl.style.opacity = '0.6'
        draggedEl.classList.add('moved')

        exportNotWorkingPeople(draggedEl)
      }
      if (pageName === 'index.html' || pageName === 'dashboard.html') {
        scheduleSave()
      } else if (pageName === 'temporaryPlan.html') {
        temporaryScheduleSave()
      } else if (pageName === 'activityPlan.html') {
        activityScheduleSave()
      }
    }

    // ---------- Maus-basiertes Drag & Drop (Desktop, native HTML5 DnD) ----------

    document.addEventListener(
      'dragstart',
      e => {
        const element = e.target.closest('.card, .person')

        if (!element) return

        dragged = element
        dragged.classList.add('dragging')

        // Für Cross-Frame-Drops (z. B. Dashboard/Index -> Aktivitätsplan-
        // iFrame) werden die nötigen Infos zusätzlich über dataTransfer
        // mitgegeben, da dort ein eigenes, separates Dokument läuft.
        try {
          e.dataTransfer.effectAllowed = 'copy'
          e.dataTransfer.setData(
            'text/papyrus-json',
            JSON.stringify({
              kind: dragged.classList.contains('card') ? 'card' : 'person',
              text: dragged.textContent.trim(),
              role: dragged.dataset.role || null
            })
          )
          e.dataTransfer.setData('text/plain', dragged.textContent.trim())
        } catch (err) {
          // manche Kontexte erlauben setData nicht – Touch-DnD greift dann ohnehin
        }
      },
      true
    )

    document.addEventListener('dragend', e => {
      const element = e.target.closest('.card, .person')

      if (!element) return

      element.classList.remove('dragging')
      clearHighlights()
      dragged = null
    })

    document.addEventListener('dragover', e => {
      const target = e.target.closest(
        '.person, .abteilungspersonal, #innerTeam, #trashCan, #addPerson'
      )

      if (!target) return

      e.preventDefault()

      clearHighlights()
      target.classList.add('drop-target')
    })

    document.addEventListener('drop', e => {
      e.preventDefault()

      if (dragged) {
        clearHighlights()
        performDrop(dragged, e.target)
        dragged = null
        return
      }

      // Kein im selben Dokument gestartetes Drag -> kommt evtl. aus dem
      // Elternfenster (z. B. Dashboard/Index -> Aktivitätsplan-iFrame)
      handleCrossFrameDrop(e)
    })

    // Verarbeitet einen Drop, dessen Drag in einem ANDEREN Dokument
    // gestartet wurde (z. B. Dashboard/Index -> Aktivitätsplan-iFrame).
    // Die Person wird nur in den Zielslot KOPIERT, die Quelle bleibt
    // unverändert bestehen.
    function handleCrossFrameDrop(e) {
      let payload
      try {
        payload = JSON.parse(e.dataTransfer.getData('text/papyrus-json'))
      } catch (err) {
        return
      }
      if (!payload) return

      clearHighlights()

      const virtualEl = document.createElement('div')
      virtualEl.className = payload.kind
      virtualEl.textContent = payload.text
      if (payload.role) virtualEl.dataset.role = payload.role

      performDrop(virtualEl, e.target)
    }

    // Reagiert im Elternfenster auf die Aufräum-Nachricht aus dem iFrame
    window.addEventListener('message', e => {
      if (e.origin !== window.location.origin) return
      if (!e.data || e.data.type !== 'papyrus-cross-frame-drop') return

      const el = document.querySelector(`[data-drag-id="${e.data.dragId}"]`)
      if (!el) return

      if (el.classList.contains('card')) {
        el.remove()
      } else if (el.classList.contains('person')) {
        const role = el.dataset.role
        el.textContent = role === 'ELW' ? 'LD 1' : role
        updatePersonColor(el)
      }

      el.removeAttribute('data-drag-id')

      if (pageName === 'index.html' || pageName === 'dashboard.html') {
        scheduleSave()
      } else if (pageName === 'temporaryPlan.html') {
        temporaryScheduleSave()
      } else if (pageName === 'activityPlan.html') {
        activityPlanScheduleSave()
      }
    })

    // ---------- Touch-basiertes Drag & Drop (Handy/Tablet) ----------
    // Die HTML5-Drag&Drop-API basiert auf Maus-Events und funktioniert auf
    // den meisten mobilen Browsern nicht. Deshalb hier eine eigene,
    // Touch-Events-basierte Umsetzung mit einem visuellen "Ghost"-Element.

    let touchDragged = null
    let ghost = null
    let touchStartPos = null
    const TOUCH_MOVE_THRESHOLD = 6 // px – unterscheidet Tippen von echtem Ziehen

    function createGhost(el) {
      const rect = el.getBoundingClientRect()
      const g = el.cloneNode(true)

      g.style.position = 'fixed'
      g.style.left = rect.left + 'px'
      g.style.top = rect.top + 'px'
      g.style.width = rect.width + 'px'
      g.style.height = rect.height + 'px'
      g.style.margin = '0'
      g.style.pointerEvents = 'none'
      g.style.opacity = '0.85'
      g.style.zIndex = '9999'
      g.style.transform = 'scale(1.05)'

      document.body.appendChild(g)
      return g
    }

    function moveGhost(x, y) {
      if (!ghost) return
      const rect = ghost.getBoundingClientRect()
      ghost.style.left = x - rect.width / 2 + 'px'
      ghost.style.top = y - rect.height / 2 + 'px'
    }

    function elementUnderGhost(x, y) {
      if (!ghost) return document.elementFromPoint(x, y)
      ghost.style.display = 'none'
      const el = document.elementFromPoint(x, y)
      ghost.style.display = ''
      return el
    }

    document.addEventListener(
      'touchstart',
      e => {
        const element = e.target.closest('.card, .person')

        if (!element) return
        if (element.draggable === false) return

        const touch = e.touches[0]
        touchDragged = element
        touchStartPos = { x: touch.clientX, y: touch.clientY }
      },
      { passive: true }
    )

    document.addEventListener(
      'touchmove',
      e => {
        if (!touchDragged) return

        e.preventDefault() // verhindert Scrollen, sobald ein Drag-Kandidat aktiv ist

        const touch = e.touches[0]

        if (!ghost) {
          const dx = touch.clientX - touchStartPos.x
          const dy = touch.clientY - touchStartPos.y
          if (Math.hypot(dx, dy) < TOUCH_MOVE_THRESHOLD) return

          touchDragged.classList.add('dragging')
          ghost = createGhost(touchDragged)
        }

        moveGhost(touch.clientX, touch.clientY)

        clearHighlights()
        const under = elementUnderGhost(touch.clientX, touch.clientY)
        const target =
          under && under.closest('.person, .abteilungspersonal, #innerTeam')
        if (target) target.classList.add('drop-target')
      },
      { passive: false }
    )

    document.addEventListener('touchend', e => {
      if (!touchDragged) return

      if (ghost) {
        const touch = e.changedTouches[0]
        const dropElement = elementUnderGhost(touch.clientX, touch.clientY)

        ghost.remove()
        ghost = null

        touchDragged.classList.remove('dragging')
        clearHighlights()

        performDrop(touchDragged, dropElement)
      }

      touchDragged = null
      touchStartPos = null
    })

    document.addEventListener('touchcancel', () => {
      if (ghost) {
        ghost.remove()
        ghost = null
      }
      if (touchDragged) touchDragged.classList.remove('dragging')
      clearHighlights()
      touchDragged = null
      touchStartPos = null
    })
  }

  function updatePersonColor(el) {
    const text = el.textContent.trim()

    if (!reservedNames.includes(text)) {
      el.style.backgroundColor = '#B6D5FB'
      el.draggable = true
    } else {
      el.style.backgroundColor = ''
      el.draggable = false
    }
  }

  function initDeleteButtons() {
    const deleteBtns = document.querySelectorAll('.close')
    const poolParent = document.getElementById('teamFree')
    const pool = poolParent.querySelector('#innerTeam')

    deleteBtns.forEach(btn => {
      btn.addEventListener('click', event => {
        const parent = event.target.parentElement
        const persons = parent.querySelectorAll('.person')

        persons.forEach(p => {
          const oldPerson = p.textContent.trim()
          const c = document.createElement('div')

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
      const res = await fetch('/api/logout', { method: 'POST' })
      const data = await res.json()
      window.location.href = data.redirect || 'login.html'
    } catch (e) {
      console.error('Logout fehlgeschlagen:', e)
      window.location.href = 'login.html'
    }
  }

  async function exportNotWorkingPeople(movedEl) {
    const parent = movedEl.parentElement
    const departmentShort = parent.parentElement.id
    const person = movedEl.textContent.trim()

    const data = { name: person, department: departmentShort }

    try {
      const res = await fetch('/api/export-not-working-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()
    } catch (e) {
      console.error('Export fehlgeschlagen:', e)
    }
  }

  async function importNotWorkingPeople() {
    const res = await fetch('/api/import-not-working-persons', {
      credentials: 'include' // oder 'same-origin'
    })
    const result = await res.json()

    if (result.length > 0) {
      const poolParent = document.getElementById('teamFree')
      const freeTeam = poolParent.querySelector('#innerTeam')

      result.forEach(({ department, name }) => {
        if (!name) return

        const div = document.createElement('div')
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
