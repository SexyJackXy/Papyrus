; (function () {
  // Eigenständiges Drag-and-Drop-Modul, ausgelagert aus core.js.
  // Wird über window.DragAndDrop.createDragAndDrop({...}) mit den
  // benötigten Abhängigkeiten aus core.js "verdrahtet" und liefert
  // { initDragAndDrop, updatePersonColor } zurück.
  function createDragAndDrop(deps) {
    var reservedNames = deps.reservedNames
    var scheduleSave = deps.scheduleSave
    var temporaryScheduleSave = deps.temporaryScheduleSave
    var activityScheduleSave = deps.activityScheduleSave
    var exportNotWorkingPeople = deps.exportNotWorkingPeople
    var removeFromSchedule = deps.removeFromSchedule

    function updatePersonColor(el) {
      var text = el.textContent.trim()

      if (!reservedNames.includes(text)) {
        el.style.backgroundColor = '#B6D5FB'
        el.draggable = true
      } else {
        el.style.backgroundColor = ''
        el.draggable = false
      }
    }

    function initDragAndDrop() {
      var dragged = null
      var path = window.location.pathname
      var pageName = path.split('/').pop()
      var freePool = null
      var innerFreePool = null
      var usedPool = null
      var innerUsedPool = null
      var triggerPool = null

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

        var personTarget = dropElement.closest('.person')
        var departmentTarget = dropElement.closest('.abteilungspersonal')
        var freePoolTarget = dropElement.closest('#teamFree')
        var usedPoolTarget = dropElement.closest('#teamUsed')
        var triggerPoolTarget = dropElement.closest('#triggeredSpace')
        var trashTarget = dropElement.closest('#trash')
        var draggedRole = draggedEl.dataset.role
        var addPerson = dropElement.closest('#addPerson')

        // CARD -> PERSON
        if (draggedEl.classList.contains('card') && personTarget) {
          var targetText = personTarget.textContent.trim()
          var newCard = document.createElement('div')

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
          var draggedText = draggedEl.textContent.trim()
          var targetText = personTarget.textContent.trim()
          var targetIsEmpty = reservedNames.includes(targetText)

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
          var name = draggedEl.textContent.trim()

          if (!reservedNames.includes(name)) {
            var newCard = document.createElement('div')

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
          var name = draggedEl.textContent.trim()

          if (!reservedNames.includes(name)) {
            var newCard = document.createElement('div')

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
          var name = draggedEl.textContent.trim()


          if (!reservedNames.includes(name)) {
            var newCard = document.createElement('div')

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
          draggedEl.style.backgroundColor = '#d1d5db'
          draggedEl.style.color = '#0a0a0a'
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
          var name = draggedEl.textContent.trim()

          if (!reservedNames.includes(name)) {
            var newCard = document.createElement('div')

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
          removeFromSchedule(draggedEl)
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
          var element = e.target.closest('.card, .person')

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
        var element = e.target.closest('.card, .person')

        if (!element) return

        element.classList.remove('dragging')
        clearHighlights()
        dragged = null
      })

      document.addEventListener('dragover', e => {
        var target = e.target.closest(
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
        var payload
        try {
          payload = JSON.parse(e.dataTransfer.getData('text/papyrus-json'))
        } catch (err) {
          return
        }
        if (!payload) return

        clearHighlights()

        var virtualEl = document.createElement('div')
        virtualEl.className = payload.kind
        virtualEl.textContent = payload.text
        if (payload.role) virtualEl.dataset.role = payload.role

        performDrop(virtualEl, e.target)
      }

      // Reagiert im Elternfenster auf die Aufräum-Nachricht aus dem iFrame
      window.addEventListener('message', e => {
        if (e.origin !== window.location.origin) return
        if (!e.data || e.data.type !== 'papyrus-cross-frame-drop') return

        var el = document.querySelector(`[data-drag-id="${e.data.dragId}"]`)
        if (!el) return

        if (el.classList.contains('card')) {
          el.remove()
        } else if (el.classList.contains('person')) {
          var role = el.dataset.role
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

      var touchDragged = null
      var ghost = null
      var touchStartPos = null
      var TOUCH_MOVE_THRESHOLD = 6 // px – unterscheidet Tippen von echtem Ziehen

      function createGhost(el) {
        var rect = el.getBoundingClientRect()
        var g = el.cloneNode(true)

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
        var rect = ghost.getBoundingClientRect()
        ghost.style.left = x - rect.width / 2 + 'px'
        ghost.style.top = y - rect.height / 2 + 'px'
      }

      function elementUnderGhost(x, y) {
        if (!ghost) return document.elementFromPoint(x, y)
        ghost.style.display = 'none'
        var el = document.elementFromPoint(x, y)
        ghost.style.display = ''
        return el
      }

      document.addEventListener(
        'touchstart',
        e => {
          var element = e.target.closest('.card, .person')

          if (!element) return
          if (element.draggable === false) return

          var touch = e.touches[0]
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

          var touch = e.touches[0]

          if (!ghost) {
            var dx = touch.clientX - touchStartPos.x
            var dy = touch.clientY - touchStartPos.y
            if (Math.hypot(dx, dy) < TOUCH_MOVE_THRESHOLD) return

            touchDragged.classList.add('dragging')
            ghost = createGhost(touchDragged)
          }

          moveGhost(touch.clientX, touch.clientY)

          clearHighlights()
          var under = elementUnderGhost(touch.clientX, touch.clientY)
          var target =
            under && under.closest('.person, .abteilungspersonal, #innerTeam')
          if (target) target.classList.add('drop-target')
        },
        { passive: false }
      )

      document.addEventListener('touchend', e => {
        if (!touchDragged) return

        if (ghost) {
          var touch = e.changedTouches[0]
          var dropElement = elementUnderGhost(touch.clientX, touch.clientY)

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

    return { initDragAndDrop, updatePersonColor }
  }

  window.DragAndDrop = { createDragAndDrop }
})()
