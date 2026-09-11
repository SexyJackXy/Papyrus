;(function () {
  document.addEventListener('DOMContentLoaded', () => {
    var loginBtn = document.getElementById('loginbtn')
    var usernameInput = document.getElementById('username')
    var passwordInput = document.getElementById('password')
    var errorEl = document.getElementById('loginError')

    function showError (msg) {
      errorEl.textContent = msg
      errorEl.style.display = 'block'
    }

    async function doLogin () {
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
          window.location.href = data.redirect || 'index.html'
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

    // --- Registrierung ---
    var loginCard = document.getElementById('loginCard')
    var loginView = document.getElementById('loginView')
    var registerView = document.getElementById('registerView')
    var showRegisterLink = document.getElementById('showRegister')
    var showLoginLink = document.getElementById('showLogin')

    var regUsernameInput = document.getElementById('regUsername')
    var regPasswordInput = document.getElementById('regPassword')
    var regNameRows = document.getElementById('regNameRows')
    var addNameBtn = document.getElementById('addNameBtn')
    var registerBtn = document.getElementById('registerbtn')
    var registerErrorEl = document.getElementById('registerError')
    var registerSuccessEl = document.getElementById('registerSuccess')

    function showRegisterError (msg) {
      registerSuccessEl.style.display = 'none'
      registerErrorEl.textContent = msg
      registerErrorEl.style.display = 'block'
    }

    function showRegisterSuccess (msg) {
      registerErrorEl.style.display = 'none'
      registerSuccessEl.textContent = msg
      registerSuccessEl.style.display = 'block'
    }

    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault()
      loginView.style.display = 'none'
      registerView.style.display = 'block'
      loginCard.classList.add('registerMode')
    })

    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault()
      registerView.style.display = 'none'
      loginView.style.display = 'block'
      loginCard.classList.remove('registerMode')
    })

    addNameBtn.addEventListener('click')

    async function doRegister () {
      var username = regUsernameInput.value.trim()
      var password = regPasswordInput.value

      var names = Array.from(regNameRows.querySelectorAll('.nameRow'))
        .map(row => ({
          firstName: row.querySelector('.regFirstName').value.trim(),
          lastName: row.querySelector('.regLastName').value.trim()
        }))
        .filter(n => n.firstName && n.lastName)

      if (!username || !password || names.length === 0) {
        showRegisterError('Bitte Benutzername, Passwort und mindestens einen Namen angeben.')
        return
      }

      try {
        var res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        var data = await res.json()

        if (data.success) {
          showRegisterSuccess(`Nutzer "${username}" wurde angelegt. Du kannst dich jetzt einloggen.`)
          regUsernameInput.value = ''
          regPasswordInput.value = ''
        } else {
          showRegisterError(data.error || 'Registrierung fehlgeschlagen.')
        }
      } catch (err) {
        console.error(err)
        showRegisterError('Verbindung zum Server fehlgeschlagen.')
      }
    }

    registerBtn.addEventListener('click', doRegister)
    regPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doRegister()
    })
  })
})()