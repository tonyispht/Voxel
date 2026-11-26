// Procedural, "realistic-ish" 64px textures drawn on a canvas at startup.
// No image files needed. Returns average colors (used for debris particles).

const S = 64

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rgba = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`

function base(ctx, r, c, amp) {
  const img = ctx.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const n = (r() - 0.5) * amp * 2
    img.data[i * 4] = c[0] + n
    img.data[i * 4 + 1] = c[1] + n
    img.data[i * 4 + 2] = c[2] + n
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

function blobs(ctx, r, col, n, rmin, rmax) {
  ctx.fillStyle = col
  for (let i = 0; i < n; i++) {
    ctx.beginPath()
    ctx.arc(r() * S, r() * S, rmin + r() * (rmax - rmin), 0, Math.PI * 2)
    ctx.fill()
  }
}

function cracks(ctx, r, n, col) {
  ctx.strokeStyle = col
  ctx.lineWidth = 1
  for (let i = 0; i < n; i++) {
    let x = r() * S, y = r() * S
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let s = 0; s < 8; s++) { x += (r() - 0.5) * 14; y += (r() - 0.2) * 10; ctx.lineTo(x, y) }
    ctx.stroke()
  }
}

function grid(ctx, step, col) {
  ctx.strokeStyle = col
  ctx.lineWidth = 1
  for (let p = 0; p < S; p += step) {
    ctx.beginPath(); ctx.moveTo(p + 0.5, 0); ctx.lineTo(p + 0.5, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p + 0.5); ctx.lineTo(S, p + 0.5); ctx.stroke()
  }
}

function stoneBase(ctx, r) { base(ctx, r, [102, 102, 104], 18) }

const DRAW = {
  concrete: (c, r) => { base(c, r, [128, 128, 124], 16); cracks(c, r, 3, rgba(40, 40, 40, .5)); blobs(c, r, rgba(60, 50, 40, .12), 6, 6, 14) },
  concrete_floor: (c, r) => { base(c, r, [105, 105, 102], 14); grid(c, 32, rgba(0, 0, 0, .35)); blobs(c, r, rgba(40, 60, 30, .15), 4, 5, 10) },
  mossy_concrete: (c, r) => { DRAW.concrete(c, r); blobs(c, r, rgba(50, 110, 40, .55), 14, 4, 12); blobs(c, r, rgba(30, 80, 30, .5), 8, 2, 5) },
  brick: (c, r) => {
    base(c, r, [160, 150, 140], 10)
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * 8
      for (let col = -1; col < 5; col++) {
        c.fillStyle = rgba(138 + r() * 30, 58 + r() * 20, 44 + r() * 14)
        c.fillRect(col * 16 + off + 1, row * 8 + 1, 14, 6)
      }
    }
    blobs(c, r, rgba(50, 100, 40, .3), 5, 3, 8)
  },
  metal: (c, r) => {
    base(c, r, [88, 98, 106], 10)
    c.strokeStyle = rgba(30, 36, 40, .8); c.lineWidth = 2
    c.strokeRect(1, 1, S - 2, S - 2); c.beginPath(); c.moveTo(0, 32); c.lineTo(S, 32); c.stroke()
    blobs(c, r, rgba(140, 70, 30, .5), 6, 2, 7)
    c.fillStyle = rgba(30, 36, 40, .9); for (const [x, y] of [[6, 6], [57, 6], [6, 57], [57, 57]]) c.fillRect(x, y, 2, 2)
  },
  glass: (c, r) => {
    c.clearRect(0, 0, S, S)
    c.fillStyle = rgba(150, 205, 215, .35); c.fillRect(0, 0, S, S)
    c.strokeStyle = rgba(70, 80, 85, 1); c.lineWidth = 4; c.strokeRect(2, 2, S - 4, S - 4)
    c.strokeStyle = rgba(255, 255, 255, .28); c.lineWidth = 3
    for (const o of [14, 30, 46]) { c.beginPath(); c.moveTo(o, 6); c.lineTo(o - 12, 58); c.stroke() }
    cracks(c, r, 2, rgba(255, 255, 255, .4))
  },
  asphalt: (c, r) => { base(c, r, [46, 46, 50], 12); cracks(c, r, 2, rgba(120, 120, 120, .35)) },
  road_line: (c, r) => { DRAW.asphalt(c, r); c.fillStyle = rgba(205, 175, 45); c.fillRect(29, 0, 6, 40) },
  pavement: (c, r) => { base(c, r, [150, 148, 140], 10); grid(c, 32, rgba(0, 0, 0, .3)); blobs(c, r, rgba(60, 100, 40, .25), 4, 3, 7) },
  dirt: (c, r) => { base(c, r, [108, 76, 50], 22); blobs(c, r, rgba(70, 50, 35, .5), 10, 1, 3); blobs(c, r, rgba(150, 120, 90, .5), 6, 1, 2) },
  grass_top: (c, r) => {
    base(c, r, [62, 118, 38], 26)
    c.strokeStyle = rgba(110, 170, 60, .6)
    for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - .5) * 3, y - 4); c.stroke() }
  },
  grass_side: (c, r) => {
    DRAW.dirt(c, r)
    for (let x = 0; x < S; x++) {
      const h = 10 + Math.floor(r() * 8)
      c.fillStyle = rgba(58 + r() * 14, 112 + r() * 20, 36 + r() * 10); c.fillRect(x, 0, 1, h)
    }
  },
  stone: (c, r) => { stoneBase(c, r); c.strokeStyle = rgba(60, 60, 64, .5); for (const y of [14, 33, 50]) { c.beginPath(); c.moveTo(0, y); c.lineTo(S, y + (r() - .5) * 4); c.stroke() } },
  bedrock: (c, r) => { base(c, r, [36, 36, 40], 24); blobs(c, r, rgba(10, 10, 12, .6), 10, 2, 6) },
  log_side: (c, r) => {
    base(c, r, [92, 62, 36], 10)
    for (let x = 0; x < S; x += 3) { c.fillStyle = rgba(40, 26, 14, .25 + r() * .25); c.fillRect(x, 0, 1 + (r() < .3 ? 1 : 0), S) }
    blobs(c, r, rgba(50, 110, 40, .45), 6, 3, 8)
  },
  log_top: (c, r) => {
    base(c, r, [150, 110, 70], 8)
    c.strokeStyle = rgba(90, 60, 30, .6); c.lineWidth = 1.5
    for (let rad = 5; rad < 34; rad += 6) { c.beginPath(); c.arc(32, 32, rad, 0, Math.PI * 2); c.stroke() }
    c.strokeStyle = rgba(70, 46, 24, 1); c.lineWidth = 4; c.strokeRect(0, 0, S, S)
  },
  leaves: (c, r) => {
    c.clearRect(0, 0, S, S)
    for (let i = 0; i < 140; i++) {
      c.fillStyle = rgba(25 + r() * 35, 90 + r() * 70, 25 + r() * 30)
      c.beginPath(); c.arc(r() * S, r() * S, 3 + r() * 4, 0, Math.PI * 2); c.fill()
    }
  },
  vines: (c, r) => {
    c.clearRect(0, 0, S, S)
    for (let i = 0; i < 9; i++) {
      let x = r() * S
      c.strokeStyle = rgba(30 + r() * 20, 90 + r() * 40, 30, 1); c.lineWidth = 2 + r() * 2
      c.beginPath(); c.moveTo(x, 0)
      for (let y = 0; y < S; y += 8) { x += (r() - .5) * 8; c.lineTo(x, y) }
      c.stroke()
      for (let k = 0; k < 6; k++) { c.fillStyle = rgba(40 + r() * 30, 120 + r() * 50, 40); c.beginPath(); c.arc(x + (r() - .5) * 12, r() * S, 3 + r() * 3, 0, 6.3); c.fill() }
    }
  },
  water: (c, r) => {
    c.fillStyle = rgba(30, 95, 125, .68); c.fillRect(0, 0, S, S)
    for (let i = 0; i < 14; i++) { c.fillStyle = rgba(120, 190, 210, .18); c.fillRect(r() * S, r() * S, 10 + r() * 14, 2) }
  },
  rubble: (c, r) => {
    base(c, r, [110, 108, 104], 14)
    for (let i = 0; i < 16; i++) {
      const g = 70 + r() * 90; c.fillStyle = rgba(g, g, g - 4)
      const x = r() * S, y = r() * S, s = 5 + r() * 10
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + r() * 4); c.lineTo(x + s * .7, y + s); c.lineTo(x - 2, y + s * .6); c.closePath(); c.fill()
    }
  },
  copper_ore: (c, r) => { stoneBase(c, r); blobs(c, r, rgba(190, 115, 65, .95), 8, 2, 5); blobs(c, r, rgba(70, 170, 150, .8), 4, 1, 3) },
  gold_ore: (c, r) => { stoneBase(c, r); blobs(c, r, rgba(240, 205, 70, 1), 9, 1.5, 4); blobs(c, r, rgba(255, 245, 160, .9), 5, 1, 2) },
  scrap: (c, r) => {
    base(c, r, [125, 72, 42], 20); cracks(c, r, 4, rgba(60, 30, 15, .7))
    c.fillStyle = rgba(30, 20, 15, .9); for (let i = 0; i < 5; i++) c.fillRect(r() * 60, r() * 60, 3, 3)
  },
  crate: (c, r) => {
    base(c, r, [150, 115, 70], 12)
    c.strokeStyle = rgba(80, 55, 28, 1); c.lineWidth = 4; c.strokeRect(2, 2, S - 4, S - 4)
    for (const y of [20, 42]) { c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke() }
    c.lineWidth = 3; c.beginPath(); c.moveTo(4, 4); c.lineTo(S - 4, S - 4); c.stroke()
  },
  tnt: (c, r) => {
    base(c, r, [190, 40, 35], 10)
    c.fillStyle = rgba(235, 230, 220); c.fillRect(0, 20, S, 24)
    c.fillStyle = rgba(20, 20, 20); c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('TNT', 32, 39)
  },
  tnt_lit: (c, r) => {
    base(c, r, [250, 160, 120], 10)
    c.fillStyle = rgba(255, 255, 240); c.fillRect(0, 20, S, 24)
    c.fillStyle = rgba(190, 30, 20); c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('TNT', 32, 39)
  },
}

const ALPHA = new Set(['glass', 'leaves', 'vines', 'water'])

export function buildTextures(noa) {
  const AVG = {}
  let seed = 1337
  for (const [name, draw] of Object.entries(DRAW)) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    draw(ctx, rng(seed++ * 7919))
    const px = ctx.getImageData(0, 0, S, S).data
    let rr = 0, gg = 0, bb = 0, n = 0
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 30) { rr += px[i]; gg += px[i + 1]; bb += px[i + 2]; n++ }
    AVG[name] = n ? [rr / n, gg / n, bb / n] : [80, 120, 60]
    noa.registry.registerMaterial(name, { textureURL: canvas.toDataURL(), texHasAlpha: ALPHA.has(name) })
  }
  return AVG
}
