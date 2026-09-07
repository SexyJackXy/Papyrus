;(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginbtn')
    const usernameInput = document.getElementById('username')
    const passwordInput = document.getElementById('password')
    const errorEl = document.getElementById('loginError')

    function showError (msg) {
      errorEl.textContent = msg
      errorEl.style.display = 'block'
    }

    async function doLogin () {
      const username = usernameInput.value.trim()
      const password = passwordInput.value

      if (!username || !password) {
        showError('Bitte Benutzername und Passwort eingeben.')
        return
      }

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        const data = await res.json()

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
    const loginCard = document.getElementById('loginCard')
    const loginView = document.getElementById('loginView')
    const registerView = document.getElementById('registerView')
    const showRegisterLink = document.getElementById('showRegister')
    const showLoginLink = document.getElementById('showLogin')

    const regUsernameInput = document.getElementById('regUsername')
    const regPasswordInput = document.getElementById('regPassword')
    const regNameRows = document.getElementById('regNameRows')
    const addNameBtn = document.getElementById('addNameBtn')
    const registerBtn = document.getElementById('registerbtn')
    const registerErrorEl = document.getElementById('registerError')
    const registerSuccessEl = document.getElementById('registerSuccess')

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
      const username = regUsernameInput.value.trim()
      const password = regPasswordInput.value

      const names = Array.from(regNameRows.querySelectorAll('.nameRow'))
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
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        const data = await res.json()

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