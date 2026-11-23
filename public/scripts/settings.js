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
  }
})()
