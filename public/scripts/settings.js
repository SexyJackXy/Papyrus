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
