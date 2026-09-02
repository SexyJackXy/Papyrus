import initDragAndDrop from './dragLogic.js'
import initSettingsAdjustment from './settings.js'

async function loadContent () {
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
        if (Array.isArray(json.data)) {
          localStorage.setItem(cookies, JSON.stringify(json.data))
          return json.data
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

  var assignments

  // lädt den ganzen Restilichen Content oder einstellungen
  initDragAndDrop()
  renderAssignments(assignments)
  initSettingsAdjustment()
  initDeleteButtons()

  return getContent()
}

function renderAssignments (assignment) {
  let i = 0
  const poolParent = document.getElementById('teamFree')
  const freeTeam = poolParent.querySelector('#innerTeam')
  if (!freeTeam) return

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

function getContent () {
  const raw = localStorage.getItem(cookies)
  return raw ? JSON.parse(raw) : []
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