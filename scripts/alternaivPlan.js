async function showAlternativePlan() {
  const dialogDiv = document.getElementById('temporaryDialog')
  const dialogIframe = dialogDiv.querySelector('#iframe')
  const dialogButton = dialogDiv.querySelector('.temporaryPlanClose')
  const delay = millis =>
    new Promise((resolve, reject) => {
      setTimeout(_ => resolve(), millis)
    })

  document.body.style.overflow = 'hidden'

  dialogIframe.style.display = 'block'

  requestAnimationFrame(() => {
    dialogIframe.classList.add('is-open')
  })

  if (!dialogIframe.src) {
    await new Promise(resolve => {
      dialogIframe.addEventListener('load', resolve, { once: true })
      dialogIframe.src = dialogIframe.dataset.src
    })
  }

  await delay(400)

  dialogButton.style.display = 'block'

  requestAnimationFrame(() => {
    dialogButton.classList.add('is-open')
  })
}
async function closeTemporaryPlan() {
  const dialogDiv = document.getElementById('temporaryDialog')
  const dialogIframe = dialogDiv.querySelector('#iframe')
  const dialogButton = dialogDiv.querySelector('.temporaryPlanClose')
  const delay = millis =>
    new Promise((resolve, reject) => {
      setTimeout(_ => resolve(), millis)
    })

  dialogButton.classList.remove('is-open')

  dialogButton.addEventListener(
    'transitionend',
    () => {
      dialogButton.style.display = 'none'
    },
    { once: true }
  )

  await delay(1100)

  dialogIframe.classList.remove('is-open')

  dialogIframe.addEventListener(
    'transitionend',
    () => {
      dialogIframe.style.display = 'none'
      document.body.style.overflow = ''
    },
    { once: true }
  )
}
async function altertivPlanLoad() {
  let i = 0
  const poolParent = document
    .getElementById('iframe')
    .contentWindow.document.getElementById('teamFree')
  const freeTeam = poolParent.querySelector('#innerTeam')

  const assignments = await window.Dienste.loadContent()
  if (!freeTeam) return


  assignments.forEach(({ role, name }) => {
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
  })

  if (i > 0) {
    const t = document.querySelector('.freeTeamSpace')
    t.style.display = 'flex'
  }

  // importNotWorkingPeople()
}

async function showActivityPlan() {
  const dialogDiv = document.getElementById('activityDialog')
  const dialogIframe = dialogDiv.querySelector('#iframe')
  const dialogButton = dialogDiv.querySelector('.activityPlanClose')
  const delay = millis =>
    new Promise((resolve, reject) => {
      setTimeout(_ => resolve(), millis)
    })

  document.body.style.overflow = 'hidden'

  dialogIframe.style.display = 'block'

  requestAnimationFrame(() => {
    dialogIframe.classList.add('is-open')
  })

  if (!dialogIframe.src) {
    await new Promise(resolve => {
      dialogIframe.addEventListener('load', resolve, { once: true })
      dialogIframe.src = dialogIframe.dataset.src
    })
  }

  await delay(400)

  dialogButton.style.display = 'block'

  requestAnimationFrame(() => {
    dialogButton.classList.add('is-open')
  })
}

async function closeActivityPlan() {
  const dialogDiv = document.getElementById('activityDialog')
  const dialogIframe = dialogDiv.querySelector('#iframe')
  const dialogButton = dialogDiv.querySelector('.activityPlanClose')
  const delay = millis =>
    new Promise((resolve, reject) => {
      setTimeout(_ => resolve(), millis)
    })

  dialogButton.classList.remove('is-open')

  dialogButton.addEventListener(
    'transitionend',
    () => {
      dialogButton.style.display = 'none'
    },
    { once: true }
  )

  await delay(1100)

  dialogIframe.classList.remove('is-open')

  dialogIframe.addEventListener(
    'transitionend',
    () => {
      dialogIframe.style.display = 'none'
      document.body.style.overflow = ''
    },
    { once: true }
  )
}