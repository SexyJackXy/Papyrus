; (function () {
  function getCheckboxes() {
    return {
      showWachabteilung: document.getElementById('showWachabteilung'),
      autoLoadTagdienst: document.getElementById('autoLoadTagdienst'),
      showArbeitsdienste: document.getElementById('showArbeitsdienste'),
      showDuty: document.getElementById('showDuty')
    }
  }

  async function loadSettings () {
    var settings = await fetch('/api/settings').then(r => r.json())
    var settingCheckboxes = getCheckboxes()

    Object.entries(settingCheckboxes).forEach(([key, el]) => {
      if (el) el.checked = !!settings[key]
    })

    return settings
  }

  async function saveSettings () {
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

  async function initSettingsAdjustment () {
    var settings = await fetch('/api/settings').then(r => r.json())
    var showWachabteilung = settings.showWachabteilung
    var autoLoadTagdienst = settings.autoLoadTagdienst
    var showArbeitsdienste = settings.showArbeitsdienste
    var dutyTakeout = settings.showDuty

    if (dutyTakeout === true) {
      var showInnerTeamUsed = document.getElementById('teamUsed')
      showInnerTeamUsed.style.display = 'block'
      showteamFree.style.width = 'clamp(300px, 45vw, 1440px)'
    }
    else {
      var showteamFree = document.getElementById('teamFree')
      showteamFree.style.maxWidth = 'min(90vw, 2560px)'
    }
    if (showWachabteilung === true) {
      var showStation = document.getElementById('showStation')
      showStation.style.display = 'block'
    }

    if (showArbeitsdienste === true) {
      var workServices = document.getElementById('workServices')
      var workServicesTitle = document.getElementById('workServicesTitle')
      workServices.style.display = 'flex'
      workServicesTitle.style.display = 'block'
    }

    return settings
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
    if (document.getElementById('Save')) {
      initSettingsPage()
    }
  })

  window.DiensteSettings = {
    loadSettings,
    saveSettings,
    initSettingsAdjustment
  }
})()
