(function () {
  var INTERVAL = 30 * 1000
  var RETRY = 5 * 1000
  var offset = 0 // Serveruhr minus Geräteuhr
  var lastInteraction = 0

  ;['dragend', 'touchend', 'pointerup', 'keydown'].forEach(function (evt) {
    document.addEventListener(evt, function () { lastInteraction = Date.now() }, true)
  })

  function busy() {
    var a = document.activeElement
    return (
      !!document.querySelector('.dragging') ||
      (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) ||
      Date.now() - lastInteraction < 3000
    )
  }

  function msUntilNext() {
    var ms = INTERVAL - ((Date.now() + offset) % INTERVAL)
    return ms < 2000 ? ms + INTERVAL : ms
  }

  function tick() {
    if (busy()) return setTimeout(tick, RETRY)
    location.reload()
  }

  fetch('/api/settings', { method: 'HEAD', cache: 'no-store' })
    .then(function (res) {
      var d = res.headers.get('Date')
      if (d) offset = new Date(d).getTime() - Date.now()
    })
    .catch(function () {})
    .then(function () { setTimeout(tick, msUntilNext()) })
})()