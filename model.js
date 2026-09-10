/*
 * Pure economy math, ported from Sellable in profit.py.
 *
 * Every function takes `byId` — a Map or plain object from entity id to the
 * resolved entity (defaults with user overrides already applied). Nothing here
 * reads the unlocked flag: profit is only correct if the full recipe graph is
 * always walked down to raw ore cost.
 */

// profit.py: Ore 1/1/1, Alloy 1.44/1.04/1.45, Item 1.20/1.04/1.45
// (project * station * sales-room), collapsed to one constant per category.
const CATEGORY_BONUSES = {
  ore: 1.0,
  alloy: 1.44 * 1.04 * 1.45,
  item: 1.2 * 1.04 * 1.45,
};

function get(byId, id) {
  const e = byId instanceof Map ? byId.get(id) : byId[id];
  if (!e) throw new Error(`unknown entity id: ${id}`);
  return e;
}

function sellPrice(entity) {
  const starBonus = 1 + 0.2 * entity.stars;
  return (
    entity.baseSellPrice *
    entity.marketBoost *
    starBonus *
    CATEGORY_BONUSES[entity.category]
  );
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

// Port of format_money_per_sec in profit.py: 3 sig figs, K/M/B/T suffix.
// Above 1e15 (only reachable with late locked tiers) falls back to exponent
// form rather than inventing suffix names.
function formatMoneyPerSec(value) {
  return formatMoney(value) + "/s";
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (!isFinite(abs)) return sign + "$∞";
  const tiers = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [threshold, suffix] of tiers) {
    if (abs >= threshold && abs < 1e15) {
      return `${sign}$${sig3(abs / threshold)}${suffix}`;
    }
  }
  if (abs >= 1e15) return `${sign}$${abs.toExponential(2)}`;
  return `${sign}$${sig3(abs)}`;
}

// Mimic Python's "%.3g": up to 3 significant digits, no trailing zeros.
function sig3(n) {
  if (n === 0) return "0";
  const str = n.toPrecision(3);
  return str.indexOf(".") >= 0 ? str.replace(/\.?0+$/, "") : str;
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CATEGORY_BONUSES,
    sellPrice,
    netIngredientMaterialCost,
    totalTimeToCreate,
    profitPerSecond,
    newMemos,
    formatMoney,
    formatMoneyPerSec,
    formatDuration,
  };
}
