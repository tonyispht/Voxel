// Touch controls: left stick = move, drag anywhere else = look, buttons on the right.
// Drives the game by synthesising the same key events the keyboard uses, so game.js needs no changes.

export function initTouch(noa) {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches
  if (!isTouch) return
  document.body.classList.add('touch')

  // 'fire' (dig) is mouse-only by default; give it a key we can synthesise
  noa.inputs.bind('fire', 'KeyF')

  const key = (code, down) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true }))
  const tap = code => { key(code, true); key(code, false) }

  const root = document.createElement('div')
  root.id = 'touch'
  root.innerHTML = `
    <div id="tlook"></div>
    <div id="tstick"><i></i></div>
    <div id="tbtns">
      <button data-hold="Space" class="big jump">JUMP<small>hold = jetpack</small></button>
      <button data-hold="KeyF" class="big dig">DIG</button>
      <button data-hold="KeyE" class="place">PLACE</button>
      <button data-tap="KeyT" class="tnt">TNT</button>
    </div>
    <div id="ttop">
      <button data-tap="KeyR">BLOCK</button>
      <button data-tap="KeyB">BRUSH</button>
      <button data-tap="KeyV">BLAST</button>
      <button data-tap="KeyM">MODE</button>
      <button data-tap="KeyU">SHOP</button>
    </div>`
  document.body.appendChild(root)

  const css = document.createElement('style')
  css.textContent = `
    body.touch #help { display: none; }
    body.touch #cross { opacity: .9; }
    body.touch #sel { bottom: auto; top: 12px; left: auto; right: 14px; transform: none; font-size: 12px; max-width: 46vw; }
    body.touch #stats { font-size: 12px; }
    body.touch #toast { top: 24%; font-size: 15px; }
    body.touch #shop { pointer-events: auto; min-width: 0; width: 82vw; font-size: 14px; }
    body.touch #shop [data-k] { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.12); }
    #touch { position: fixed; inset: 0; z-index: 8; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    #touch button { font: 700 13px system-ui, sans-serif; color: #e8f1e4; background: rgba(20,40,24,.55); border: 2px solid rgba(155,227,122,.55); border-radius: 50%; touch-action: none; -webkit-tap-highlight-color: transparent; padding: 0; }
    #touch button:active, #touch button.on { background: rgba(155,227,122,.55); color: #08100a; }
    #tlook { position: absolute; inset: 0; }
    #tstick { position: absolute; left: 22px; bottom: 28px; width: 132px; height: 132px; border-radius: 50%; background: rgba(20,40,24,.35); border: 2px solid rgba(155,227,122,.4); }
    #tstick i { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: rgba(155,227,122,.55); }
    #tbtns button { position: absolute; width: 58px; height: 58px; }
    #tbtns .big { width: 78px; height: 78px; }
    #tbtns small { display: block; font-size: 8px; font-weight: 400; opacity: .8; }
    #tbtns .jump { right: 18px; bottom: 28px; }
    #tbtns .dig { right: 104px; bottom: 70px; }
    #tbtns .place { right: 18px; bottom: 118px; }
    #tbtns .tnt { right: 118px; bottom: 156px; }
    #ttop { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); display: flex; gap: 6px; }
    #ttop button { border-radius: 10px; width: auto; padding: 6px 8px; font-size: 11px; }
    @media (max-height: 420px) { #tstick { width: 108px; height: 108px; bottom: 22px; } #tbtns .big { width: 64px; height: 64px; } #tbtns button { width: 48px; height: 48px; } #tbtns .dig { right: 90px; bottom: 40px; } #tbtns .tnt { right: 96px; bottom: 100px; } #tbtns .place { right: 16px; bottom: 96px; } }
  `
  document.head.appendChild(css)

  // ----- movement stick -----
  const stick = root.querySelector('#tstick'), knob = stick.firstElementChild
  const dirs = { KeyW: false, KeyS: false, KeyA: false, KeyD: false }
  const setDir = (code, on) => { if (dirs[code] !== on) { dirs[code] = on; key(code, on) } }
  let stickId = null
  function stickMove(t) {
    const r = stick.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    let dx = t.clientX - cx, dy = t.clientY - cy
    const max = r.width / 2, d = Math.hypot(dx, dy)
    if (d > max) { dx *= max / d; dy *= max / d }
    knob.style.transform = `translate(${dx}px,${dy}px)`
    const dead = max * 0.22
    setDir('KeyD', dx > dead); setDir('KeyA', dx < -dead)
    setDir('KeyS', dy > dead); setDir('KeyW', dy < -dead)
  }
  function stickEnd() {
    stickId = null; knob.style.transform = ''
    for (const k of Object.keys(dirs)) setDir(k, false)
  }
  stick.addEventListener('touchstart', e => { e.preventDefault(); if (stickId === null) { const t = e.changedTouches[0]; stickId = t.identifier; stickMove(t) } }, { passive: false })

  // ----- look (drag anywhere that isn't a control) -----
  const look = root.querySelector('#tlook')
  let lookId = null, lx = 0, ly = 0
  look.addEventListener('touchstart', e => { e.preventDefault(); if (lookId === null) { const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY } }, { passive: false })

  const SENS = 0.0045
  const find = (list, id) => { for (const t of list) if (t.identifier === id) return t; return null }
  window.addEventListener('touchmove', e => {
    if (stickId !== null) { const t = find(e.touches, stickId); if (t) { e.preventDefault(); stickMove(t) } }
    if (lookId !== null) {
      const t = find(e.touches, lookId)
      if (t) {
        e.preventDefault()
        const cam = noa.camera
        cam.heading = (cam.heading + (t.clientX - lx) * SENS + Math.PI * 2) % (Math.PI * 2)
        const maxP = Math.PI / 2 - 0.001
        cam.pitch = Math.max(-maxP, Math.min(maxP, cam.pitch + (t.clientY - ly) * SENS))
        lx = t.clientX; ly = t.clientY
      }
    }
  }, { passive: false })
  const ended = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) stickEnd()
      if (t.identifier === lookId) lookId = null
    }
  }
  window.addEventListener('touchend', ended)
  window.addEventListener('touchcancel', ended)

  // ----- buttons -----
  for (const b of root.querySelectorAll('button')) {
    const hold = b.dataset.hold, tp = b.dataset.tap
    let id = null
    b.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation()
      if (id !== null) return
      id = e.changedTouches[0].identifier
      b.classList.add('on')
      if (hold) key(hold, true); else tap(tp)
    }, { passive: false })
    const up = e => {
      for (const t of e.changedTouches) if (t.identifier === id) { id = null; b.classList.remove('on'); if (hold) key(hold, false) }
    }
    b.addEventListener('touchend', up); b.addEventListener('touchcancel', up)
  }

  // ----- shop rows (tap to buy / close) -----
  const shop = document.getElementById('shop')
  shop.addEventListener('click', e => {
    const row = e.target.closest('[data-k]')
    if (row) tap(row.dataset.k)
  })

  // fullscreen on first touch hides the browser chrome and gives more room
  window.addEventListener('touchend', function fs() {
    window.removeEventListener('touchend', fs)
    try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}) } catch (err) { /* ignore */ }
  }, { once: true })
}
