const showAlternativePlan = makeShowPlan({ dialogId: 'temporaryDialog', iframeId: 'temporaryIframe', closeSelector: '.temporaryPlanClose' })
const showActivityPlan   = makeShowPlan({ dialogId: 'activityDialog',  iframeId: 'activityIframe',  closeSelector: '.activityPlanClose' })
const showFuturePlan     = makeShowPlan({ dialogId: 'futureDialog',   iframeId: 'futureIframe',    closeSelector: '.futurePlanClose' })
const closeTemporaryPlan = makeClosePlan({ dialogId: 'temporaryDialog', iframeId: 'temporaryIframe', closeSelector: '.temporaryPlanClose' })
const closeActivityPlan  = makeClosePlan({ dialogId: 'activityDialog',  iframeId: 'activityIframe',  closeSelector: '.activityPlanClose' })
const closeFuturePlan    = makeClosePlan({ dialogId: 'futureDialog',   iframeId: 'futureIframe',    closeSelector: '.futurePlanClose' })

function formatDateGerman(timestamp) {
  var date = new Date(timestamp);
  var monate = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];
  var tag = String(date.getDate()).padStart(2, '0');
  var monat = monate[date.getMonth()];
  var jahr = date.getFullYear();
  return `${tag} ${monat} ${jahr}`;
}

function makeShowPlan({ dialogId, iframeId, closeSelector }) {
  return async function (clickedDiv) {
    var FlyOuts = clickedDiv.parentElement
    var dialogDiv = document.getElementById(dialogId)
    var dialogIframe = dialogDiv.querySelector('#' + iframeId)
    var dialogButton = dialogDiv.querySelector(closeSelector)
    var delay = millis => new Promise(resolve => setTimeout(resolve, millis))

    document.body.style.overflow = 'hidden'

    dialogIframe.style.display = 'block'
    FlyOuts.style.display = 'none'
    requestAnimationFrame(() => dialogIframe.classList.add('is-open'))

    if (!dialogIframe.src) {
      await new Promise(resolve => {
        dialogIframe.addEventListener('load', resolve, { once: true })
        dialogIframe.src = dialogIframe.dataset.src
      })
    }

    await delay(400)

    dialogButton.style.display = 'block'
    requestAnimationFrame(() => dialogButton.classList.add('is-open'))
  }
}

function makeClosePlan({ dialogId, iframeId, closeSelector }) {
  return async function () {
    var FlyOuts = document.getElementById('flyOutId')
    var dialogDiv = document.getElementById(dialogId)
    var dialogIframe = dialogDiv.querySelector('#' + iframeId)
    var dialogButton = dialogDiv.querySelector(closeSelector)
    var delay = millis => new Promise(resolve => setTimeout(resolve, millis))

    dialogButton.classList.remove('is-open')
    dialogButton.addEventListener('transitionend', () => {
      dialogButton.style.display = 'none'
    }, { once: true })

    await delay(1100)

    dialogIframe.classList.remove('is-open')
    dialogIframe.addEventListener('transitionend', () => {
      dialogIframe.style.display = 'none'
      document.body.style.overflow = ''
    }, { once: true })

    FlyOuts.style.display = 'flex'
  }
}

async function altertivPlanLoad() {
  var i = 0
  var poolParent = document
    .getElementById('iframe')
    .contentWindow.document.getElementById('teamFree')
  var freeTeam = poolParent.querySelector('#innerTeam')

  var assignments = await window.Dienste.loadContent()
  if (!freeTeam) return


  assignments.forEach(({ role, name }) => {
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

    var el = document.querySelector(`.person[data-role="${role}"]`)
    if (!el) return
  })

  if (i > 0) {
    var t = document.querySelector('.freeTeamSpace')
    t.style.display = 'flex'
  }
}


async function activityPlanLoad() {
  var assignments = await window.Dienste.loadContent()

  assignments.forEach(({ role, name }) => {
    if (!name) return


    var activityRole = document.querySelector(`.work-duty .person[data-role="${role}"]`)
    if (!activityRole) {
      return
    }
    activityRole.textContent = name
    activityRole.style.backgroundColor = '#B6D5FB'
    activityRole.setAttribute('draggable', true)
  })

  initClearButtons()
}

function initClearButtons() {
  var clearButton = document.querySelectorAll('.close')

  clearButton.forEach(button => {
    button.addEventListener('click', event => {
      var parent = event.target.parentElement
      var person = parent.querySelectorAll('.person')

      console.log(person)

      person.textContent = 'Frei'
    })
  })
}

async function uploadUpcomingPlan(curElement) {
  var parentElement = curElement.parentElement;
  var inputPlan = parentElement.querySelector("#inputPlan");
  var result;

  parentElement.addEventListener("click", () => inputPlan.click());
  inputPlan.addEventListener("change", async (e) => {
    var file = e.target.files[0];
    if (!file) return;

    var previewUrl = URL.createObjectURL(file);
    showUpcomingPlans(parentElement, previewUrl);

    var base = await new Promise((resolve, reject) => {
      var reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    result = await fetch('/api/save-upcoming-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base, filename: file.name })
    }).then(r => r.json());

    console.log(result)
  })
}

function showUpcomingPlans(container, url) {
  var preview = container.querySelector(".planPreview");
  var uploadPlan = container.querySelector('#uploadPlan')
  if (!preview) {
    preview = document.createElement("iframe");
    preview.className = "planPreview";
    container.appendChild(preview);
  }

  uploadPlan.style.display = 'none'
  preview.src = url + "#toolbar=0&navpanes=0&scrollbar=0";

  container.querySelector("#uploadPlan").style.display = "none"; // Upload-Link ausblenden
  container.querySelector(".img").style.display = "none";        // Plus-Icon ausblenden
}

async function loadFuturePlans() {
  var res = await fetch('/api/load-upcoming-plans')
  var result = await res.json()

  var today = new Date()
  var tomorrow = (d => new Date(d.setDate(d.getDate() + 1)))(new Date)
  var dayAfterTomorrow = (d => new Date(d.setDate(d.getDate() + 2)))(new Date)
  var dateTimeNow = formatDateGerman(today)
  var dateTomorow = formatDateGerman(tomorrow)
  var dateDayAfterTomorrow = formatDateGerman(dayAfterTomorrow)
  var i = 1

  if (result.data.length > 0) {
    result.data.forEach(({ name, path }) => {
      if (i > 3) return;

      if (name === dateTimeNow + '.pdf') { showUpcomingPlans(document.getElementById('plan1'), filePath) }
      else if (name === dateTomorow + '.pdf') { showUpcomingPlans(document.getElementById('plan2'), filePath) }
      else if (name === dateDayAfterTomorrow + '.pdf') { showUpcomingPlans(document.getElementById('plan3'), filePath) }
      else {
        var planDiv = document.getElementById('plan' + i);
        var plantitle = document.getElementById('plan' + i + '-title')
        var filePath = path.replace(/%20/g, " ")

        plantitle.textContent = "Plan vom: " + name
        showUpcomingPlans(planDiv, filePath)
      }

      i++
    })
  }
  else { console.log(result) }
}