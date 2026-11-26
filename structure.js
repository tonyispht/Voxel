// Structural integrity: when blocks are destroyed, anything left unattached to
// the ground falls. Engine-free (takes get/set callbacks) so it can be tested in Node.

import { B } from './blocks.js'

// Material families for structural support:
//   tree     = log, leaves            (connect only to each other)
//   building = everything man-made    (connect only to each other, plus grass/ores/rubble)
//   ground   = any other solid (dirt, stone, asphalt, pavement, bedrock)  -> anchors
// Trees and buildings never hold each other up (roots don't hold up a tower), but a
// tree rests on grass, and grass is part of the "building" family so rooftop gardens fall with their roof.
const TREE = new Set([B.log, B.leaves])
const BUILD = new Set([
  B.concrete, B.concrete_floor, B.mossy_concrete, B.brick, B.metal, B.glass,
  B.crate, B.scrap, B.tnt, B.tnt_lit, B.rubble, B.grass, B.copper_ore, B.gold_ore,
])
export const STRUCT = new Set([...TREE, ...BUILD])
const PASS = new Set([0, B.water, B.vines])   // air-like for connectivity

// 0 pass, 1 tree, 2 building, 3 ground
const kind = id => PASS.has(id) ? 0 : TREE.has(id) ? 1 : BUILD.has(id) ? 2 : 3

// order matters: the DFS stack pops the LAST pushed first, so 'down' is last and the
// search dives toward the ground, finding an anchor fast for grounded buildings.
const NB = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]
const k3 = (x, y, z) => x + ',' + y + ',' + z

// seeds: [x,y,z] positions next to destroyed blocks. Returns list of components,
// each an array of {x,y,z,id}, that are NOT attached to ground.
export function findFalling(get, seeds, { cap = 25000, budget = 80000 } = {}) {
  const seen = new Set()
  const supported = new Set()
  const out = []
  let spent = 0
  for (const s of seeds) {
    const sk = k3(s[0], s[1], s[2])
    if (seen.has(sk)) continue
    const sk0 = kind(get(s[0], s[1], s[2]))
    if (sk0 !== 1 && sk0 !== 2) continue
    const local = new Set([sk])
    const stack = [s]
    const comp = []
    let anchored = false
    outer: while (stack.length) {
      const p = stack.pop()
      comp.push(p)
      if (comp.length > cap || ++spent > budget) { anchored = true; break }
      const myKind = kind(get(p[0], p[1], p[2]))
      for (const d of NB) {
        const nx = p[0] + d[0], ny = p[1] + d[1], nz = p[2] + d[2]
        const id = get(nx, ny, nz)
        const nk = kind(id)
        if (nk === 0) continue
        if (nk === 3) { anchored = true; break outer }                       // touches ground
        if (nk !== myKind) {
          if (myKind === 1 && id === B.grass) { anchored = true; break outer } // tree rooted in grass
          continue                                                           // tree <-> building: no support
        }
        const key = k3(nx, ny, nz)
        if (supported.has(key)) { anchored = true; break outer }
        if (!local.has(key)) { local.add(key); stack.push([nx, ny, nz]) }
      }
    }
    if (anchored) { for (const k of local) { supported.add(k); seen.add(k) } }
    else {
      for (const k of local) seen.add(k)
      out.push(comp.map(p => ({ x: p[0], y: p[1], z: p[2], id: get(p[0], p[1], p[2]) })))
    }
  }
  return out
}

// A rigid chunk of blocks falling together.
export class FallingBody {
  constructor(cells) {
    this.cells = cells
    this.cols = new Map()
    this.ticks = 0
    this.fell = 0
    this.speed = 0
    for (const c of cells) {
      const ck = c.x * 131072 + c.z
      let s = this.cols.get(ck)
      if (!s) this.cols.set(ck, s = new Set())
      s.add(c.y)
    }
  }
  owns(x, y, z) { const s = this.cols.get(x * 131072 + z); return !!s && s.has(y) }
  // how far (<= want) can we drop before hitting something that isn't ours?
  freeDrop(get, want) {
    for (let d = 1; d <= want; d++) {
      for (const c of this.cells) {
        const y = c.y - d
        if (this.owns(c.x, y, c.z)) continue
        if (!PASS.has(get(c.x, y, c.z))) return d - 1
      }
    }
    return want
  }
  move(set, d, get) {
    if (get) this.cells = this.cells.filter(c => get(c.x, c.y, c.z) === c.id)   // player may have dug bits out mid-fall
    for (const c of this.cells) set(0, c.x, c.y, c.z)
    for (const c of this.cells) c.y -= d
    for (const c of this.cells) set(c.id, c.x, c.y, c.z)
    this.cols.clear()
    for (const c of this.cells) {
      const ck = c.x * 131072 + c.z
      let s = this.cols.get(ck)
      if (!s) this.cols.set(ck, s = new Set())
      s.add(c.y)
    }
    this.fell += d
  }
}

// Huge unsupported masses (whole towers) crumble from the bottom up, one layer per
// step, instead of falling rigidly. Cheap, and looks like a pancake collapse.
export class CrumbleBody {
  constructor(cells) {
    this.layers = new Map()
    for (const c of cells) {
      let l = this.layers.get(c.y)
      if (!l) this.layers.set(c.y, l = [])
      l.push(c)
    }
    this.ys = [...this.layers.keys()].sort((a, b) => a - b)
    this.i = 0
    this.size = cells.length
  }
  get done() { return this.i >= this.ys.length }
  // removes the next layer; returns the cells actually removed
  step(get, set) {
    const out = []
    const l = this.layers.get(this.ys[this.i++]) || []
    for (const c of l) if (get(c.x, c.y, c.z) === c.id) { set(0, c.x, c.y, c.z); out.push(c) }
    return out
  }
}
