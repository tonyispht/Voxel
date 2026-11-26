# Overgrown

A voxel sandbox built on [noa-engine](https://github.com/fenomas/noa) (Babylon.js). Explore a modern
city that was abandoned long ago and swallowed by jungle. Dig anywhere, blow up anything.

## Run it

```bash
npm install
npm run dev      # then open the printed localhost URL
```

Click the canvas to capture the mouse.

## Controls

| Input | Action |
|---|---|
| WASD / mouse | Move / look |
| Space | Jump. Hold it in mid-air for the jetpack |
| Shift | Sprint |
| Hold LMB | Dig (a progress bar shows under the crosshair) |
| RMB | Place the selected block |
| R or 1-9 | Cycle / pick block |
| T | Plant and light TNT where you aim (2.2 s fuse, chain-reacts) |
| M | Toggle **Sandbox** / **Career** |
| B | Sandbox: dig radius 0-4 |
| V | Sandbox: blast radius 3 / 5 / 8 / 12 |
| U | Career: open the salvage shop (1-5 to buy) |

## Modes

- **Sandbox**: everything unlocked, infinite TNT and fuel, fast digging. Score is optional bragging rights.
- **Career**: digging pays credits (ores, scrap, crates and metal are worth the most). Spend them on
  pickaxe power, dig radius, TNT blast radius, jetpack fuel/thrust, and TNT stock. Progress is saved in
  `localStorage`.

## The world

Everything is generated from a seed, with no assets (textures are drawn on a canvas at startup).

- A flat city core (grid of roads, sidewalks, towers up to 15+ floors) that fades into hilly jungle.
- Buildings are ruined from the top down: eroded walls, broken glass, collapsed floors, mossy concrete,
  rooftop gardens, hanging vines. Crates, scrap and exposed copper are scattered inside.
- Basements and a **subway grid** under the core roads. Some tunnels are flooded or caved in.
- Underground: stone, caves, copper (shallow) and gold (deep), then unbreakable bedrock.
- Jungle trees everywhere, including towering emergents.

## Destruction

- Dig radius and TNT blasts are sphere-shaped, and big blasts are spread over several ticks.
- **Structural collapse**: anything no longer connected to the ground falls. Small pieces fall as a rigid
  body and shatter into rubble. Whole towers cut off at the base crumble from the bottom up.
  Trees and buildings don't hold each other up, so cutting a trunk drops the canopy, and a gutted
  tower won't hang in the air on its vines.

## Files

| File | What |
|---|---|
| `main.js` | Engine setup, chunk generation hook |
| `worldgen.js` | Terrain, city, buildings, subway, caves, ore, trees (pure functions, no engine) |
| `blocks.js` | Block definitions (hardness, value) and registration |
| `textures.js` | Procedural 64px block textures |
| `structure.js` | Support / collapse logic (engine-free) |
| `game.js` | Digging, TNT, particles, jetpack, upgrades, HUD |

## Tuning knobs

- `worldgen.js`: `CELL`, `ROAD`, `BW`, `CORE_R` (city layout), `SEED`, `overgrowth()` (how green the city is)
- `main.js`: `chunkAddDistance` (view distance vs. performance)
- `game.js`: `SANDBOX`, `UPGRADES` (balance), `queue` drain rate (blast smoothness)
