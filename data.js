/*
 * Game data for Idle Planet Miner, ported from profit.py.
 *
 * This is the source of truth for the entity graph. Entities that are still
 * commented out in profit.py (higher tiers the player has not reached yet) are
 * included here with `unlockedByDefault: false` so they can be switched on from
 * the UI as the player progresses.
 *
 * `sellPrice` is a single directly-editable field — it is no longer derived
 * from a base price and a star rating. The values here are seeded from profit.py's old
 * `base * (1 + 0.2 * stars) * categoryBonus` formula, rounded to 3 significant
 * figures; the player corrects individual ones in the UI.
 *
 * Do not mutate these objects at runtime — user edits live in a separate
 * overrides layer (see app.js).
 */

const DEFAULT_ENTITIES = [
  // ---------------------------------------------------------------- Ores ----
  { id: "copper-ore",   name: "Copper Ore",   category: "ore", sellPrice: 1.4,     smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "iron-ore",     name: "Iron Ore",     category: "ore", sellPrice: 4,       smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "lead-ore",     name: "Lead Ore",     category: "ore", sellPrice: 5.6,     smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "silicon-ore",  name: "Silicon Ore",  category: "ore", sellPrice: 11.2,    smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "aluminum-ore", name: "Aluminum Ore", category: "ore", sellPrice: 30.6,    smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "silver-ore",   name: "Silver Ore",   category: "ore", sellPrice: 43.2,    smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "gold-ore",     name: "Gold Ore",     category: "ore", sellPrice: 120,     smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "diamond-ore",  name: "Diamond Ore",  category: "ore", sellPrice: 224,     smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "platinum-ore", name: "Platinum Ore", category: "ore", sellPrice: 816,     smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "titanium-ore", name: "Titanium Ore", category: "ore", sellPrice: 1310,    smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "iridium-ore",  name: "Iridium Ore",  category: "ore", sellPrice: 2560,    smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "palladium-ore", name: "Palladium Ore", category: "ore", sellPrice: 7000,    smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "osmium-ore",   name: "Osmium Ore",   category: "ore", sellPrice: 9360,    smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "rhodium",      name: "Rhodium",      category: "ore", sellPrice: 17500,   smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "inerton",      name: "Inerton",      category: "ore", sellPrice: 40000,   smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "quadium",      name: "Quadium",      category: "ore", sellPrice: 92000,   smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "scrith",       name: "Scrith",       category: "ore", sellPrice: 215000,  smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "uru",          name: "Uru",          category: "ore", sellPrice: 510000,  smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "vibranium",    name: "Vibranium",    category: "ore", sellPrice: 1250000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "aether",       name: "Aether",       category: "ore", sellPrice: 3200000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "viterium",     name: "Viterium",     category: "ore", sellPrice: 9000000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "xynium",       name: "Xynium",       category: "ore", sellPrice: 28000000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "quolium",      name: "Quolium",      category: "ore", sellPrice: 90000000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "luterium",     name: "Luterium",     category: "ore", sellPrice: 300000000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "wraith",       name: "Wraith",       category: "ore", sellPrice: 1100000000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "aqualite",     name: "Aqualite",     category: "ore", sellPrice: 4300000000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "opalite",      name: "Opalite",      category: "ore", sellPrice: 18000000000, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },

  // -------------------------------------------------------------- Alloys ----
  { id: "copper-bar",    name: "Copper Bar",    category: "alloy", sellPrice: 3150,    smeltTimeSeconds: 5,   unlockedByDefault: true,  ingredients: [{ sellableId: "copper-ore", amount: 560 }] },
  { id: "iron-bar",      name: "Iron Bar",      category: "alloy", sellPrice: 14300,   smeltTimeSeconds: 8,   unlockedByDefault: true,  ingredients: [{ sellableId: "iron-ore", amount: 560 }] },
  { id: "lead-bar",      name: "Lead Bar",      category: "alloy", sellPrice: 26500,   smeltTimeSeconds: 11,  unlockedByDefault: true,  ingredients: [{ sellableId: "lead-ore", amount: 560 }] },
  { id: "silicon-bar",   name: "Silicon Bar",   category: "alloy", sellPrice: 48900,   smeltTimeSeconds: 17,  unlockedByDefault: true,  ingredients: [{ sellableId: "silicon-ore", amount: 560 }] },
  { id: "aluminum-bar",  name: "Aluminum Bar",  category: "alloy", sellPrice: 83900,   smeltTimeSeconds: 23,  unlockedByDefault: true,  ingredients: [{ sellableId: "aluminum-ore", amount: 560 }] },
  { id: "silver-bar",    name: "Silver Bar",    category: "alloy", sellPrice: 235000,  smeltTimeSeconds: 35,  unlockedByDefault: true,  ingredients: [{ sellableId: "silver-ore", amount: 560 }] },
  { id: "gold-bar",      name: "Gold Bar",      category: "alloy", sellPrice: 625000,  smeltTimeSeconds: 52,  unlockedByDefault: true,  ingredients: [{ sellableId: "gold-ore", amount: 560 }] },
  { id: "bronze-bar",    name: "Bronze Bar",    category: "alloy", sellPrice: 610000,  smeltTimeSeconds: 70,  unlockedByDefault: true,  ingredients: [{ sellableId: "silver-bar", amount: 1 }, { sellableId: "copper-bar", amount: 6 }] },
  { id: "steel-bar",     name: "Steel Bar",     category: "alloy", sellPrice: 1030000, smeltTimeSeconds: 140, unlockedByDefault: true,  ingredients: [{ sellableId: "lead-bar", amount: 8 }, { sellableId: "iron-bar", amount: 17 }] },
  { id: "platinum-bar",  name: "Platinum Bar",  category: "alloy", sellPrice: 3050000, smeltTimeSeconds: 175, unlockedByDefault: true,  ingredients: [{ sellableId: "gold-bar", amount: 1 }, { sellableId: "platinum-ore", amount: 560 }] },
  { id: "titanium-bar",  name: "Titanium Bar",  category: "alloy", sellPrice: 7790000, smeltTimeSeconds: 210, unlockedByDefault: true,  ingredients: [{ sellableId: "bronze-bar", amount: 1 }, { sellableId: "titanium-ore", amount: 560 }] },
  { id: "iridium-bar",   name: "Iridium Bar",   category: "alloy", sellPrice: 8100000, smeltTimeSeconds: 245, unlockedByDefault: true,  ingredients: [{ sellableId: "steel-bar", amount: 1 }, { sellableId: "iridium-ore", amount: 560 }] },
  { id: "palladium-bar", name: "Palladium Bar", category: "alloy", sellPrice: 18200000, smeltTimeSeconds: 280, unlockedByDefault: true,  ingredients: [{ sellableId: "platinum-bar", amount: 1 }, { sellableId: "palladium-ore", amount: 560 }] },
  { id: "osmium-bar",    name: "Osmium Bar",    category: "alloy", sellPrice: 56700000, smeltTimeSeconds: 315, unlockedByDefault: true,  ingredients: [{ sellableId: "titanium-bar", amount: 1 }, { sellableId: "osmium-ore", amount: 560 }] },
  { id: "rhodium-bar",   name: "Rhodium Bar",   category: "alloy", sellPrice: 94200000, smeltTimeSeconds: 350, unlockedByDefault: true,  ingredients: [{ sellableId: "iridium-bar", amount: 1 }, { sellableId: "rhodium", amount: 560 }] },
  { id: "inerton-alloy", name: "Inerton Alloy", category: "alloy", sellPrice: 207000000, smeltTimeSeconds: 420, unlockedByDefault: true,  ingredients: [{ sellableId: "palladium-bar", amount: 1 }, { sellableId: "inerton", amount: 560 }] },
  { id: "quadium-alloy",   name: "Quadium Alloy",   category: "alloy", sellPrice: 330000000, smeltTimeSeconds: 1680, unlockedByDefault: false, ingredients: [{ sellableId: "osmium-bar", amount: 2 }, { sellableId: "quadium", amount: 1000 }] },
  { id: "scrith-alloy",    name: "Scrith Alloy",    category: "alloy", sellPrice: 764000000, smeltTimeSeconds: 1920, unlockedByDefault: false, ingredients: [{ sellableId: "rhodium-bar", amount: 2 }, { sellableId: "scrith", amount: 1000 }] },
  { id: "uru-alloy",       name: "Uru Alloy",       category: "alloy", sellPrice: 1810000000, smeltTimeSeconds: 2160, unlockedByDefault: false, ingredients: [{ sellableId: "inerton-alloy", amount: 2 }, { sellableId: "uru", amount: 1000 }] },
  { id: "vibranium-alloy", name: "Vibranium Alloy", category: "alloy", sellPrice: 4450000000, smeltTimeSeconds: 2400, unlockedByDefault: false, ingredients: [{ sellableId: "quadium-alloy", amount: 2 }, { sellableId: "vibranium", amount: 1000 }] },
  { id: "aether-alloy",    name: "Aether Alloy",    category: "alloy", sellPrice: 11100000000, smeltTimeSeconds: 2640, unlockedByDefault: false, ingredients: [{ sellableId: "scrith-alloy", amount: 2 }, { sellableId: "aether", amount: 1000 }] },
  { id: "viterium-alloy",  name: "Viterium Alloy",  category: "alloy", sellPrice: 33700000000, smeltTimeSeconds: 2880, unlockedByDefault: false, ingredients: [{ sellableId: "uru-alloy", amount: 2 }, { sellableId: "viterium", amount: 1000 }] },
  { id: "xynium-alloy",    name: "Xynium Alloy",    category: "alloy", sellPrice: 104000000000, smeltTimeSeconds: 3300, unlockedByDefault: false, ingredients: [{ sellableId: "vibranium-alloy", amount: 5 }, { sellableId: "xynium", amount: 1500 }] },
  { id: "quolium-alloy",   name: "Quolium Alloy",   category: "alloy", sellPrice: 347000000000, smeltTimeSeconds: 3720, unlockedByDefault: false, ingredients: [{ sellableId: "aether-alloy", amount: 5 }, { sellableId: "quolium", amount: 1500 }] },
  { id: "luterium-alloy",  name: "Luterium Alloy",  category: "alloy", sellPrice: 1300000000000, smeltTimeSeconds: 4140, unlockedByDefault: false, ingredients: [{ sellableId: "viterium-alloy", amount: 5 }, { sellableId: "luterium", amount: 1500 }] },
  { id: "wraith-alloy",    name: "Wraith Alloy",    category: "alloy", sellPrice: 5210000000000, smeltTimeSeconds: 4560, unlockedByDefault: false, ingredients: [{ sellableId: "xynium-alloy", amount: 5 }, { sellableId: "wraith", amount: 1500 }] },
  { id: "aqualite-alloy",  name: "Aqualite Alloy",  category: "alloy", sellPrice: 38000000000000, smeltTimeSeconds: 4980, unlockedByDefault: false, ingredients: [{ sellableId: "quolium-alloy", amount: 5 }, { sellableId: "aqualite", amount: 1500 }] },
  { id: "opalite-alloy",   name: "Opalite Alloy",   category: "alloy", sellPrice: 602000000000000, smeltTimeSeconds: 5520, unlockedByDefault: false, ingredients: [{ sellableId: "wraith-alloy", amount: 5 }, { sellableId: "opalite", amount: 1500 }] },

  // --------------------------------------------------------------- Items ----
  { id: "copper-wire",       name: "Copper Wire",       category: "item", sellPrice: 25300,   smeltTimeSeconds: 14,   unlockedByDefault: true, ingredients: [{ sellableId: "copper-bar", amount: 2 }] },
  { id: "iron-nails",        name: "Iron Nails",        category: "item", sellPrice: 57900,   smeltTimeSeconds: 29,   unlockedByDefault: true, ingredients: [{ sellableId: "iron-bar", amount: 2 }] },
  { id: "battery",           name: "Battery",           category: "item", sellPrice: 152000,  smeltTimeSeconds: 58,   unlockedByDefault: true, ingredients: [{ sellableId: "copper-wire", amount: 1 }, { sellableId: "copper-bar", amount: 4 }] },
  { id: "hammer",            name: "Hammer",            category: "item", sellPrice: 391000,  smeltTimeSeconds: 116,  unlockedByDefault: true, ingredients: [{ sellableId: "iron-nails", amount: 1 }, { sellableId: "lead-bar", amount: 2 }] },
  { id: "glass",             name: "Glass",             category: "item", sellPrice: 796000,  smeltTimeSeconds: 175,  unlockedByDefault: true, ingredients: [{ sellableId: "silicon-bar", amount: 4 }] },
  { id: "circuit",           name: "Circuit",           category: "item", sellPrice: 1350000, smeltTimeSeconds: 292,  unlockedByDefault: true, ingredients: [{ sellableId: "silicon-bar", amount: 2 }, { sellableId: "aluminum-bar", amount: 2 }, { sellableId: "copper-wire", amount: 4 }] },
  { id: "lens",              name: "Lens",              category: "item", sellPrice: 3580000, smeltTimeSeconds: 584,  unlockedByDefault: true, ingredients: [{ sellableId: "glass", amount: 1 }, { sellableId: "silver-bar", amount: 2 }] },
  { id: "laser",             name: "Laser",             category: "item", sellPrice: 9270000, smeltTimeSeconds: 877,  unlockedByDefault: true, ingredients: [{ sellableId: "gold-bar", amount: 2 }, { sellableId: "lens", amount: 1 }, { sellableId: "iron-bar", amount: 4 }] },
  { id: "basic-computer",    name: "Basic Computer",    category: "item", sellPrice: 22000000, smeltTimeSeconds: 1169, unlockedByDefault: true, ingredients: [{ sellableId: "circuit", amount: 2 }, { sellableId: "silver-bar", amount: 2 }] },
  { id: "solar-panel",       name: "Solar Panel",       category: "item", sellPrice: 31700000, smeltTimeSeconds: 1462, unlockedByDefault: true, ingredients: [{ sellableId: "circuit", amount: 2 }, { sellableId: "glass", amount: 4 }] },
  { id: "laser-torch",       name: "Laser Torch",       category: "item", sellPrice: 89800000, smeltTimeSeconds: 1754, unlockedByDefault: true, ingredients: [{ sellableId: "bronze-bar", amount: 2 }, { sellableId: "laser", amount: 1 }, { sellableId: "lens", amount: 2 }] },
  { id: "advanced-battery",  name: "Advanced Battery",  category: "item", sellPrice: 101000000, smeltTimeSeconds: 2193, unlockedByDefault: true, ingredients: [{ sellableId: "steel-bar", amount: 9 }, { sellableId: "battery", amount: 13 }] },
  { id: "thermal-scanner",   name: "Thermal Scanner",   category: "item", sellPrice: 181000000, smeltTimeSeconds: 2631, unlockedByDefault: true, ingredients: [{ sellableId: "platinum-bar", amount: 2 }, { sellableId: "laser", amount: 1 }, { sellableId: "glass", amount: 2 }] },
  { id: "advanced-computer", name: "Advanced Computer", category: "item", sellPrice: 391000000, smeltTimeSeconds: 3070, unlockedByDefault: true, ingredients: [{ sellableId: "titanium-bar", amount: 2 }, { sellableId: "basic-computer", amount: 2 }] },
  { id: "navigation-module", name: "Navigation Module", category: "item", sellPrice: 2530000000, smeltTimeSeconds: 3289, unlockedByDefault: true, ingredients: [{ sellableId: "thermal-scanner", amount: 1 }, { sellableId: "laser-torch", amount: 1 }] },
  { id: "plasma-torch",      name: "Plasma Torch",      category: "item", sellPrice: 2080000000, smeltTimeSeconds: 3600, unlockedByDefault: true, ingredients: [{ sellableId: "iridium-bar", amount: 6 }, { sellableId: "laser-torch", amount: 2 }] },
  { id: "radio-tower",       name: "Radio Tower",       category: "item", sellPrice: 2620000000, smeltTimeSeconds: 3780, unlockedByDefault: true, ingredients: [{ sellableId: "platinum-bar", amount: 32 }, { sellableId: "aluminum-bar", amount: 65 }, { sellableId: "titanium-bar", amount: 22 }] },
  { id: "telescope",         name: "Telescope",         category: "item", sellPrice: 5860000000, smeltTimeSeconds: 4020, unlockedByDefault: true, ingredients: [{ sellableId: "lens", amount: 9 }, { sellableId: "advanced-computer", amount: 1 }] },
  { id: "satellite-dish",    name: "Satellite Dish",    category: "item", sellPrice: 6150000000, smeltTimeSeconds: 4320, unlockedByDefault: true, ingredients: [{ sellableId: "steel-bar", amount: 65 }, { sellableId: "palladium-bar", amount: 13 }] },
  { id: "motor",             name: "Motor",             category: "item", sellPrice: 12700000000, smeltTimeSeconds: 4620, unlockedByDefault: true, ingredients: [{ sellableId: "bronze-bar", amount: 216 }, { sellableId: "hammer", amount: 86 }] },
  { id: "accumulator",          name: "Accumulator",          category: "item", sellPrice: 21700000000, smeltTimeSeconds: 20400,  unlockedByDefault: false, ingredients: [{ sellableId: "osmium-bar", amount: 20 }, { sellableId: "advanced-battery", amount: 3 }] },
  { id: "nuclear-capsule",      name: "Nuclear Capsule",      category: "item", sellPrice: 47000000000, smeltTimeSeconds: 21000,  unlockedByDefault: false, ingredients: [{ sellableId: "rhodium-bar", amount: 5 }, { sellableId: "plasma-torch", amount: 1 }] },
  { id: "wind-turbine",         name: "Wind Turbine",         category: "item", sellPrice: 253000000000, smeltTimeSeconds: 21600,  unlockedByDefault: false, ingredients: [{ sellableId: "aluminum-bar", amount: 300 }, { sellableId: "motor", amount: 1 }] },
  { id: "space-probe",          name: "Space Probe",          category: "item", sellPrice: 326000000000, smeltTimeSeconds: 22200,  unlockedByDefault: false, ingredients: [{ sellableId: "satellite-dish", amount: 1 }, { sellableId: "telescope", amount: 1 }, { sellableId: "solar-panel", amount: 25 }] },
  { id: "nuclear-reactor",      name: "Nuclear Reactor",      category: "item", sellPrice: 1810000000000, smeltTimeSeconds: 22800,  unlockedByDefault: false, ingredients: [{ sellableId: "nuclear-capsule", amount: 1 }, { sellableId: "iridium-bar", amount: 300 }] },
  { id: "collider",             name: "Collider",             category: "item", sellPrice: 3620000000000, smeltTimeSeconds: 23100,  unlockedByDefault: false, ingredients: [{ sellableId: "inerton-alloy", amount: 500 }, { sellableId: "quadium-alloy", amount: 100 }] },
  { id: "gravity-chamber",      name: "Gravity Chamber",      category: "item", sellPrice: 27100000000000, smeltTimeSeconds: 24300,  unlockedByDefault: false, ingredients: [{ sellableId: "advanced-computer", amount: 60 }, { sellableId: "nuclear-reactor", amount: 1 }] },
  { id: "robot",                name: "Robot",                category: "item", sellPrice: 90500000000000, smeltTimeSeconds: 26000,  unlockedByDefault: false, ingredients: [{ sellableId: "scrith-alloy", amount: 300 }, { sellableId: "accumulator", amount: 90 }] },
  { id: "fusion-capsule",       name: "Fusion Capsule",       category: "item", sellPrice: 434000000000000, smeltTimeSeconds: 27000,  unlockedByDefault: false, ingredients: [{ sellableId: "uru-alloy", amount: 200 }, { sellableId: "vibranium-alloy", amount: 100 }, { sellableId: "nuclear-capsule", amount: 100 }] },
  { id: "teleporter",           name: "Teleporter",           category: "item", sellPrice: 3260000000000000, smeltTimeSeconds: 29000,  unlockedByDefault: false, ingredients: [{ sellableId: "navigation-module", amount: 250 }, { sellableId: "gravity-chamber", amount: 1 }] },
  { id: "fusion-reactor",       name: "Fusion Reactor",       category: "item", sellPrice: 72400000000000000, smeltTimeSeconds: 31000,  unlockedByDefault: false, ingredients: [{ sellableId: "fusion-capsule", amount: 1 }, { sellableId: "collider", amount: 40 }, { sellableId: "nuclear-reactor", amount: 50 }] },
  { id: "subspace-relay",       name: "Subspace Relay",       category: "item", sellPrice: 1810000000000000000, smeltTimeSeconds: 32300,  unlockedByDefault: false, ingredients: [{ sellableId: "space-probe", amount: 70 }, { sellableId: "satellite-dish", amount: 100 }, { sellableId: "teleporter", amount: 1 }] },
  { id: "advanced-robot",       name: "Advanced Robot",       category: "item", sellPrice: 53400000000000000000, smeltTimeSeconds: 62300,  unlockedByDefault: false, ingredients: [{ sellableId: "robot", amount: 100 }, { sellableId: "fusion-reactor", amount: 5 }] },
  { id: "advanced-teleporter",  name: "Advanced Teleporter",  category: "item", sellPrice: 1180000000000000000000, smeltTimeSeconds: 115200, unlockedByDefault: false, ingredients: [{ sellableId: "subspace-relay", amount: 5 }, { sellableId: "teleporter", amount: 100 }, { sellableId: "xynium-alloy", amount: 1000 }] },
  { id: "quantum-cpu",          name: "Quantum CPU",          category: "item", sellPrice: 25300000000000000000000, smeltTimeSeconds: 120000, unlockedByDefault: false, ingredients: [{ sellableId: "advanced-robot", amount: 4 }, { sellableId: "quolium-alloy", amount: 500 }] },
  { id: "deflector-shield",     name: "Deflector Shield",     category: "item", sellPrice: 579000000000000000000000, smeltTimeSeconds: 125000, unlockedByDefault: false, ingredients: [{ sellableId: "advanced-teleporter", amount: 4 }, { sellableId: "luterium-alloy", amount: 400 }] },
  { id: "warp-core",            name: "Warp Core",            category: "item", sellPrice: 12300000000000000000000000, smeltTimeSeconds: 180000, unlockedByDefault: false, ingredients: [{ sellableId: "wind-turbine", amount: 160 }, { sellableId: "fusion-reactor", amount: 40 }, { sellableId: "quantum-cpu", amount: 4 }] },
  { id: "deep-space-scanner",   name: "Deep Space Scanner",   category: "item", sellPrice: 262000000000000000000000000, smeltTimeSeconds: 188000, unlockedByDefault: false, ingredients: [{ sellableId: "advanced-battery", amount: 250 }, { sellableId: "aqualite-alloy", amount: 1000 }, { sellableId: "deflector-shield", amount: 4 }] },
  { id: "antimatter-cell",      name: "Antimatter Cell",      category: "item", sellPrice: 5790000000000000000000000000, smeltTimeSeconds: 194000, unlockedByDefault: false, ingredients: [{ sellableId: "nuclear-reactor", amount: 50 }, { sellableId: "palladium-bar", amount: 10000 }, { sellableId: "warp-core", amount: 4 }] },
  { id: "atmospheric-processor", name: "Atmospheric Processor", category: "item", sellPrice: 123000000000000000000000000000, smeltTimeSeconds: 244000, unlockedByDefault: false, ingredients: [{ sellableId: "iridium-bar", amount: 10000 }, { sellableId: "deep-space-scanner", amount: 4 }, { sellableId: "quantum-cpu", amount: 15 }] },
  { id: "orbital-dock",         name: "Orbital Dock",         category: "item", sellPrice: 5070000000000000000000000000000, smeltTimeSeconds: 399000, unlockedByDefault: false, ingredients: [{ sellableId: "wraith-alloy", amount: 6000 }, { sellableId: "antimatter-cell", amount: 4 }, { sellableId: "warp-core", amount: 10 }] },
  { id: "solar-collector",      name: "Solar Collector",      category: "item", sellPrice: 5070000000000000000000000000000, smeltTimeSeconds: 399000, unlockedByDefault: false, ingredients: [{ sellableId: "solar-panel", amount: 1000 }, { sellableId: "deflector-shield", amount: 20 }, { sellableId: "deep-space-scanner", amount: 132 }] },
  { id: "phase-gate",           name: "Phase Gate",           category: "item", sellPrice: 818000000000000000000000000000000, smeltTimeSeconds: 699000, unlockedByDefault: false, ingredients: [{ sellableId: "deep-space-scanner", amount: 100 }, { sellableId: "advanced-teleporter", amount: 1000 }, { sellableId: "orbital-dock", amount: 1 }] },
  { id: "neural-matrix",        name: "Neural Matrix",        category: "item", sellPrice: 818000000000000000000000000000000, smeltTimeSeconds: 699000, unlockedByDefault: false, ingredients: [{ sellableId: "antimatter-cell", amount: 4 }, { sellableId: "solar-collector", amount: 1 }, { sellableId: "osmium-bar", amount: 16000 }] },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_ENTITIES };
}
