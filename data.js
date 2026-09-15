/*
 * Game data for Idle Planet Miner, ported from profit.py.
 *
 * This is the source of truth for the entity graph. Entities that are still
 * commented out in profit.py (higher tiers the player has not reached yet) are
 * included here with `unlockedByDefault: false` so they can be switched on from
 * the UI as the player progresses.
 *
 * `basePrice` is the one fixed, non-editable part of a sellable's price — it
 * comes straight from profit.py's `base_sell_price`. `stars` is the default
 * resource-star count (also from profit.py) but, unlike basePrice, is
 * per-player and editable in the UI. Sell price is not stored here at all: it
 * is computed at runtime from basePrice, stars, and the global bonus controls
 * (see model.js sellPriceParts and app.js).
 *
 * Do not mutate these objects at runtime — user edits live in a separate
 * overrides layer (see app.js).
 */

const DEFAULT_ENTITIES = [
  // ---------------------------------------------------------------- Ores ----
  { id: "copper-ore",   name: "Copper Ore",   category: "ore", basePrice: 1,       stars: 2, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "iron-ore",     name: "Iron Ore",     category: "ore", basePrice: 2,       stars: 5, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "lead-ore",     name: "Lead Ore",     category: "ore", basePrice: 4,       stars: 2, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "silicon-ore",  name: "Silicon Ore",  category: "ore", basePrice: 8,       stars: 2, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "aluminum-ore", name: "Aluminum Ore", category: "ore", basePrice: 17,      stars: 4, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "silver-ore",   name: "Silver Ore",   category: "ore", basePrice: 36,      stars: 1, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "gold-ore",     name: "Gold Ore",     category: "ore", basePrice: 75,      stars: 3, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "diamond-ore",  name: "Diamond Ore",  category: "ore", basePrice: 160,     stars: 2, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "platinum-ore", name: "Platinum Ore", category: "ore", basePrice: 340,     stars: 7, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "titanium-ore", name: "Titanium Ore", category: "ore", basePrice: 730,     stars: 4, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "iridium-ore",  name: "Iridium Ore",  category: "ore", basePrice: 1600,    stars: 3, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "palladium-ore", name: "Palladium Ore", category: "ore", basePrice: 3500,    stars: 5, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "osmium-ore",   name: "Osmium Ore",   category: "ore", basePrice: 7800,    stars: 1, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "rhodium",      name: "Rhodium",      category: "ore", basePrice: 17500,   stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "inerton",      name: "Inerton",      category: "ore", basePrice: 40000,   stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: true },
  { id: "quadium",      name: "Quadium",      category: "ore", basePrice: 92000,   stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "scrith",       name: "Scrith",       category: "ore", basePrice: 215000,  stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "uru",          name: "Uru",          category: "ore", basePrice: 510000,  stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "vibranium",    name: "Vibranium",    category: "ore", basePrice: 1250000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "aether",       name: "Aether",       category: "ore", basePrice: 3200000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "viterium",     name: "Viterium",     category: "ore", basePrice: 9000000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "xynium",       name: "Xynium",       category: "ore", basePrice: 28000000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "quolium",      name: "Quolium",      category: "ore", basePrice: 90000000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "luterium",     name: "Luterium",     category: "ore", basePrice: 300000000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "wraith",       name: "Wraith",       category: "ore", basePrice: 1100000000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "aqualite",     name: "Aqualite",     category: "ore", basePrice: 4300000000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },
  { id: "opalite",      name: "Opalite",      category: "ore", basePrice: 18000000000, stars: 0, smeltTimeSeconds: 0, ingredients: [], unlockedByDefault: false },

  // -------------------------------------------------------------- Alloys ----
  { id: "copper-bar",    name: "Copper Bar",    category: "alloy", basePrice: 1450,    stars: 0, smeltTimeSeconds: 5,   unlockedByDefault: true,  ingredients: [{ sellableId: "copper-ore", amount: 560 }] },
  { id: "iron-bar",      name: "Iron Bar",      category: "alloy", basePrice: 3000,    stars: 6, smeltTimeSeconds: 8,   unlockedByDefault: true,  ingredients: [{ sellableId: "iron-ore", amount: 560 }] },
  { id: "lead-bar",      name: "Lead Bar",      category: "alloy", basePrice: 6100,    stars: 5, smeltTimeSeconds: 11,  unlockedByDefault: true,  ingredients: [{ sellableId: "lead-ore", amount: 560 }] },
  { id: "silicon-bar",   name: "Silicon Bar",   category: "alloy", basePrice: 12500,   stars: 4, smeltTimeSeconds: 17,  unlockedByDefault: true,  ingredients: [{ sellableId: "silicon-ore", amount: 560 }] },
  { id: "aluminum-bar",  name: "Aluminum Bar",  category: "alloy", basePrice: 27600,   stars: 2, smeltTimeSeconds: 23,  unlockedByDefault: true,  ingredients: [{ sellableId: "aluminum-ore", amount: 560 }] },
  { id: "silver-bar",    name: "Silver Bar",    category: "alloy", basePrice: 60000,   stars: 4, smeltTimeSeconds: 35,  unlockedByDefault: true,  ingredients: [{ sellableId: "silver-ore", amount: 560 }] },
  { id: "gold-bar",      name: "Gold Bar",      category: "alloy", basePrice: 120000,  stars: 7, smeltTimeSeconds: 52,  unlockedByDefault: true,  ingredients: [{ sellableId: "gold-ore", amount: 560 }] },
  { id: "bronze-bar",    name: "Bronze Bar",    category: "alloy", basePrice: 234000,  stars: 1, smeltTimeSeconds: 70,  unlockedByDefault: true,  ingredients: [{ sellableId: "silver-bar", amount: 1 }, { sellableId: "copper-bar", amount: 6 }] },
  { id: "steel-bar",     name: "Steel Bar",     category: "alloy", basePrice: 340000,  stars: 2, smeltTimeSeconds: 140, unlockedByDefault: true,  ingredients: [{ sellableId: "lead-bar", amount: 8 }, { sellableId: "iron-bar", amount: 17 }] },
  { id: "platinum-bar",  name: "Platinum Bar",  category: "alloy", basePrice: 780000,  stars: 4, smeltTimeSeconds: 175, unlockedByDefault: true,  ingredients: [{ sellableId: "gold-bar", amount: 1 }, { sellableId: "platinum-ore", amount: 560 }] },
  { id: "titanium-bar",  name: "Titanium Bar",  category: "alloy", basePrice: 1630000, stars: 6, smeltTimeSeconds: 210, unlockedByDefault: true,  ingredients: [{ sellableId: "bronze-bar", amount: 1 }, { sellableId: "titanium-ore", amount: 560 }] },
  { id: "iridium-bar",   name: "Iridium Bar",   category: "alloy", basePrice: 3110000, stars: 1, smeltTimeSeconds: 245, unlockedByDefault: true,  ingredients: [{ sellableId: "steel-bar", amount: 1 }, { sellableId: "iridium-ore", amount: 560 }] },
  { id: "palladium-bar", name: "Palladium Bar", category: "alloy", basePrice: 7000000, stars: 1, smeltTimeSeconds: 280, unlockedByDefault: true,  ingredients: [{ sellableId: "platinum-bar", amount: 1 }, { sellableId: "palladium-ore", amount: 560 }] },
  { id: "osmium-bar",    name: "Osmium Bar",    category: "alloy", basePrice: 14500000, stars: 4, smeltTimeSeconds: 315, unlockedByDefault: true,  ingredients: [{ sellableId: "titanium-bar", amount: 1 }, { sellableId: "osmium-ore", amount: 560 }] },
  { id: "rhodium-bar",   name: "Rhodium Bar",   category: "alloy", basePrice: 31000000, stars: 2, smeltTimeSeconds: 350, unlockedByDefault: true,  ingredients: [{ sellableId: "iridium-bar", amount: 1 }, { sellableId: "rhodium", amount: 560 }] },
  { id: "inerton-alloy", name: "Inerton Alloy", category: "alloy", basePrice: 68000000, stars: 2, smeltTimeSeconds: 420, unlockedByDefault: true,  ingredients: [{ sellableId: "palladium-bar", amount: 1 }, { sellableId: "inerton", amount: 560 }] },
  { id: "quadium-alloy",   name: "Quadium Alloy",   category: "alloy", basePrice: 152000000, stars: 0, smeltTimeSeconds: 1680, unlockedByDefault: false, ingredients: [{ sellableId: "osmium-bar", amount: 2 }, { sellableId: "quadium", amount: 1000 }] },
  { id: "scrith-alloy",    name: "Scrith Alloy",    category: "alloy", basePrice: 352000000, stars: 0, smeltTimeSeconds: 1920, unlockedByDefault: false, ingredients: [{ sellableId: "rhodium-bar", amount: 2 }, { sellableId: "scrith", amount: 1000 }] },
  { id: "uru-alloy",       name: "Uru Alloy",       category: "alloy", basePrice: 832000000, stars: 0, smeltTimeSeconds: 2160, unlockedByDefault: false, ingredients: [{ sellableId: "inerton-alloy", amount: 2 }, { sellableId: "uru", amount: 1000 }] },
  { id: "vibranium-alloy", name: "Vibranium Alloy", category: "alloy", basePrice: 2050000000, stars: 0, smeltTimeSeconds: 2400, unlockedByDefault: false, ingredients: [{ sellableId: "quadium-alloy", amount: 2 }, { sellableId: "vibranium", amount: 1000 }] },
  { id: "aether-alloy",    name: "Aether Alloy",    category: "alloy", basePrice: 5120000000, stars: 0, smeltTimeSeconds: 2640, unlockedByDefault: false, ingredients: [{ sellableId: "scrith-alloy", amount: 2 }, { sellableId: "aether", amount: 1000 }] },
  { id: "viterium-alloy",  name: "Viterium Alloy",  category: "alloy", basePrice: 15500000000, stars: 0, smeltTimeSeconds: 2880, unlockedByDefault: false, ingredients: [{ sellableId: "uru-alloy", amount: 2 }, { sellableId: "viterium", amount: 1000 }] },
  { id: "xynium-alloy",    name: "Xynium Alloy",    category: "alloy", basePrice: 48000000000, stars: 0, smeltTimeSeconds: 3300, unlockedByDefault: false, ingredients: [{ sellableId: "vibranium-alloy", amount: 5 }, { sellableId: "xynium", amount: 1500 }] },
  { id: "quolium-alloy",   name: "Quolium Alloy",   category: "alloy", basePrice: 160000000000, stars: 0, smeltTimeSeconds: 3720, unlockedByDefault: false, ingredients: [{ sellableId: "aether-alloy", amount: 5 }, { sellableId: "quolium", amount: 1500 }] },
  { id: "luterium-alloy",  name: "Luterium Alloy",  category: "alloy", basePrice: 600000000000, stars: 0, smeltTimeSeconds: 4140, unlockedByDefault: false, ingredients: [{ sellableId: "viterium-alloy", amount: 5 }, { sellableId: "luterium", amount: 1500 }] },
  { id: "wraith-alloy",    name: "Wraith Alloy",    category: "alloy", basePrice: 2400000000000, stars: 0, smeltTimeSeconds: 4560, unlockedByDefault: false, ingredients: [{ sellableId: "xynium-alloy", amount: 5 }, { sellableId: "wraith", amount: 1500 }] },
  { id: "aqualite-alloy",  name: "Aqualite Alloy",  category: "alloy", basePrice: 17500000000000, stars: 0, smeltTimeSeconds: 4980, unlockedByDefault: false, ingredients: [{ sellableId: "quolium-alloy", amount: 5 }, { sellableId: "aqualite", amount: 1500 }] },
  { id: "opalite-alloy",   name: "Opalite Alloy",   category: "alloy", basePrice: 277000000000000, stars: 0, smeltTimeSeconds: 5520, unlockedByDefault: false, ingredients: [{ sellableId: "wraith-alloy", amount: 5 }, { sellableId: "opalite", amount: 1500 }] },

  // --------------------------------------------------------------- Items ----
  { id: "copper-wire",       name: "Copper Wire",       category: "item", basePrice: 10000,   stars: 2, smeltTimeSeconds: 14,   unlockedByDefault: true, ingredients: [{ sellableId: "copper-bar", amount: 2 }] },
  { id: "iron-nails",        name: "Iron Nails",        category: "item", basePrice: 20000,   stars: 3, smeltTimeSeconds: 29,   unlockedByDefault: true, ingredients: [{ sellableId: "iron-bar", amount: 2 }] },
  { id: "battery",           name: "Battery",           category: "item", basePrice: 70000,   stars: 1, smeltTimeSeconds: 58,   unlockedByDefault: true, ingredients: [{ sellableId: "copper-wire", amount: 1 }, { sellableId: "copper-bar", amount: 4 }] },
  { id: "hammer",            name: "Hammer",            category: "item", basePrice: 135000,  stars: 3, smeltTimeSeconds: 116,  unlockedByDefault: true, ingredients: [{ sellableId: "iron-nails", amount: 1 }, { sellableId: "lead-bar", amount: 2 }] },
  { id: "glass",             name: "Glass",             category: "item", basePrice: 220000,  stars: 5, smeltTimeSeconds: 175,  unlockedByDefault: true, ingredients: [{ sellableId: "silicon-bar", amount: 4 }] },
  { id: "circuit",           name: "Circuit",           category: "item", basePrice: 620000,  stars: 1, smeltTimeSeconds: 292,  unlockedByDefault: true, ingredients: [{ sellableId: "silicon-bar", amount: 2 }, { sellableId: "aluminum-bar", amount: 2 }, { sellableId: "copper-wire", amount: 4 }] },
  { id: "lens",              name: "Lens",              category: "item", basePrice: 1100000, stars: 4, smeltTimeSeconds: 584,  unlockedByDefault: true, ingredients: [{ sellableId: "glass", amount: 1 }, { sellableId: "silver-bar", amount: 2 }] },
  { id: "laser",             name: "Laser",             category: "item", basePrice: 3200000, stars: 3, smeltTimeSeconds: 877,  unlockedByDefault: true, ingredients: [{ sellableId: "gold-bar", amount: 2 }, { sellableId: "lens", amount: 1 }, { sellableId: "iron-bar", amount: 4 }] },
  { id: "basic-computer",    name: "Basic Computer",    category: "item", basePrice: 7600000, stars: 3, smeltTimeSeconds: 1169, unlockedByDefault: true, ingredients: [{ sellableId: "circuit", amount: 2 }, { sellableId: "silver-bar", amount: 2 }] },
  { id: "solar-panel",       name: "Solar Panel",       category: "item", basePrice: 12500000, stars: 2, smeltTimeSeconds: 1462, unlockedByDefault: true, ingredients: [{ sellableId: "circuit", amount: 2 }, { sellableId: "glass", amount: 4 }] },
  { id: "laser-torch",       name: "Laser Torch",       category: "item", basePrice: 31000000, stars: 3, smeltTimeSeconds: 1754, unlockedByDefault: true, ingredients: [{ sellableId: "bronze-bar", amount: 2 }, { sellableId: "laser", amount: 1 }, { sellableId: "lens", amount: 2 }] },
  { id: "advanced-battery",  name: "Advanced Battery",  category: "item", basePrice: 35000000, stars: 3, smeltTimeSeconds: 2193, unlockedByDefault: true, ingredients: [{ sellableId: "steel-bar", amount: 9 }, { sellableId: "battery", amount: 13 }] },
  { id: "thermal-scanner",   name: "Thermal Scanner",   category: "item", basePrice: 71500000, stars: 2, smeltTimeSeconds: 2631, unlockedByDefault: true, ingredients: [{ sellableId: "platinum-bar", amount: 2 }, { sellableId: "laser", amount: 1 }, { sellableId: "glass", amount: 2 }] },
  { id: "advanced-computer", name: "Advanced Computer", category: "item", basePrice: 180000000, stars: 1, smeltTimeSeconds: 3070, unlockedByDefault: true, ingredients: [{ sellableId: "titanium-bar", amount: 2 }, { sellableId: "basic-computer", amount: 2 }] },
  { id: "navigation-module", name: "Navigation Module", category: "item", basePrice: 1000000000, stars: 2, smeltTimeSeconds: 3289, unlockedByDefault: true, ingredients: [{ sellableId: "thermal-scanner", amount: 1 }, { sellableId: "laser-torch", amount: 1 }] },
  { id: "plasma-torch",      name: "Plasma Torch",      category: "item", basePrice: 1150000000, stars: 0, smeltTimeSeconds: 3600, unlockedByDefault: true, ingredients: [{ sellableId: "iridium-bar", amount: 6 }, { sellableId: "laser-torch", amount: 2 }] },
  { id: "radio-tower",       name: "Radio Tower",       category: "item", basePrice: 1450000000, stars: 0, smeltTimeSeconds: 3780, unlockedByDefault: true, ingredients: [{ sellableId: "platinum-bar", amount: 32 }, { sellableId: "aluminum-bar", amount: 65 }, { sellableId: "titanium-bar", amount: 22 }] },
  { id: "telescope",         name: "Telescope",         category: "item", basePrice: 2700000000, stars: 1, smeltTimeSeconds: 4020, unlockedByDefault: true, ingredients: [{ sellableId: "lens", amount: 9 }, { sellableId: "advanced-computer", amount: 1 }] },
  { id: "satellite-dish",    name: "Satellite Dish",    category: "item", basePrice: 3400000000, stars: 0, smeltTimeSeconds: 4320, unlockedByDefault: true, ingredients: [{ sellableId: "steel-bar", amount: 65 }, { sellableId: "palladium-bar", amount: 13 }] },
  { id: "motor",             name: "Motor",             category: "item", basePrice: 7000000000, stars: 0, smeltTimeSeconds: 4620, unlockedByDefault: true, ingredients: [{ sellableId: "bronze-bar", amount: 216 }, { sellableId: "hammer", amount: 86 }] },
  { id: "accumulator",          name: "Accumulator",          category: "item", basePrice: 12000000000, stars: 0, smeltTimeSeconds: 20400,  unlockedByDefault: false, ingredients: [{ sellableId: "osmium-bar", amount: 20 }, { sellableId: "advanced-battery", amount: 3 }] },
  { id: "nuclear-capsule",      name: "Nuclear Capsule",      category: "item", basePrice: 26000000000, stars: 0, smeltTimeSeconds: 21000,  unlockedByDefault: false, ingredients: [{ sellableId: "rhodium-bar", amount: 5 }, { sellableId: "plasma-torch", amount: 1 }] },
  { id: "wind-turbine",         name: "Wind Turbine",         category: "item", basePrice: 140000000000, stars: 0, smeltTimeSeconds: 21600,  unlockedByDefault: false, ingredients: [{ sellableId: "aluminum-bar", amount: 300 }, { sellableId: "motor", amount: 1 }] },
  { id: "space-probe",          name: "Space Probe",          category: "item", basePrice: 180000000000, stars: 0, smeltTimeSeconds: 22200,  unlockedByDefault: false, ingredients: [{ sellableId: "satellite-dish", amount: 1 }, { sellableId: "telescope", amount: 1 }, { sellableId: "solar-panel", amount: 25 }] },
  { id: "nuclear-reactor",      name: "Nuclear Reactor",      category: "item", basePrice: 1000000000000, stars: 0, smeltTimeSeconds: 22800,  unlockedByDefault: false, ingredients: [{ sellableId: "nuclear-capsule", amount: 1 }, { sellableId: "iridium-bar", amount: 300 }] },
  { id: "collider",             name: "Collider",             category: "item", basePrice: 2000000000000, stars: 0, smeltTimeSeconds: 23100,  unlockedByDefault: false, ingredients: [{ sellableId: "inerton-alloy", amount: 500 }, { sellableId: "quadium-alloy", amount: 100 }] },
  { id: "gravity-chamber",      name: "Gravity Chamber",      category: "item", basePrice: 15000000000000, stars: 0, smeltTimeSeconds: 24300,  unlockedByDefault: false, ingredients: [{ sellableId: "advanced-computer", amount: 60 }, { sellableId: "nuclear-reactor", amount: 1 }] },
  { id: "robot",                name: "Robot",                category: "item", basePrice: 50000000000000, stars: 0, smeltTimeSeconds: 26000,  unlockedByDefault: false, ingredients: [{ sellableId: "scrith-alloy", amount: 300 }, { sellableId: "accumulator", amount: 90 }] },
  { id: "fusion-capsule",       name: "Fusion Capsule",       category: "item", basePrice: 240000000000000, stars: 0, smeltTimeSeconds: 27000,  unlockedByDefault: false, ingredients: [{ sellableId: "uru-alloy", amount: 200 }, { sellableId: "vibranium-alloy", amount: 100 }, { sellableId: "nuclear-capsule", amount: 100 }] },
  { id: "teleporter",           name: "Teleporter",           category: "item", basePrice: 1800000000000000, stars: 0, smeltTimeSeconds: 29000,  unlockedByDefault: false, ingredients: [{ sellableId: "navigation-module", amount: 250 }, { sellableId: "gravity-chamber", amount: 1 }] },
  { id: "fusion-reactor",       name: "Fusion Reactor",       category: "item", basePrice: 40000000000000000, stars: 0, smeltTimeSeconds: 31000,  unlockedByDefault: false, ingredients: [{ sellableId: "fusion-capsule", amount: 1 }, { sellableId: "collider", amount: 40 }, { sellableId: "nuclear-reactor", amount: 50 }] },
  { id: "subspace-relay",       name: "Subspace Relay",       category: "item", basePrice: 1000000000000000000, stars: 0, smeltTimeSeconds: 32300,  unlockedByDefault: false, ingredients: [{ sellableId: "space-probe", amount: 70 }, { sellableId: "satellite-dish", amount: 100 }, { sellableId: "teleporter", amount: 1 }] },
  { id: "advanced-robot",       name: "Advanced Robot",       category: "item", basePrice: 29500000000000000000, stars: 0, smeltTimeSeconds: 62300,  unlockedByDefault: false, ingredients: [{ sellableId: "robot", amount: 100 }, { sellableId: "fusion-reactor", amount: 5 }] },
  { id: "advanced-teleporter",  name: "Advanced Teleporter",  category: "item", basePrice: 650000000000000000000, stars: 0, smeltTimeSeconds: 115200, unlockedByDefault: false, ingredients: [{ sellableId: "subspace-relay", amount: 5 }, { sellableId: "teleporter", amount: 100 }, { sellableId: "xynium-alloy", amount: 1000 }] },
  { id: "quantum-cpu",          name: "Quantum CPU",          category: "item", basePrice: 14000000000000000000000, stars: 0, smeltTimeSeconds: 120000, unlockedByDefault: false, ingredients: [{ sellableId: "advanced-robot", amount: 4 }, { sellableId: "quolium-alloy", amount: 500 }] },
  { id: "deflector-shield",     name: "Deflector Shield",     category: "item", basePrice: 320000000000000000000000, stars: 0, smeltTimeSeconds: 125000, unlockedByDefault: false, ingredients: [{ sellableId: "advanced-teleporter", amount: 4 }, { sellableId: "luterium-alloy", amount: 400 }] },
  { id: "warp-core",            name: "Warp Core",            category: "item", basePrice: 6800000000000000000000000, stars: 0, smeltTimeSeconds: 180000, unlockedByDefault: false, ingredients: [{ sellableId: "wind-turbine", amount: 160 }, { sellableId: "fusion-reactor", amount: 40 }, { sellableId: "quantum-cpu", amount: 4 }] },
  { id: "deep-space-scanner",   name: "Deep Space Scanner",   category: "item", basePrice: 145000000000000000000000000, stars: 0, smeltTimeSeconds: 188000, unlockedByDefault: false, ingredients: [{ sellableId: "advanced-battery", amount: 250 }, { sellableId: "aqualite-alloy", amount: 1000 }, { sellableId: "deflector-shield", amount: 4 }] },
  { id: "antimatter-cell",      name: "Antimatter Cell",      category: "item", basePrice: 3200000000000000000000000000, stars: 0, smeltTimeSeconds: 194000, unlockedByDefault: false, ingredients: [{ sellableId: "nuclear-reactor", amount: 50 }, { sellableId: "palladium-bar", amount: 10000 }, { sellableId: "warp-core", amount: 4 }] },
  { id: "atmospheric-processor", name: "Atmospheric Processor", category: "item", basePrice: 68000000000000000000000000000, stars: 0, smeltTimeSeconds: 244000, unlockedByDefault: false, ingredients: [{ sellableId: "iridium-bar", amount: 10000 }, { sellableId: "deep-space-scanner", amount: 4 }, { sellableId: "quantum-cpu", amount: 15 }] },
  { id: "orbital-dock",         name: "Orbital Dock",         category: "item", basePrice: 2800000000000000000000000000000, stars: 0, smeltTimeSeconds: 399000, unlockedByDefault: false, ingredients: [{ sellableId: "wraith-alloy", amount: 6000 }, { sellableId: "antimatter-cell", amount: 4 }, { sellableId: "warp-core", amount: 10 }] },
  { id: "solar-collector",      name: "Solar Collector",      category: "item", basePrice: 2800000000000000000000000000000, stars: 0, smeltTimeSeconds: 399000, unlockedByDefault: false, ingredients: [{ sellableId: "solar-panel", amount: 1000 }, { sellableId: "deflector-shield", amount: 20 }, { sellableId: "deep-space-scanner", amount: 132 }] },
  { id: "phase-gate",           name: "Phase Gate",           category: "item", basePrice: 452000000000000000000000000000000, stars: 0, smeltTimeSeconds: 699000, unlockedByDefault: false, ingredients: [{ sellableId: "deep-space-scanner", amount: 100 }, { sellableId: "advanced-teleporter", amount: 1000 }, { sellableId: "orbital-dock", amount: 1 }] },
  { id: "neural-matrix",        name: "Neural Matrix",        category: "item", basePrice: 452000000000000000000000000000000, stars: 0, smeltTimeSeconds: 699000, unlockedByDefault: false, ingredients: [{ sellableId: "antimatter-cell", amount: 4 }, { sellableId: "solar-collector", amount: 1 }, { sellableId: "osmium-bar", amount: 16000 }] },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_ENTITIES };
}
