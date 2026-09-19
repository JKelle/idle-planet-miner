/*
 * Pure economy math, ported from Sellable in profit.py.
 *
 * Every function takes `byId` — a Map or plain object from entity id to the
 * resolved entity (defaults with user overrides already applied). Nothing here
 * reads the unlocked flag: profit is only correct if the full recipe graph is
 * always walked down to raw ore cost.
 */

function get(byId, id) {
  const e = byId instanceof Map ? byId.get(id) : byId[id];
  if (!e) throw new Error(`unknown entity id: ${id}`);
  return e;
}

// `entity.sellPrice` is the fully-resolved effective price (basePrice run
// through sellPriceParts), computed once per render pass in app.js.
function sellPrice(entity) {
  return entity.sellPrice;
}

// Multiplicative decomposition of a sellable's price, mirroring profit.py's
// get_sell_price. Ores get no sales-room, station-value, or value-project
// bonus — those are alloy/item-only in-game. Alloys and items share a single
// station-value control since they always move together in-game. The
// Marketing room scales positive market boosts only (a x3 market at
// Marketing 2.50 sells for x7.5); a glut market (< 1) is never scaled.
function sellPriceParts(entity, controls) {
  const base = entity.basePrice;
  const star = 1 + 0.2 * entity.stars;

  const isOre = entity.category === "ore";
  const on = (k) => (controls && controls[k] ? 1 : 0);
  const tech = isOre
    ? 1
    : entity.category === "alloy"
    ? Math.pow(1.2, on("techAdvancedAlloyValue") + on("techSuperiorAlloyValue"))
    : Math.pow(1.2, on("techAdvancedItemValue") + on("techSuperiorItemValue"));

  const station = isOre ? 1 : controls.station;

  const sales = isOre ? 1 : controls.salesRoom;

  const rawMarket = typeof entity.market === "number" ? entity.market : 1;
  const market = rawMarket > 1 ? rawMarket * controls.marketingRoom : rawMarket;

  const effective = base * star * tech * station * sales * market;
  return { base, star, tech, station, sales, market, effective };
}

// Recursive raw-ore cost of an entity's ingredients. Non-ore ingredients
// contribute only their own net ingredient cost (their crafted value cancels
// out when consumed upstream) — see profit.py get_net_ingredient_material_cost.
function netIngredientMaterialCost(entity, byId, memo = new Map()) {
  if (memo.has(entity.id)) return memo.get(entity.id);
  let cost = 0;
  for (const { sellableId, amount } of entity.ingredients) {
    const child = get(byId, sellableId);
    if (child.category === "ore") {
      cost += sellPrice(child) * amount;
    } else {
      cost += netIngredientMaterialCost(child, byId, memo) * amount;
    }
  }
  memo.set(entity.id, cost);
  return cost;
}

// Recursive: own smelt time plus time to make every ingredient (× amount).
function totalTimeToCreate(entity, byId, memo = new Map()) {
  if (memo.has(entity.id)) return memo.get(entity.id);
  let time = entity.smeltTimeSeconds;
  for (const { sellableId, amount } of entity.ingredients) {
    time += totalTimeToCreate(get(byId, sellableId), byId, memo) * amount;
  }
  memo.set(entity.id, time);
  return time;
}

function profitPerSecond(entity, byId, memos) {
  const m = memos || {};
  const price = sellPrice(entity);
  const cost = netIngredientMaterialCost(entity, byId, m.cost);
  const time = totalTimeToCreate(entity, byId, m.time);
  return (price - cost) / time;
}

// Build fresh memo maps for one recompute pass over many entities.
function newMemos() {
  return { cost: new Map(), time: new Map() };
}

// Research-project, Station-node, and Manager multipliers for smelters
// (alloys) and crafting stations (items), keyed by category, expressed so
// that effective = base * mult. Ores have no entry (no craft time, no
// ingredients) — callers treat a missing category as the identity
// multiplier. Value-project bonuses (Advanced/Superior Alloy/Item Value) are
// handled separately by sellPriceParts, since they apply to items too.
//
// Station "Smelting"/"Crafting" tech nodes (4 each) and an open-ended list of
// Managers are additional real-game speed sources not modeled by a research
// toggle: each Station node is its own independent multiplicative factor,
// and each Manager optionally boosts either smelt or craft speed (never
// both) by its own factor. All speed sources for a category — research
// techs, Station nodes, and Managers — combine by straight multiplication.
function techMultipliers(controls) {
  const on = (k) => (controls && controls[k] ? 1 : 0);
  const num = (k) => (controls && typeof controls[k] === "number" ? controls[k] : 1);

  const stationSmeltMult = num("smelting1") * num("smelting2") * num("smelting3") * num("smelting4");
  const stationCraftMult = num("crafting1") * num("crafting2") * num("crafting3") * num("crafting4");

  const managers = controls && Array.isArray(controls.managers) ? controls.managers : [];
  let managerSmeltMult = 1;
  let managerCraftMult = 1;
  for (const m of managers) {
    if (!m) continue;
    const amt =
      typeof m.boostAmount === "number" && isFinite(m.boostAmount) && m.boostAmount > 0 ? m.boostAmount : 1;
    if (m.boostType === "smelt") managerSmeltMult *= amt;
    else if (m.boostType === "craft") managerCraftMult *= amt;
  }

  const smelterSpeed =
    Math.pow(1.2, on("techAdvancedFurnace") + on("techSuperiorFurnace")) * stationSmeltMult * managerSmeltMult;
  const crafterSpeed =
    Math.pow(1.2, on("techAdvancedCrafting") + on("techSuperiorCrafting")) * stationCraftMult * managerCraftMult;
  return {
    alloy: {
      smeltTimeSeconds: 1 / smelterSpeed,
      ingredient: on("techSmeltingEfficiency") ? 0.8 : 1,
    },
    item: {
      smeltTimeSeconds: 1 / crafterSpeed,
      ingredient: on("techCraftingEfficiency") ? 0.8 : 1,
    },
  };
}

// Round half to even ("banker's rounding") — the one tie-breaking rule the
// wiki documents for this game (Upgraded Base Cargo). Used for every rounded
// game quantity below so a single rule covers ingredients, times, and any
// modifier added later. Exact .5 ties are reachable in practice — e.g.
// Osmium Bar's 315s smelt time at the Advanced Furnace multiplier (1/1.2) is
// exactly 262.5.
function roundHalfEven(value) {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

// Effective ingredient amount after a researched-efficiency multiplier. The
// game rounds the reduced amount to the nearest whole unit and never below 1:
// at Underforge L4 (-22%) a base-2 recipe still costs 2 (1.56 -> 2), and only
// at L5 (-26%) does it drop to 1 (1.48 -> 1). A multiplier of 1 is passed
// through untouched so a player-entered amount is never rewritten.
function effectiveIngredientAmount(amount, mult) {
  if (mult === 1) return amount;
  return Math.max(1, roundHalfEven(amount * mult));
}

// Effective smelt/craft time after a researched-speed multiplier, in whole
// seconds. Like the above, mult === 1 passes the player's own value through.
function effectiveSmeltTime(seconds, mult) {
  if (mult === 1) return seconds;
  return roundHalfEven(seconds * mult);
}

// Port of format_money_per_sec in profit.py: 4 sig figs, game-suffix scaling.
// Above the top suffix (only reachable with late locked tiers) falls back to
// exponent form rather than inventing suffix names.
function formatMoneyPerSec(value) {
  return formatMoney(value) + "/s";
}

function formatMoney(value) {
  return (value < 0 ? "-" : "") + "$" + formatCompact(Math.abs(value));
}

// Suffix ladder as shown in-game, largest first. Case matters: q/Q and s/S are
// distinct tiers, not typos.
const SUFFIX_TIERS = [
  [1e30, "N"],
  [1e27, "O"],
  [1e24, "S"],
  [1e21, "s"],
  [1e18, "Q"],
  [1e15, "q"],
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

// Number → shortest readable string: 4 sig figs plus the highest suffix that
// keeps the shown value >= 1 (so 3.2M, never 3200K or 0.003B). Above the N
// tier (1e33, past every entity currently in data.js) falls back to exponent
// form rather than inventing suffix names.
function formatCompact(value) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (!isFinite(abs)) return sign + "∞";
  for (const [threshold, suffix] of SUFFIX_TIERS) {
    if (abs >= threshold && abs < 1e33) {
      return `${sign}${sig4(abs / threshold)}${suffix}`;
    }
  }
  if (abs >= 1e33) return `${sign}${abs.toExponential(3)}`;
  return `${sign}${sig4(abs)}`;
}

// Mimic Python's "%.4g": up to 4 significant digits, no trailing zeros.
function sig4(n) {
  if (n === 0) return "0";
  return Number(n.toPrecision(4)).toString();
}

function formatDuration(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const parts = [];
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec && !h) parts.push(`${sec}s`);
  return parts.join(" ");
}

// Compact duration for the editable smelt/craft-time field: every nonzero
// h/m/s component, never dropped (unlike formatDuration's rounded-for-display
// summary above), so it round-trips exactly through parseDuration.
function formatDurationCompact(seconds) {
  if (!isFinite(seconds)) return "∞";
  const sign = seconds < 0 ? "-" : "";
  let rem = Math.abs(seconds);
  const h = Math.floor(rem / 3600);
  rem -= h * 3600;
  const m = Math.floor(rem / 60);
  rem -= m * 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (rem || parts.length === 0) parts.push(`${Number(rem.toFixed(3))}s`);
  return sign + parts.join(" ");
}

// Inverse of formatDurationCompact: "1h5m30s" / "1h 5m" / "90s" / "1.5h"
// (decimals allowed per unit, case-insensitive), or a plain number of seconds
// for values that predate this format. NaN if nothing matches.
function parseDuration(str) {
  const s = (str || "").trim();
  if (s === "") return NaN;
  if (/^-?\d*\.?\d+$/.test(s)) return parseFloat(s);
  const m = /^(?:(\d*\.?\d+)\s*h)?\s*(?:(\d*\.?\d+)\s*m)?\s*(?:(\d*\.?\d+)\s*s)?$/i.exec(s);
  if (!m || (!m[1] && !m[2] && !m[3])) return NaN;
  const h = m[1] ? parseFloat(m[1]) : 0;
  const min = m[2] ? parseFloat(m[2]) : 0;
  const sec = m[3] ? parseFloat(m[3]) : 0;
  return h * 3600 + min * 60 + sec;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    sellPrice,
    sellPriceParts,
    netIngredientMaterialCost,
    totalTimeToCreate,
    profitPerSecond,
    newMemos,
    techMultipliers,
    roundHalfEven,
    effectiveIngredientAmount,
    effectiveSmeltTime,
    formatMoney,
    formatMoneyPerSec,
    formatCompact,
    SUFFIX_TIERS,
    formatDuration,
    formatDurationCompact,
    parseDuration,
  };
}
