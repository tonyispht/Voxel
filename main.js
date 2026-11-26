import { Engine } from 'noa-engine'
import { registerBlocks, B } from './blocks.js'
import { buildTextures } from './textures.js'
import { generateChunk, GY } from './worldgen.js'
import { initGame } from './game.js'
import { initTouch } from './touch.js'

const noa = new Engine({
  debug: false,
  showFPS: true,
  chunkSize: 32,
  chunkAddDistance: [3.2, 2.2],
  chunkRemoveDistance: [4, 3],
  // start above the central road crossing
  playerStart: [2.5, GY + 4, 2.5],
  playerHeight: 1.8,
  playerWidth: 0.6,
  playerAutoStep: true,
  blockTestDistance: 14,
  stickyPointerLock: true,
})

const AVG = buildTextures(noa)
registerBlocks(noa)

noa.world.on('worldDataNeeded', (id, data, x, y, z) => {
  // pooled arrays may hold stale data, so start from a clean slate
  if (data.data && data.data.fill) data.data.fill(0)
  const any = generateChunk(data, x, y, z, data.shape[0])
  if (any) noa.world.setChunkData(id, data)
  else noa.world.setChunkData(id, data, undefined, 0)   // all air: cheap path
})

// misty jungle atmosphere (game.js animates the colour when underground)
const scene = noa.rendering.getScene()
scene.fogMode = 2   // exponential squared
scene.fogDensity = 0.0065

const game = initGame(noa, AVG)
initTouch(noa)
const boot = document.getElementById('boot')
if (boot) boot.remove()

// handy for poking around in the console
window.noa = noa
window.game = game
window.B = B
