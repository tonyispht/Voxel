// Procedural world: a modern city swallowed by jungle.
// Pure functions of (seed, x, y, z) so chunks generate independently and
// can be tested in plain Node (no engine needed).

import { B } from './blocks.js'

export const GY = 8          // ground level in the flat city core (top block y)
export const BED = -40       // bedrock layer
export const CELL = 28       // city block size
export const ROAD = 6        // road width
export const BW = 18         // building footprint width
export const FLOOR_H = 5
export const CORE_R = 300    // flat core radius
export const SEED = 20260

// ---------- hashing & noise ----------
function hash3(x, y, z, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(s | 0, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const sm = t => t * t * (3 - 2 * t)
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v
export const smoothstep = (a, b, x) => sm(clamp01((x - a) / (b - a)))

function vnoise2(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z)
  const fx = sm(x - xi), fz = sm(z - zi)
  return lerp(
    lerp(hash3(xi, 0, zi, s), hash3(xi + 1, 0, zi, s), fx),
    lerp(hash3(xi, 0, zi + 1, s), hash3(xi + 1, 0, zi + 1, s), fx), fz)
}
function vnoise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
    l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz)
}
export function fbm2(x, z, s, oct = 4) {
  let a = 0.5, f = 1, sum = 0, norm = 0
  for (let i = 0; i < oct; i++) { sum += a * vnoise2(x * f, z * f, s + i * 31); norm += a; a *= 0.5; f *= 2 }
  return sum / norm
}
export function fbm3(x, y, z, s, oct = 3) {
  let a = 0.5, f = 1, sum = 0, norm = 0
  for (let i = 0; i < oct; i++) { sum += a * vnoise3(x * f, y * f, z * f, s + i * 17); norm += a; a *= 0.5; f *= 2 }
  return sum / norm
}

const mod = (a, n) => ((a % n) + n) % n

// ---------- terrain ----------
export function cityness(x, z) {
  const d = Math.hypot(x, z)
  return 1 - smoothstep(CORE_R, 720, d)
}
export function heightAt(x, z) {
  const c = cityness(x, z)
  const hills = (fbm2(x / 90, z / 90, SEED + 1, 4) - 0.5) * 2   // -1..1
  const ridges = Math.abs(fbm2(x / 160, z / 160, SEED + 2, 3) - 0.5) * 2
  const amp = 26 * (1 - c)
  return Math.round(GY + hills * amp + ridges * 8 * (1 - c))
}
// 0..1, how much nature has reclaimed this spot
export function overgrowth(x, z) {
  const d = Math.hypot(x, z)
  const base = 0.38 + 0.4 * smoothstep(0, 600, d)
  return clamp01(base + (fbm2(x / 14, z / 14, SEED + 3, 3) - 0.5) * 0.9)
}

// ---------- city cells ----------
const cellCache = new Map()
export function cellInfo(cx, cz) {
  const key = cx * 100003 + cz
  let c = cellCache.get(key)
  if (c) return c
  const mx = cx * CELL + CELL / 2, mz = cz * CELL + CELL / 2
  const dist = Math.hypot(mx, mz)
  const city = cityness(mx, mz)
  const r = hash3(cx, 0, cz, SEED + 10)
  const park = hash3(cx, 1, cz, SEED + 11) < 0.12
  const exists = !park && city > 0.04 && r < 0.92 * city + 0.04
  const centerBoost = 1 - smoothstep(0, 340, dist)
  const maxFloors = 3 + Math.floor(centerBoost * 15)
  const floors = 2 + Math.floor(Math.pow(hash3(cx, 2, cz, SEED + 12), 1.6) * (maxFloors - 1))
  const style = hash3(cx, 3, cz, SEED + 13)
  const core = dist < CORE_R - 20
  c = {
    exists, park, core,
    gy: core ? GY : heightAt(mx, mz),
    floors,
    H: floors * FLOOR_H,
    ruin: 0.25 + hash3(cx, 4, cz, SEED + 14) * 0.75,
    wall: style < 0.45 ? B.concrete : style < 0.7 ? B.brick : style < 0.85 ? B.mossy_concrete : B.metal,
    glassy: style > 0.6 ? 0.85 : 0.55,
    basement: core && hash3(cx, 5, cz, SEED + 15) > 0.3,
    flooded: hash3(cx, 6, cz, SEED + 16) > 0.5,
  }
  cellCache.set(key, c)
  return c
}

// ---------- trees ----------
const TREE_GRID = 6
export function treeAt(gx, gz) {
  const tx = gx * TREE_GRID + Math.floor(hash3(gx, 7, gz, SEED + 20) * TREE_GRID)
  const tz = gz * TREE_GRID + Math.floor(hash3(gx, 8, gz, SEED + 21) * TREE_GRID)
  const city = cityness(tx, tz)
  const dens = lerp(0.9, 0.22, city)
  if (hash3(gx, 9, gz, SEED + 22) > dens) return null
  // keep trees off building footprints (they grow from roads, lots and parks)
  const cx = Math.floor(tx / CELL), cz = Math.floor(tz / CELL)
  const ci = cellInfo(cx, cz)
  if (ci.exists) {
    const lx = mod(tx, CELL) - (ROAD + 2), lz = mod(tz, CELL) - (ROAD + 2)
    if (lx >= -1 && lx <= BW && lz >= -1 && lz <= BW) return null
  }
  const emergent = hash3(gx, 10, gz, SEED + 23) < 0.14
  const H = emergent ? 24 + Math.floor(hash3(gx, 11, gz, SEED + 24) * 12) : 7 + Math.floor(hash3(gx, 12, gz, SEED + 25) * 11)
  const R = emergent ? 6 : 3 + Math.floor(hash3(gx, 13, gz, SEED + 26) * 3)
  return { x: tx, z: tz, y: heightAt(tx, tz), H, R, emergent }
}

// ---------- the chunk generator ----------
function buildingBlock(ci, lx, lz, y, x, z) {
  // lx,lz are footprint-local (0..BW-1); returns block id (0 = air)
  const ry = y - ci.gy
  const H = ci.H
  if (ry > H) return 0
  const fy = ry % FLOOR_H
  const edge = lx === 0 || lz === 0 || lx === BW - 1 || lz === BW - 1
  const dmg = fbm3(x / 9, y / 9, z / 9, SEED + 30)
  const erosion = dmg + (ry / H) * 0.55 + ci.ruin * 0.25
  if (erosion > 1.03) return 0

  if (ry === 0) {                      // ground slab, sometimes collapsed into the basement
    if (ci.basement && dmg > 0.74) return 0
    return B.concrete_floor
  }
  if (ry === H) return fbm2(x / 5, z / 5, SEED + 31) > 0.6 ? B.grass : B.concrete_floor   // roof, gardens

  if (fy === 0) {                      // upper floor slabs
    const g = fbm2(x / 6, z / 6, SEED + 32)
    return g > 0.62 ? B.grass : g > 0.5 ? B.mossy_concrete : B.concrete_floor
  }
  if (edge) {
    const corner = (lx === 0 || lx === BW - 1) && (lz === 0 || lz === BW - 1)
    const windowRow = fy === 2 || fy === 3
    const along = (lx === 0 || lx === BW - 1) ? lz : lx      // position along this wall
    if (!corner && windowRow && (along % 4) !== 0) {
      const k = hash3(x, y, z, SEED + 33)
      return k < ci.glassy * 0.45 ? B.glass : 0
    }
    return ci.wall
  }
  if ((lx % 6) === 3 && (lz % 6) === 3) return B.concrete   // pillars
  if (fy === 1) {
    const k = hash3(x, y, z, SEED + 34)
    if (k < 0.012) return B.crate
    if (k < 0.022) return B.scrap
    if (k < 0.0235) return B.copper_ore   // exposed wiring! small bonus
  }
  return 0
}

function basementBlock(ci, lx, lz, y, x, z) {
  const ry = y - ci.gy           // -1 .. -6
  if (ry === -6) return B.concrete_floor
  const edge = lx === 0 || lz === 0 || lx === BW - 1 || lz === BW - 1
  if (edge) return fbm3(x / 7, y / 7, z / 7, SEED + 35) > 0.74 ? 0 : B.concrete
  if ((lx % 5) === 2 && (lz % 5) === 2) return B.concrete
  if (ci.flooded && ry <= -4) return B.water
  if (ry === -5 && hash3(x, y, z, SEED + 36) < 0.03) return B.crate
  return 0
}

export function generateChunk(data, x0, y0, z0, size) {
  // data: ndarray-like with .set(i,j,k,v). Returns count of solid voxels written.
  let any = false
  if (y0 > 140) return false

  // per-column info
  const cols = new Array(size * size)
  for (let i = 0; i < size; i++) {
    for (let k = 0; k < size; k++) {
      const x = x0 + i, z = z0 + k
      const h = heightAt(x, z)
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL)
      const lx = mod(x, CELL), lz = mod(z, CELL)
      const ci = cellInfo(cx, cz)
      const city = cityness(x, z)
      const road = (lx < ROAD || lz < ROAD) && city > 0.04
      const side = !road && city > 0.04 && (lx < ROAD + 2 || lz < ROAD + 2 || lx >= CELL - 1 || lz >= CELL - 1)
      let bx = -1, bz = -1, top = h
      if (ci.exists) {
        bx = lx - (ROAD + 2); bz = lz - (ROAD + 2)
        if (bx >= 0 && bx < BW && bz >= 0 && bz < BW) top = Math.max(h, ci.gy + ci.H)
        else { bx = -1 }
      }
      const og = overgrowth(x, z)
      cols[i * size + k] = { x, z, h, ci, lx, lz, road, side, bx, bz, top, og, city }
    }
  }

  for (let i = 0; i < size; i++) {
    for (let k = 0; k < size; k++) {
      const c = cols[i * size + k]
      const { x, z, h, ci, lx, lz, road, side, bx, bz, og, city } = c
      const inB = bx >= 0
      const yTop = Math.min(y0 + size - 1, Math.max(c.top, h) + 1)
      const yBot = y0
      for (let y = yBot; y <= yTop; y++) {
        let id = 0
        if (y <= BED) id = B.bedrock
        else if (inB && y >= ci.gy - 6 && y <= ci.gy + ci.H && (y > ci.gy ? true : (y === ci.gy || ci.basement))) {
          // inside a building's volume (above ground or in its basement)
          if (y < ci.gy) id = basementBlock(ci, bx, bz, y, x, z)
          else id = buildingBlock(ci, bx, bz, y, x, z)
          if (id === 0 && y < ci.gy - 6) id = B.stone
        } else if (y <= h) {
          // natural / ground
          const depth = h - y
          if (y === h) {
            if (road) id = og > 0.72 ? (og > 0.85 ? B.grass : B.dirt) : (lz === 2 || lx === 2) && ((lx + lz) % 6 < 3) ? B.road_line : B.asphalt
            else if (side) id = og > 0.62 ? B.grass : B.pavement
            else id = og > 0.3 || city < 0.3 ? B.grass : B.dirt
          } else if (depth <= 3) id = (city > 0.04 && (road || side) && depth === 1) ? B.concrete : B.dirt
          else id = B.stone
          if (id === B.stone) {
            // ore
            const ore = fbm3(x / 5, y / 5, z / 5, SEED + 40)
            if (ore > 0.78 && depth > 6) id = y < -12 && fbm3(x / 4, y / 4, z / 4, SEED + 41) > 0.7 ? B.gold_ore : B.copper_ore
            // caves
            if (depth > 4 && y > BED + 2) {
              const cv = fbm3(x / 14, y / 10, z / 14, SEED + 42)
              if (cv > 0.66 || (Math.abs(fbm3(x / 22, y / 14, z / 22, SEED + 43) - 0.5) < 0.025)) id = y < -20 && fbm3(x / 30, y / 30, z / 30, SEED + 44) > 0.6 ? B.water : 0
            }
          }
          // subway tunnels under the core road grid
          if (ci.core && (lx <= ROAD - 1 || lz <= ROAD - 1) && y >= GY - 11 && y <= GY - 5) {
            const airX = lx >= 1 && lx <= ROAD - 2, airZ = lz >= 1 && lz <= ROAD - 2
            const inAir = (lx <= ROAD - 1 && airX) || (lz <= ROAD - 1 && airZ)
            const cave = fbm2(x / 20, z / 20, SEED + 45) > 0.78
            if (y === GY - 11 || y === GY - 5) id = B.concrete_floor
            else if (inAir) id = cave ? B.rubble : (y <= GY - 9 && fbm2(x / 60, z / 60, SEED + 46) > 0.55 ? B.water : 0)
            else id = B.concrete
          }
        }
        if (id) { data.set(i, y - y0, k, id); any = true }
      }

      // building exterior details: hanging vines
      if (!inB && ci.exists) {
        const dx = lx - (ROAD + 2), dz = lz - (ROAD + 2)
        const ring = (dx === -1 || dx === BW) && dz >= -1 && dz <= BW || (dz === -1 || dz === BW) && dx >= -1 && dx <= BW
        if (ring && hash3(x, 0, z, SEED + 50) < 0.38) {
          const len = 3 + Math.floor(hash3(x, 1, z, SEED + 51) * Math.min(ci.H - 2, 28) * og)
          for (let r = 1; r <= len; r++) {
            const y = ci.gy + r
            if (y < y0 || y >= y0 + size) continue
            if (data.get(i, y - y0, k) === 0) { data.set(i, y - y0, k, B.vines); any = true }
          }
        }
      }
    }
  }

  // ---- trees (stamped, may straddle chunk borders) ----
  const pad = 8
  const g0x = Math.floor((x0 - pad) / TREE_GRID), g1x = Math.floor((x0 + size + pad) / TREE_GRID)
  const g0z = Math.floor((z0 - pad) / TREE_GRID), g1z = Math.floor((z0 + size + pad) / TREE_GRID)
  for (let gx = g0x; gx <= g1x; gx++) {
    for (let gz = g0z; gz <= g1z; gz++) {
      const t = treeAt(gx, gz)
      if (!t) continue
      if (t.y + t.H + t.R + 1 < y0 || t.y - 1 >= y0 + size) continue
      const put = (wx, wy, wz, id, over) => {
        const i = wx - x0, j = wy - y0, k = wz - z0
        if (i < 0 || j < 0 || k < 0 || i >= size || j >= size || k >= size) return
        const cur = data.get(i, j, k)
        if (cur === 0 || (over && cur === B.vines)) { data.set(i, j, k, id); any = true }
      }
      const trunk = t.emergent ? 2 : 1
      for (let yy = 1; yy <= t.H; yy++) {
        for (let a = 0; a < trunk; a++) for (let b = 0; b < trunk; b++) put(t.x + a, t.y + yy, t.z + b, B.log)
      }
      // buttress roots
      if (t.emergent) for (const [a, b] of [[-1, 0], [2, 0], [0, -1], [0, 2]]) { put(t.x + a, t.y + 1, t.z + b, B.log); put(t.x + a, t.y + 2, t.z + b, B.log) }
      const cy = t.y + t.H
      const R = t.R
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) for (let c = -2; c <= 2; c++) {
        const d = (a * a + b * b) / (R * R) + (c * c) / 5.5
        if (d <= 1 && hash3(t.x + a, cy + c, t.z + b, SEED + 60) < 0.88) put(t.x + a, cy + c, t.z + b, B.leaves)
      }
      // hanging vines from the canopy
      for (let v = 0; v < 5; v++) {
        const a = Math.floor((hash3(t.x, v, t.z, SEED + 61) - 0.5) * 2 * R)
        const b = Math.floor((hash3(t.x, v, t.z, SEED + 62) - 0.5) * 2 * R)
        const len = 3 + Math.floor(hash3(t.x, v, t.z, SEED + 63) * 9)
        for (let r = 1; r <= len; r++) put(t.x + a, cy - 2 - r, t.z + b, B.vines)
      }
    }
  }
  return any
}
