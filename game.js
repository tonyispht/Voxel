// Gameplay: digging, brushes, TNT, structural collapse, jetpack, upgrades, HUD.

// Deep imports only: a root '@babylonjs/core' import would load a second, separate copy of Babylon from the CDN
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem'
import '@babylonjs/core/Particles/particleSystemComponent'
import '@babylonjs/core/Shaders/particles.vertex'
import '@babylonjs/core/Shaders/particles.fragment'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { DEFS, B } from './blocks.js'
import { findFalling, FallingBody, CrumbleBody } from './structure.js'
import { GY } from './worldgen.js'

const BY_ID = []
for (const d of DEFS) BY_ID[d.id] = d

const NB = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const SAVE_KEY = 'overgrown.career.v1'
const $ = id => document.getElementById(id)

const PALETTE = ['concrete', 'brick', 'metal', 'glass', 'dirt', 'grass', 'stone', 'log', 'crate', 'rubble', 'scrap', 'tnt']
const SANDBOX = { power: 9, brushMax: 4, blasts: [3, 5, 8, 12] }

const UPGRADES = [
  { id: 'pick', name: 'Pickaxe power', max: 8, cost: l => 50 * Math.pow(2, l), desc: l => `dig speed x${(1 + l * 0.9).toFixed(1)}` },
  { id: 'rad', name: 'Dig radius', max: 4, cost: l => 120 * Math.pow(3, l), desc: l => `breaks a radius-${l} sphere` },
  { id: 'tnt', name: 'TNT blast', max: 6, cost: l => 80 * Math.pow(2, l), desc: l => `blast radius ${(3 + l * 1.2).toFixed(1)}` },
  { id: 'jet', name: 'Jetpack', max: 5, cost: l => 100 * Math.pow(2, l), desc: l => `fuel ${60 + l * 40}, thrust +${l * 15}%` },
]

export function initGame(noa, AVG) {
  const scene = noa.rendering.getScene()
  const get = (x, y, z) => noa.world.getBlockID(x, y, z)
  const set = (id, x, y, z) => noa.world.setBlockID(id, x, y, z)

  // ---------------- state ----------------
  const career = load() || { credits: 0, score: 0, destroyed: 0, up: { pick: 0, rad: 0, tnt: 0, jet: 0 }, tnt: 3 }
  const sandbox = { score: 0, destroyed: 0, brush: 1, blastIdx: 1 }
  const G = { mode: 'sandbox', sel: 0, shop: false, fuel: 100, prog: 0, progKey: '', fuses: new Map(), falling: [], crumbles: [], queue: [], seeds: [] }

  function load() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null } catch (e) { return null } }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(career)) } catch (e) { /* storage unavailable */ } }

  const stats = () => {
    if (G.mode === 'sandbox') return { power: SANDBOX.power, brush: sandbox.brush, blast: SANDBOX.blasts[sandbox.blastIdx], fuelMax: 100, thrust: 1.15, tnt: Infinity }
    const u = career.up
    return { power: 1 + u.pick * 0.9, brush: u.rad, blast: 3 + u.tnt * 1.2, fuelMax: 60 + u.jet * 40, thrust: 1 + u.jet * 0.15, tnt: career.tnt }
  }
  const board = () => G.mode === 'sandbox' ? sandbox : career

  // ---------------- audio (tiny synth, optional) ----------------
  let actx = null
  function ensureAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)() } catch (e) { actx = null } }
  window.addEventListener('pointerdown', ensureAudio)
  window.addEventListener('keydown', ensureAudio)
  function noise(dur, freq, vol) {
    if (!actx) return
    try {
      const n = Math.floor(actx.sampleRate * dur)
      const buf = actx.createBuffer(1, n, actx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5)
      const src = actx.createBufferSource(); src.buffer = buf
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq
      const g = actx.createGain(); g.gain.value = vol
      src.connect(f); f.connect(g); g.connect(actx.destination); src.start()
    } catch (e) { /* ignore */ }
  }

  // ---------------- particles ----------------
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 8
    const x = c.getContext('2d')
    x.fillStyle = '#fff'; x.fillRect(0, 0, 8, 8)
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 6, 8, 2); x.fillRect(6, 0, 2, 8)
    return new Texture(c.toDataURL(), scene, true, false, Texture.NEAREST_SAMPLINGMODE)
  })()
  let bursts = 0
  function burst(x, y, z, rgb, n, power, size, life, grav, add) {
    if (bursts > 36) return
    bursts++
    const ps = new ParticleSystem('p', n, scene)
    ps.particleTexture = tex
    const l = [0, 0, 0]
    noa.globalToLocal([x, y, z], null, l)
    ps.emitter = new Vector3(l[0], l[1], l[2])
    ps.minEmitBox = new Vector3(-0.45, -0.45, -0.45)
    ps.maxEmitBox = new Vector3(0.45, 0.45, 0.45)
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255
    ps.color1 = new Color4(r * 1.15, g * 1.15, b * 1.15, 1)
    ps.color2 = new Color4(r * 0.65, g * 0.65, b * 0.65, 1)
    ps.colorDead = new Color4(r * 0.4, g * 0.4, b * 0.4, 0)
    ps.minSize = size * 0.6; ps.maxSize = size * 1.4
    ps.minLifeTime = life * 0.5; ps.maxLifeTime = life
    ps.emitRate = 0; ps.manualEmitCount = n
    ps.gravity = new Vector3(0, grav, 0)
    ps.direction1 = new Vector3(-1, 0.6, -1); ps.direction2 = new Vector3(1, 2.2, 1)
    ps.minEmitPower = power * 0.4; ps.maxEmitPower = power
    ps.updateSpeed = 0.016
    ps.blendMode = add ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD
    ps.start()
    setTimeout(() => { try { ps.dispose(false) } catch (e) { /* ignore */ } bursts-- }, life * 1000 + 400)
  }
  const dust = (x, y, z, id, n = 12, power = 4) => burst(x + 0.5, y + 0.5, z + 0.5, colorOf(id), n, power, 0.2, 1, -16, false)
  const colorOf = id => {
    const d = BY_ID[id]; if (!d) return [120, 120, 120]
    const m = Array.isArray(d.mat) ? d.mat[0] : d.mat
    return AVG[m] || [120, 120, 120]
  }

  // ---------------- HUD ----------------
  const hud = { stats: $('stats'), bar: $('bar'), barI: $('bar').firstElementChild, sel: $('sel'), toast: $('toast'), shop: $('shop') }
  const flash = document.createElement('div')
  flash.style.cssText = 'position:fixed;inset:0;background:#ffd9a0;opacity:0;pointer-events:none;z-index:9;transition:opacity .5s'
  document.body.appendChild(flash)
  let toastT = 0
  function toast(msg) {
    hud.toast.textContent = msg; hud.toast.style.opacity = 1
    clearTimeout(toastT); toastT = setTimeout(() => { hud.toast.style.opacity = 0 }, 2200)
  }
  function renderHud() {
    const st = stats(), b = board()
    const pos = noa.entities.getPosition(noa.playerEntity)
    const lines = [`<b>${G.mode === 'sandbox' ? 'SANDBOX' : 'CAREER'}</b> &middot; depth ${Math.round(GY - pos[1])}m &middot; ${Math.round(pos[0])}, ${Math.round(pos[2])}`]
    lines.push(`Score <b>${b.score}</b> &middot; Destroyed ${b.destroyed}`)
    if (G.mode === 'career') lines.push(`Credits <b>${career.credits}</b> &middot; TNT <b>${career.tnt}</b> &middot; <b>U</b> = shop`)
    lines.push(`Fuel ${'#'.repeat(Math.round(G.fuel / st.fuelMax * 10)).padEnd(10, '.')}`)
    hud.stats.innerHTML = lines.join('<br>')
    const name = PALETTE[G.sel]
    hud.sel.innerHTML = `Block: <b>${name}</b> &middot; Dig radius <b>${st.brush}</b> &middot; Blast <b>${st.blast.toFixed(1)}</b>`
  }
  setInterval(renderHud, 200)

  // ---------------- breaking ----------------
  const breakable = id => { const d = BY_ID[id]; return !!d && Number.isFinite(d.hard) && !d.fluid }
  const seedSet = new Set()
  function addSeeds(x, y, z) {
    for (const d of NB) {
      const sx = x + d[0], sy = y + d[1], sz = z + d[2]
      const k = sx + ',' + sy + ',' + sz
      if (seedSet.has(k)) continue
      seedSet.add(k); G.seeds.push([sx, sy, sz])
    }
  }
  function award(id) {
    const d = BY_ID[id]; const v = d ? d.value : 0
    const b = board(); b.score += v; b.destroyed++
    if (G.mode === 'career') career.credits += v
  }
  function destroyNow(x, y, z) {
    const id = get(x, y, z)
    if (!breakable(id)) return 0
    // armed TNT is left alone so blasts chain-react instead of deleting their neighbours
    if (id === B.tnt_lit && G.fuses.has(x + ',' + y + ',' + z)) return 0
    set(0, x, y, z)
    award(id)
    addSeeds(x, y, z)
    return id
  }
  function queueSphere(cx, cy, cz, r, jitter) {
    const R = Math.ceil(r)
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      const lim = r * r * (jitter ? 0.82 + Math.random() * 0.36 : 1) + 0.25
      if (dx * dx + dy * dy + dz * dz <= lim) G.queue.push([cx + dx, cy + dy, cz + dz])
    }
  }

  function dig(t) {
    const st = stats()
    const [x, y, z] = t.position
    const id = t.blockID
    dust(x, y, z, id, 10, 3.5)
    noise(0.12, 1800, 0.25)
    queueSphere(x, y, z, st.brush, false)
    if (G.mode === 'career') save()
  }

  // ---------------- TNT ----------------
  function ignite(x, y, z, ms) {
    const k = x + ',' + y + ',' + z
    if (G.fuses.has(k)) return
    set(B.tnt_lit, x, y, z)
    G.fuses.set(k, { x, y, z, t: ms, blink: 0 })
  }
  function explode(x, y, z) {
    const R = stats().blast
    G.fuses.delete(x + ',' + y + ',' + z)
    set(0, x, y, z)
    // chain reaction
    const Rc = Math.ceil(R)
    for (let dx = -Rc; dx <= Rc; dx++) for (let dy = -Rc; dy <= Rc; dy++) for (let dz = -Rc; dz <= Rc; dz++) {
      if (dx * dx + dy * dy + dz * dz > R * R) continue
      const id = get(x + dx, y + dy, z + dz)
      if (id === B.tnt) ignite(x + dx, y + dy, z + dz, 120 + Math.random() * 300)
    }
    queueSphere(x, y, z, R, true)
    burst(x + 0.5, y + 0.5, z + 0.5, [255, 150, 40], 90, R * 1.6, R * 0.35, 0.8, 4, true)
    burst(x + 0.5, y + 0.5, z + 0.5, [70, 60, 55], 70, R * 1.3, R * 0.3, 1.5, -6, false)
    noise(1.1, 420, 0.9); noise(0.5, 120, 1)
    flash.style.transition = 'none'; flash.style.opacity = Math.min(0.55, 0.15 + R * 0.04)
    requestAnimationFrame(() => { flash.style.transition = 'opacity .5s'; flash.style.opacity = 0 })
    // knockback
    try {
      const p = noa.entities.getPosition(noa.playerEntity)
      const dx = p[0] - (x + 0.5), dy = p[1] + 0.9 - (y + 0.5), dz = p[2] - (z + 0.5)
      const d = Math.hypot(dx, dy, dz)
      if (d < R * 2.5) {
        const body = noa.entities.getPhysicsBody(noa.playerEntity)
        const k = (1 - d / (R * 2.5)) * 14 / Math.max(d, 0.5)
        body.velocity[0] += dx * k; body.velocity[1] += Math.max(dy * k, 4); body.velocity[2] += dz * k
      }
    } catch (e) { /* ignore */ }
  }
  function plantTnt() {
    const st = stats()
    const t = noa.targetedBlock
    if (!t) return toast('Aim at a surface to plant TNT')
    if (st.tnt <= 0) return toast('Out of TNT - buy more in the shop (U)')
    const [x, y, z] = t.adjacent
    if (get(x, y, z) !== 0 || overlapsPlayer(x, y, z)) return
    if (G.mode === 'career') { career.tnt--; save() }
    ignite(x, y, z, 2200)
    toast('TNT armed - back off!')
  }

  // ---------------- placing ----------------
  function overlapsPlayer(x, y, z) {
    const p = noa.entities.getPosition(noa.playerEntity)
    return x + 1 > p[0] - 0.35 && x < p[0] + 0.35 && z + 1 > p[2] - 0.35 && z < p[2] + 0.35 && y + 1 > p[1] && y < p[1] + 1.8
  }
  function place() {
    const t = noa.targetedBlock
    if (!t) return
    const [x, y, z] = t.adjacent
    if (get(x, y, z) !== 0 && get(x, y, z) !== B.water && get(x, y, z) !== B.vines) return
    if (overlapsPlayer(x, y, z)) return
    set(B[PALETTE[G.sel]], x, y, z)
  }

  // ---------------- input ----------------
  noa.inputs.down.on('alt-fire', () => { if (!G.shop) place() })
  window.addEventListener('keydown', e => {
    if (e.repeat) return
    const code = e.code
    if (G.shop) {
      if (code === 'KeyU' || code === 'Escape') return toggleShop(false)
      const n = parseInt(code.replace('Digit', ''), 10)
      if (n >= 1 && n <= 5) buy(n - 1)
      return
    }
    if (code === 'KeyR') { G.sel = (G.sel + 1) % PALETTE.length }
    else if (code === 'KeyT') plantTnt()
    else if (code === 'KeyM') {
      G.mode = G.mode === 'sandbox' ? 'career' : 'sandbox'
      toast(G.mode === 'sandbox' ? 'Sandbox: everything unlocked' : 'Career: earn credits, buy upgrades (U)')
    }
    else if (code === 'KeyB' && G.mode === 'sandbox') { sandbox.brush = (sandbox.brush + 1) % (SANDBOX.brushMax + 1) }
    else if (code === 'KeyV' && G.mode === 'sandbox') { sandbox.blastIdx = (sandbox.blastIdx + 1) % SANDBOX.blasts.length }
    else if (code === 'KeyU') {
      if (G.mode !== 'career') return toast('Shop is for career mode - press M')
      toggleShop(true)
    }
    else if (code.startsWith('Digit')) {
      const n = parseInt(code.slice(5), 10) - 1
      if (n >= 0 && n < PALETTE.length) G.sel = n
    }
    renderHud()
  })

  function toggleShop(on) {
    G.shop = on
    hud.shop.style.display = on ? 'block' : 'none'
    if (on) { try { document.exitPointerLock() } catch (e) { /* ignore */ } renderShop() }
  }
  function renderShop() {
    const rows = UPGRADES.map((u, i) => {
      const lvl = career.up[u.id]
      const maxed = lvl >= u.max
      const cost = u.cost(lvl)
      const can = !maxed && career.credits >= cost
      return `<div data-k="Digit${i + 1}" class="${can ? '' : 'dim'}"><b>${i + 1}</b> ${u.name} Lv${lvl}/${u.max} &mdash; ${u.desc(lvl)} ${maxed ? '(MAX)' : `&rarr; <b>${cost}</b>`}</div>`
    })
    const tnt = career.credits >= 40
    rows.push(`<div data-k="Digit5" class="${tnt ? '' : 'dim'}"><b>5</b> +5 TNT (have ${career.tnt}) &rarr; <b>40</b></div>`)
    hud.shop.innerHTML = `<h3>Salvage Shop</h3>Credits: <b>${career.credits}</b><br>${rows.join('')}<div data-k="KeyU" class="dim">Press 1-5 to buy &middot; U / Esc to close (tap here to close)</div>`
  }
  function buy(i) {
    if (i === 4) {
      if (career.credits < 40) return toast('Not enough credits')
      career.credits -= 40; career.tnt += 5
    } else {
      const u = UPGRADES[i], lvl = career.up[u.id]
      if (lvl >= u.max) return toast('Already maxed')
      const c = u.cost(lvl)
      if (career.credits < c) return toast('Not enough credits')
      career.credits -= c; career.up[u.id]++
    }
    save(); renderShop(); toast('Purchased!')
  }

  // ---------------- per-tick simulation ----------------
  let tickN = 0
  noa.on('tick', dtMs => {
    tickN++
    const dt = dtMs / 1000
    const st = stats()

    // digging
    const t = noa.targetedBlock
    if (noa.inputs.state.fire && t && breakable(t.blockID) && !G.shop) {
      const key = t.position.join(',')
      if (key !== G.progKey) { G.progKey = key; G.prog = 0 }
      G.prog += dt * st.power
      const need = BY_ID[t.blockID].hard
      hud.bar.style.opacity = 1
      hud.barI.style.width = Math.min(100, (G.prog / need) * 100) + '%'
      if (G.prog >= need) { dig(t); G.prog = 0 }
    } else { G.prog = 0; G.progKey = ''; hud.bar.style.opacity = 0 }

    // TNT fuses
    for (const f of [...G.fuses.values()]) {
      f.t -= dtMs; f.blink += dtMs
      if (f.blink > 220) { f.blink = 0; set(get(f.x, f.y, f.z) === B.tnt_lit ? B.tnt : B.tnt_lit, f.x, f.y, f.z) }
      if (f.t <= 0) explode(f.x, f.y, f.z)
    }

    // spread queued destruction over ticks so huge blasts don't freeze the game
    let n = 0
    while (G.queue.length && n < 1800) { const p = G.queue.pop(); if (destroyNow(p[0], p[1], p[2])) n++ }
    if (!G.queue.length && G.seeds.length) {
      const comps = findFalling(get, G.seeds)
      G.seeds.length = 0; seedSet.clear()
      for (const c of comps) {
        if (c.length > 1500) G.crumbles.push(new CrumbleBody(c))
        else G.falling.push(new FallingBody(c))
        const m = c[Math.floor(c.length / 2)]
        dust(m.x, m.y, m.z, m.id, 16, 3)
        if (c.length > 30) noise(0.6, 300, 0.5)
      }
      if (comps.length) toast(comps.reduce((a, c) => a + c.length, 0) + ' blocks collapse!')
    }

    // falling structures
    for (let i = G.falling.length - 1; i >= 0; i--) {
      const f = G.falling[i]
      f.ticks++
      if (f.ticks % 3) continue
      if (!f.cells.length || f.fell > 200) { G.falling.splice(i, 1); continue }   // destroyed mid-fall, or fell out of the world
      f.speed = Math.min(f.speed + 0.4, 4)
      const want = Math.max(1, Math.floor(f.speed))
      const d = f.freeDrop(get, want)
      if (d > 0) f.move(set, d, get)
      if (!f.cells.length) { G.falling.splice(i, 1); continue }
      if (d < want) {
        // landed
        G.falling.splice(i, 1)
        if (f.fell > 2) {
          for (const c of f.cells) if (Math.random() < 0.55 && c.id !== B.rubble) set(B.rubble, c.x, c.y, c.z)
          const m = f.cells[f.cells.length >> 1]
          burst(m.x + 0.5, m.y + 0.5, m.z + 0.5, [120, 115, 108], 60, 5, 0.35, 1.6, -4, false)
          noise(0.8, 260, Math.min(1, 0.3 + f.cells.length / 800))
        }
      }
    }

    // crumbling towers: one layer every other tick, debris rains down as rubble
    for (let i = G.crumbles.length - 1; i >= 0; i--) {
      const cb = G.crumbles[i]
      if (tickN % 2) continue
      const gone = cb.step(get, set)
      let shown = 0
      for (const c of gone) {
        award(c.id); addSeeds(c.x, c.y, c.z)
        if (Math.random() < 0.1) {
          let y = c.y - 1
          while (y > c.y - 60 && (get(c.x, y, c.z) === 0 || get(c.x, y, c.z) === B.vines)) y--
          if (get(c.x, y + 1, c.z) === 0) set(B.rubble, c.x, y + 1, c.z)
        }
        if (shown < 2 && Math.random() < 0.05) { dust(c.x, c.y, c.z, c.id, 8, 2.5); shown++ }
      }
      if (gone.length > 120 && tickN % 6 === 0) noise(0.4, 200, 0.4)
      if (cb.done) G.crumbles.splice(i, 1)
    }

    // jetpack
    try {
      const body = noa.entities.getPhysicsBody(noa.playerEntity)
      const grounded = body.resting[1] < 0
      if (grounded) G.fuel = Math.min(st.fuelMax, G.fuel + 30 * dt)
      if (noa.inputs.state.jump && !grounded && (G.fuel > 0 || G.mode === 'sandbox') && !G.shop) {
        body.velocity[1] = Math.min(body.velocity[1] + 32 * st.thrust * dt, 8 * st.thrust)
        if (G.mode !== 'sandbox') G.fuel = Math.max(0, G.fuel - 28 * dt)
      }
    } catch (e) { /* physics body not ready yet */ }
  })

  // target highlight + underground atmosphere
  const sky = [0.62, 0.74, 0.68], dark = [0.02, 0.035, 0.03]
  noa.on('beforeRender', () => {
    const t = noa.targetedBlock
    if (t && !G.shop) noa.rendering.highlightBlockFace(true, t.position, t.normal)
    else noa.rendering.highlightBlockFace(false)
    const p = noa.entities.getPosition(noa.playerEntity)
    const under = Math.min(1, Math.max(0, (GY + 1 - p[1]) / 14))
    const m = (a, b) => a + (b - a) * under
    scene.fogColor = new Color3(m(sky[0], dark[0]), m(sky[1], dark[1]), m(sky[2], dark[2]))
    scene.clearColor = new Color4(scene.fogColor.r, scene.fogColor.g, scene.fogColor.b, 1)
    scene.fogDensity = m(0.0065, 0.03)
  })

  renderHud()
  toast('Click to capture mouse - hold LMB to dig')
  return { G, career, sandbox }
}
