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

// `entity.sellPrice` is the price the player enters directly; `marketBoost` is a
// separate multiplier for temporary in-game market events (default 1.0).
function sellPrice(entity) {
  return entity.sellPrice * entity.marketBoost;
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
  return (value < 0 ? "-" : "") + "$" + formatCompact(Math.abs(value));
}

// Number → shortest readable string: 3 sig figs plus the highest K/M/B/T suffix
// that keeps the shown value >= 1 (so 3.2M, never 3200K or 0.003B). Also parses
// back via parseCompact. Above 1e15 (late locked tiers only) falls back to
// exponent form rather than inventing suffix names.
function formatCompact(value) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (!isFinite(abs)) return sign + "∞";
  const tiers = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [threshold, suffix] of tiers) {
    if (abs >= threshold && abs < 1e15) {
      return `${sign}${sig3(abs / threshold)}${suffix}`;
    }
  }
  if (abs >= 1e15) return `${sign}${abs.toExponential(2)}`;
  return `${sign}${sig3(abs)}`;
}

// Inverse of formatCompact: "3.05M" / "3050k" / "3050000" -> 3050000. Returns
// NaN for anything else (empty, letters, trailing junk, scientific notation).
function parseCompact(str) {
  const m = /^\s*(-?\d*\.?\d+)\s*([kmbt]?)\s*$/i.exec(str);
  if (!m) return NaN;
  const mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[2].toLowerCase()] || 1;
  return parseFloat(m[1]) * mult;
}

// Mimic Python's "%.3g": up to 3 significant digits, no trailing zeros.
function sig3(n) {
  if (n === 0) return "0";
  return Number(n.toPrecision(3)).toString();
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
    netIngredientMaterialCost,
    totalTimeToCreate,
    profitPerSecond,
    newMemos,
    formatMoney,
    formatMoneyPerSec,
    formatCompact,
    parseCompact,
    formatDuration,
    formatDurationCompact,
    parseDuration,
  };
}
