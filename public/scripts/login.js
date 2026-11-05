; (function () {
  document.addEventListener('DOMContentLoaded', () => {
    var loginBtn = document.getElementById('loginbtn')
    var usernameInput = document.getElementById('username')
    var passwordInput = document.getElementById('password')
    var errorEl = document.getElementById('loginError')

function showError(msg) {
  errorEl.textContent = msg
  errorEl.style.display = 'block'
  errorEl.removeAttribute('data-state')
  void errorEl.offsetWidth            // Reflow erzwingen, damit die Animation bei jedem Fehler neu startet
  errorEl.dataset.state = 'shaking'
}

errorEl.addEventListener('animationend', () => {
  errorEl.removeAttribute('data-state')
})

    async function doLogin() {
      var username = usernameInput.value.trim()
      var password = passwordInput.value

      if (!username || !password) {
        showError('Bitte Benutzername und Passwort eingeben.')
        return
      }

      try {
        var res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        var data = await res.json()

        if (data.success) {
          window.location.href = data.redirect || 'dashboard.html'
        } else {
          showError(data.error || 'Login fehlgeschlagen.')
        }
      } catch (err) {
        console.error(err)
        showError('Verbindung zum Server fehlgeschlagen.')
      }
    }

    loginBtn.addEventListener('click', doLogin)
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin()
    })
  })
})()
