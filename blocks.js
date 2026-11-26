// Block definitions. IDs are assigned 1..N in order, so worldgen can import `B`
// without needing the engine.
//   hard  = seconds to break at tool power 1 (Infinity = unbreakable)
//   value = credits / score when destroyed

export const DEFS = [
  { name: 'asphalt',        mat: 'asphalt',                         hard: 2,   value: 1 },
  { name: 'road_line',      mat: ['road_line', 'dirt', 'asphalt'],  hard: 2,   value: 1 },
  { name: 'pavement',       mat: 'pavement',                        hard: 2,   value: 1 },
  { name: 'concrete',       mat: 'concrete',                        hard: 3,   value: 2 },
  { name: 'concrete_floor', mat: 'concrete_floor',                  hard: 2.5, value: 2 },
  { name: 'mossy_concrete', mat: 'mossy_concrete',                  hard: 2.5, value: 2 },
  { name: 'brick',          mat: 'brick',                           hard: 2.5, value: 3 },
  { name: 'metal',          mat: 'metal',                           hard: 5,   value: 6 },
  { name: 'glass',          mat: 'glass',                           hard: 0.2, value: 1, opaque: false },
  { name: 'dirt',           mat: 'dirt',                            hard: 0.5, value: 0 },
  { name: 'grass',          mat: ['grass_top', 'dirt', 'grass_side'], hard: 0.5, value: 0 },
  { name: 'stone',          mat: 'stone',                           hard: 2,   value: 1 },
  { name: 'bedrock',        mat: 'bedrock',                         hard: Infinity, value: 0 },
  { name: 'log',            mat: ['log_top', 'log_top', 'log_side'], hard: 1.5, value: 2 },
  { name: 'leaves',         mat: 'leaves',                          hard: 0.15, value: 0, opaque: false },
  { name: 'vines',          mat: 'vines',                           hard: 0.15, value: 1, opaque: false, solid: false },
  { name: 'water',          mat: 'water',                           hard: Infinity, value: 0, fluid: true, solid: false, opaque: false },
  { name: 'rubble',         mat: 'rubble',                          hard: 0.7, value: 0, gravity: true },
  { name: 'copper_ore',     mat: 'copper_ore',                      hard: 4,   value: 25 },
  { name: 'gold_ore',       mat: 'gold_ore',                        hard: 6,   value: 120 },
  { name: 'scrap',          mat: 'scrap',                           hard: 3,   value: 10 },
  { name: 'crate',          mat: 'crate',                           hard: 0.8, value: 15 },
  { name: 'tnt',            mat: 'tnt',                             hard: 0.3, value: 5 },
  { name: 'tnt_lit',        mat: 'tnt_lit',                         hard: 0.3, value: 0 },
]

export const B = {}
DEFS.forEach((d, i) => { d.id = i + 1; B[d.name] = d.id })

export function registerBlocks(noa) {
  for (const d of DEFS) {
    noa.registry.registerBlock(d.id, {
      material: d.mat,
      solid: d.solid !== false,
      opaque: d.opaque !== false,
      fluid: !!d.fluid,
      fluidDensity: 1.0,
      viscosity: 0.6,
    })
  }
}
