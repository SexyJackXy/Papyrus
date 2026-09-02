export default function initDragAndDrop () {
  let dragged = null
  var path = window.location.pathname
  var pageName = path.split('/').pop()
  let freePool = null
  let innerFreePool = null
  let usedPool = null
  let innerUsedPool = null

  freePool = document.getElementById('teamFree')
  usedPool = document.getElementById('teamUsed')

  if (freePool) innerFreePool = freePool.querySelector('#innerTeam')
  if (usedPool) innerUsedPool = usedPool.querySelector('#innerTeam')

  function clearHighlights () {
    document
      .querySelectorAll('.drop-target')
      .forEach(el => el.classList.remove('drop-target'))
  }

  // Gemeinsame Drop-Logik, wird sowohl von der Maus-basierten (Desktop)
  // als auch von der Touch-basierten (Handy/Tablet) Variante genutzt.
  function performDrop (draggedEl, dropElement) {
    if (!draggedEl || !dropElement) return

    const personTarget = dropElement.closest('.person')
    const departmentTarget = dropElement.closest('.abteilungspersonal')
    const freePoolTarget = dropElement.closest('#teamFree')
    const usedPoolTarget = dropElement.closest('#teamUsed')
    const trashTarget = dropElement.closest('#trash')
    const draggedRole = draggedEl.dataset.role
    const addPerson = dropElement.closest('#addPerson')

    // CARD -> PERSON
    if (draggedEl.classList.contains('card') && personTarget) {
      if (!reservedNames.includes(personTarget.dataset.role)) {
        return
      }

      personTarget.textContent = draggedEl.textContent
      updatePersonColor(personTarget)

      draggedEl.remove()
    }

    // PERSON -> PERSON (tauschen)
    else if (
      draggedEl.classList.contains('person') &&
      personTarget &&
      draggedEl !== personTarget
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

    // CARD -> FREEPOOL
    else if (draggedEl.classList.contains('card') && freePoolTarget) {
      innerFreePool.appendChild(draggedEl)
    } else if (draggedEl.classList.contains('card') && usedPoolTarget) {
      innerUsedPool.appendChild(draggedEl)
    }
    //FREEPOOL <-> USED POOL
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
    } else if (draggedEl.classList.contains('card') && trashTarget) {
      draggedEl.remove()
    } else if (
      draggedEl.classList.contains('card') &&
      addPerson &&
      pageName === 'shiftSchedule.html'
    ) {
      draggedEl.style.opacity = '0.6'
      draggedEl.classList.add('moved')

      exportNotWorkingPeople(draggedEl)
    }

    if (pageName === 'index.html' || pageName === 'dasboard.html') {
      scheduleSave()
    } else if (pageName === 'temporaryPlan.html') {
      temporaryScheduleSave()
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
    if (!dragged) return

    e.preventDefault()
    clearHighlights()
    performDrop(dragged, e.target)
    dragged = null
  })

  // ---------- Touch-basiertes Drag & Drop (Handy/Tablet) ----------
  // Die HTML5-Drag&Drop-API basiert auf Maus-Events und funktioniert auf
  // den meisten mobilen Browsern nicht. Deshalb hier eine eigene,
  // Touch-Events-basierte Umsetzung mit einem visuellen "Ghost"-Element.

  let touchDragged = null
  let ghost = null
  let touchStartPos = null
  const TOUCH_MOVE_THRESHOLD = 6 // px – unterscheidet Tippen von echtem Ziehen

  function createGhost (el) {
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

  function moveGhost (x, y) {
    if (!ghost) return
    const rect = ghost.getBoundingClientRect()
    ghost.style.left = x - rect.width / 2 + 'px'
    ghost.style.top = y - rect.height / 2 + 'px'
  }

  function elementUnderGhost (x, y) {
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
