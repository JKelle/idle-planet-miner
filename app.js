/*
 * State, persistence, chart, and UI wiring for the Profitability Explorer.
 *
 * DEFAULT_ENTITIES (data.js) is never mutated. All user edits live in
 * `state.overrides[id]`, a sparse layer holding only changed stat keys and/or
 * an `unlocked` flag. Resolved entities are rebuilt from defaults + overrides
 * on every render.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "ipm-explorer-v1";
  const STAT_KEYS = ["stars", "market", "smeltTimeSeconds"];

  // Level control keys (Rooms and Station nodes) -> max level (see
  // roomMultiplier/stationNodeBonus in model.js). Integer levels where 0 is
  // valid ("not purchased"/"not researched"), validated by one loop in
  // normalizeState below. Station node maxes mirror model.js's
  // STATION_LADDERS table.
  const LEVEL_CONTROL_KEYS = {
    forgeLevel: 60,
    workshopLevel: 60,
    underforgeLevel: 11,
    dormLevel: 11,
    salesRoomLevel: 60,
    marketingRoomLevel: 60,
    smelting1: 5,
    smelting2: 10,
    smelting3: 15,
    smelting4: 20,
    smelting5: 20,
    crafting1: 5,
    crafting2: 10,
    crafting3: 15,
    crafting4: 20,
    crafting5: 20,
    value1: 5,
    value2: 5,
    value3: 5,
    value4: 4,
    value5: 4,
    value6: 2,
    value7: 2,
  };

  // Bonus-per-level for each Smelting/Crafting Station node (1-indexed by
  // position), mirroring model.js's STATION_LADDERS.smelting/.crafting.
  // Used only by the v4 -> v5 migration below to convert a saved raw
  // multiplier back into a level.
  const STATION_NODE_BONUS_PER_LEVEL = [0.01, 0.01, 0.01, 0.02, 0.04];

  // Bonus-per-level for each Items & Alloys ("value") Station node, mirroring
  // model.js's STATION_LADDERS.value. Used only by the v6 -> v7 migration
  // below to spread a saved flat `station` multiplier across the 7 nodes.
  const VALUE_NODE_BONUS_PER_LEVEL = [0.036, 0.08, 0.08, 0.02, 0.02, 0.075, 0.075];
  const VALUE_NODE_MAX_LEVEL = [5, 5, 5, 4, 4, 2, 2];

  // Bump this whenever a stat key is removed/renamed or an override's shape
  // changes, and add a migration step in normalizeState below. Never change
  // STORAGE_KEY itself (that would just orphan everyone's existing save under
  // the old key) and never let unrecognized fields get silently dropped on
  // load/save — that's how past deploys ("Editable sell price", "Remove
  // market boost") ended up discarding players' saved edits.
  const STORAGE_VERSION = 7;

  // Market roll presets, matching what the in-game Market dialog offers.
  const MARKET_OPTIONS = [
    { value: 1, label: "—" },
    { value: 0.33, label: "×0.33" },
    { value: 0.5, label: "×0.5" },
    { value: 2, label: "×2" },
    { value: 3, label: "×3" },
    { value: 4, label: "×4" },
    { value: 5, label: "×5" },
  ];

  // model.js declares these as globals in the browser (classic script). Bridge
  // them onto one object so the rest of this file reads uniformly.
  window.__model = {
    sellPrice,
    sellPriceParts,
    netIngredientMaterialCost,
    totalTimeToCreate,
    profitPerSecond,
    newMemos,
    techMultipliers,
    roomMultiplier,
    stationNodeBonus,
    stationCategoryMultiplier,
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

  const DEFAULT_BY_ID = {};
  for (const e of DEFAULT_ENTITIES) DEFAULT_BY_ID[e.id] = e;

  // id -> list of entity ids that use it as a direct ingredient
  const DEPENDENTS = {};
  for (const e of DEFAULT_ENTITIES) {
    for (const ing of e.ingredients) {
      (DEPENDENTS[ing.sellableId] = DEPENDENTS[ing.sellableId] || []).push(e.id);
    }
  }

  // ---- state ----------------------------------------------------------------
  const state = loadState();
  // Write the normalized/migrated shape straight back — otherwise a legacy
  // blob just sits in localStorage as-is until the player's next edit
  // happens to trigger a save, and a crash or tab close before that loses
  // the migration.
  saveState();
  let chart = null;
  let currentRows = []; // [{ entity, value }] in chart order

  function defaultControls() {
    return {
      scale: "linear",
      sort: "profit-desc",
      category: "all",
      // Flat (not nested) so normalizeState's Object.assign merge gives every
      // old save `false` for these with no migration needed.
      techAdvancedFurnace: false,
      techSmeltingEfficiency: false,
      techSuperiorFurnace: false,
      techAdvancedCrafting: false,
      techSuperiorCrafting: false,
      techCraftingEfficiency: false,
      // Value-project defaults are `true` (unlike the other techs) so that a
      // fresh save reproduces the old baked-in sellPrice values, which always
      // assumed Advanced+Superior Alloy Value and Advanced Item Value — see
      // profit.py's fixed 1.44 / 1.20 category bonuses.
      techAdvancedAlloyValue: true,
      techSuperiorAlloyValue: true,
      techAdvancedItemValue: true,
      techSuperiorItemValue: false,
      managers: [],
      // Mothership Room levels (Forge/Workshop/Underforge/Dorm/Sales/
      // Marketing) and Station tech-node levels (Smelting/Crafting 5 each,
      // Items & Alloys "value" 7) — see techMultipliers/sellPriceParts in
      // model.js. 0 is a valid, common value here ("not purchased"/"not
      // researched") — see LEVEL_CONTROL_KEYS, which validates all of these.
      // Defaults reproduce profit.py's fixed per-category constants (Alloy
      // 1.04/1.45, Item 1.04/1.45): Sales level 7 -> x1.45, value4 level 2 ->
      // x1.04 (2 x 0.02/lvl, the only exact-fit combination of the value
      // ladder's per-node increments), Marketing level 0 -> x1.00 (no
      // boosted market roll in the default save). Ores have no station-value
      // or Sales/Marketing bonus in-game, so those never apply to ores.
      forgeLevel: 0,
      workshopLevel: 0,
      underforgeLevel: 0,
      dormLevel: 0,
      salesRoomLevel: 7,
      marketingRoomLevel: 0,
      smelting1: 0,
      smelting2: 0,
      smelting3: 0,
      smelting4: 0,
      smelting5: 0,
      crafting1: 0,
      crafting2: 0,
      crafting3: 0,
      crafting4: 0,
      crafting5: 0,
      value1: 0,
      value2: 0,
      value3: 0,
      value4: 2,
      value5: 0,
      value6: 0,
      value7: 0,
      // Module effects — a 4th open-ended boost source alongside Managers.
      // Unlike Rooms, Modules have no documented level->effect formula (main
      // effects scale unpredictably and sub-effects are randomly rolled per
      // the wiki), so the player enters each effect directly, same shape as
      // managers but with a wider category enum since a single Module can
      // affect speed, ingredient cost, or sell value. See
      // moduleEffectMultiplier in model.js.
      moduleEffects: [],
      // Which <details> disclosure groups start open. View state only (never
      // affects the model), kept flat like the rest of `controls` so a saved
      // partial object merges cleanly. Stat tables default open since stars/
      // market rolls change often; everything else defaults closed.
      open: {
        tech: false,
        rooms: false,
        station: false,
        managers: false,
        modules: false,
        ores: false,
        alloys: true,
        items: true,
      },
    };
  }

  // Normalize a parsed (or freshly-imported) state blob: validate types,
  // migrate old shapes forward, and pass through anything we don't recognize
  // (an unknown entity id, or an ingredient id no longer in a recipe) rather
  // than dropping it — a future id rename or recipe edit should never cost a
  // player their saved data.
  function normalizeState(parsed) {
    const overrides =
      parsed && typeof parsed.overrides === "object" && parsed.overrides
        ? parsed.overrides
        : {};

    // v5 -> v6: data.js's ingredient amounts changed from the player's own
    // boosted (post-reduction) in-game numbers to the game's true base
    // recipe amounts — see the comment at the top of data.js. A saved
    // per-ingredient override already has the player's own boost baked in
    // and can't be un-baked, so like the v1->v2/v2->v3 drops below it's
    // dropped rather than migrated: keeping it would silently double-apply
    // the reduction once techMultipliers layers the modeled boosts on top.
    const preV6 = !parsed || typeof parsed.version !== "number" || parsed.version < 6;

    const clean = {};
    for (const [id, ov] of Object.entries(overrides)) {
      if (!ov || typeof ov !== "object") continue;
      const entry = {};
      for (const k of STAT_KEYS) {
        if (typeof ov[k] === "number" && isFinite(ov[k]) && ov[k] >= 0) {
          entry[k] = ov[k];
        }
      }
      if (typeof ov.unlocked === "boolean") entry.unlocked = ov.unlocked;
      if (!preV6 && ov.ingredients && typeof ov.ingredients === "object") {
        const cleanIng = {};
        for (const [sid, amt] of Object.entries(ov.ingredients)) {
          if (typeof amt === "number" && isFinite(amt) && amt > 0) {
            cleanIng[sid] = amt;
          }
        }
        if (Object.keys(cleanIng).length) entry.ingredients = cleanIng;
      }
      // v1 -> v2: stars/baseSellPrice/marketBoost were replaced by a single
      // directly-editable sellPrice and are dropped rather than migrated —
      // there's no sound way to derive one from the others post hoc.
      // v2 -> v3: sellPrice itself was replaced by a fixed basePrice (in
      // data.js) times editable stars/market/global bonuses. A saved
      // sellPrice override already has every bonus baked in and can't be
      // split back apart, so it's dropped here the same way.
      if (Object.keys(entry).length) clean[id] = entry;
    }

    const parsedControls = (parsed && parsed.controls) || {};
    const incomingControls = Object.assign({}, parsedControls);
    if (!parsed || typeof parsed.version !== "number" || parsed.version < 3) {
      // v2 -> v3: under v2, "off" meant "already included in the sellPrice I
      // typed in" — under v3 it means "not researched". A saved `false` here
      // would otherwise win over the new `true` defaults (see
      // defaultControls) and silently cut every alloy/item price by up to
      // 1.44x/1.2x. Deleting lets the v3 defaults take over below.
      delete incomingControls.techAdvancedAlloyValue;
      delete incomingControls.techSuperiorAlloyValue;
      delete incomingControls.techAdvancedItemValue;
      delete incomingControls.techSuperiorItemValue;
    }
    if (!parsed || typeof parsed.version !== "number" || parsed.version < 4) {
      // v3 -> v4: separate stationAlloy/stationItem controls merged into one
      // `station` control (they always moved together in-game), and the
      // stationOre control was removed (no such bonus exists in-game — ores
      // always use station=1). Carry a player's stationAlloy (or, failing
      // that, stationItem) value forward as `station` before the legacy keys
      // are dropped below, so a customized value isn't silently reset to the
      // default.
      const legacyAlloy = incomingControls.stationAlloy;
      const legacyItem = incomingControls.stationItem;
      if (typeof legacyAlloy === "number" && isFinite(legacyAlloy) && legacyAlloy > 0) {
        incomingControls.station = legacyAlloy;
      } else if (typeof legacyItem === "number" && isFinite(legacyItem) && legacyItem > 0) {
        incomingControls.station = legacyItem;
      }
      delete incomingControls.stationOre;
      delete incomingControls.stationAlloy;
      delete incomingControls.stationItem;
    }
    if (!parsed || typeof parsed.version !== "number" || parsed.version < 5) {
      // v4 -> v5: Station "Smelting"/"Crafting" nodes switched from a
      // directly-entered raw multiplier per node to a level (0..max), same
      // convention as Rooms — see LEVEL_CONTROL_KEYS. Best-effort convert a
      // saved multiplier back into the nearest level via each node's
      // bonus-per-level (STATION_NODE_BONUS_PER_LEVEL, mirroring model.js's
      // STATION_LADDERS.smelting/.crafting) rather than dropping it, so an
      // entered boost isn't silently lost. There was no node 5 before v5, so
      // it's left for the v5 default (0) to fill in.
      ["smelting", "crafting"].forEach((prefix) => {
        for (let i = 1; i <= 4; i++) {
          const key = `${prefix}${i}`;
          const raw = incomingControls[key];
          if (typeof raw === "number" && isFinite(raw) && raw > 0) {
            const perLevel = STATION_NODE_BONUS_PER_LEVEL[i - 1];
            const max = LEVEL_CONTROL_KEYS[key];
            const level = Math.max(0, Math.min(max, Math.round((raw - 1) / perLevel)));
            incomingControls[key] = level;
          } else {
            delete incomingControls[key];
          }
        }
      });
    }
    if (!parsed || typeof parsed.version !== "number" || parsed.version < 7) {
      // v6 -> v7: the "Sell price bonuses" card's three flat multipliers were
      // replaced by levels in the systems they actually belong to. Sales and
      // Marketing are Mothership Rooms (same level convention as Forge/
      // Workshop/Underforge/Dorm since v5); Station "value" is a 7-node
      // ladder alongside the Smelting/Crafting Station nodes. A flat
      // multiplier has no unique decomposition into levels, so best-effort
      // convert each rather than dropping the player's customization.
      const legacySales = incomingControls.salesRoom;
      if (typeof legacySales === "number" && isFinite(legacySales) && legacySales > 1) {
        incomingControls.salesRoomLevel = Math.max(
          0,
          Math.min(60, Math.round((legacySales - 1.15) / 0.05) + 1)
        );
      }
      const legacyMarketing = incomingControls.marketingRoom;
      if (typeof legacyMarketing === "number" && isFinite(legacyMarketing) && legacyMarketing > 1) {
        incomingControls.marketingRoomLevel = Math.max(
          0,
          Math.min(60, Math.round((legacyMarketing - 1.3) / 0.1) + 1)
        );
      }
      const legacyStation = incomingControls.station;
      if (typeof legacyStation === "number" && isFinite(legacyStation) && legacyStation > 1) {
        // Spread the flat multiplier's bonus (station - 1) across the value
        // ladder's 7 nodes: fill the coarsest nodes first (.08/lvl, .075/lvl)
        // since they're least able to hit an arbitrary target precisely,
        // then settle whatever's left as precisely as possible on the
        // ladder's finest nodes (.02/lvl), spilling into the .036/lvl node
        // only if more bonus remains than the two .02 nodes can hold. This
        // reproduces the pre-v7 default (station: 1.04) as exactly value4:
        // 2 (2 x .02 = .04); other saved values land within a fraction of a
        // percent, which doesn't affect chart ordering.
        let remaining = Math.min(Math.max(legacyStation - 1, 0), 2.44);
        const levels = [0, 0, 0, 0, 0, 0, 0];
        for (const i of [1, 2, 5, 6]) {
          const perLevel = VALUE_NODE_BONUS_PER_LEVEL[i];
          const max = VALUE_NODE_MAX_LEVEL[i];
          const take = Math.min(max, Math.floor(remaining / perLevel + 1e-9));
          levels[i] = take;
          remaining -= take * perLevel;
        }
        const fineLevels = Math.max(0, Math.min(8, Math.round(remaining / 0.02)));
        levels[3] = Math.min(4, fineLevels);
        levels[4] = Math.min(4, fineLevels - levels[3]);
        remaining -= (levels[3] + levels[4]) * 0.02;
        if (remaining > 0.018) {
          levels[0] = Math.min(
            VALUE_NODE_MAX_LEVEL[0],
            levels[0] + Math.round(remaining / VALUE_NODE_BONUS_PER_LEVEL[0])
          );
        }
        for (let i = 0; i < 7; i++) incomingControls[`value${i + 1}`] = levels[i];
      }
      delete incomingControls.salesRoom;
      delete incomingControls.station;
      delete incomingControls.marketingRoom;
    }

    for (const [k, max] of Object.entries(LEVEL_CONTROL_KEYS)) {
      const v = incomingControls[k];
      if (!(typeof v === "number" && isFinite(v) && Number.isInteger(v) && v >= 0 && v <= max)) {
        delete incomingControls[k];
      }
    }

    // Managers is an array, so it needs per-entry validation rather than the
    // scalar keep-or-delete check above. Malformed entries are dropped
    // rather than poisoning the calc; ids are de-duped/backfilled so the
    // manager list can always be keyed and rendered safely.
    const rawManagers = Array.isArray(incomingControls.managers) ? incomingControls.managers : [];
    const seenManagerIds = new Set();
    const cleanManagers = [];
    for (const m of rawManagers) {
      if (!m || typeof m !== "object") continue;
      const boostType = ["none", "smelt", "craft"].includes(m.boostType) ? m.boostType : "none";
      const boostAmount =
        typeof m.boostAmount === "number" && isFinite(m.boostAmount) && m.boostAmount > 0
          ? m.boostAmount
          : 1;
      const name = typeof m.name === "string" ? m.name : "";
      let id = typeof m.id === "string" && m.id && !seenManagerIds.has(m.id) ? m.id : null;
      if (!id) id = "m" + Math.random().toString(36).slice(2, 10);
      seenManagerIds.add(id);
      cleanManagers.push({ id, name, boostType, boostAmount });
    }
    incomingControls.managers = cleanManagers;

    // Module effects: same array-of-entries shape and validation approach as
    // Managers above, but with a wider category enum (a single Module can
    // affect speed, ingredient cost, or sell value, not just smelt/craft
    // speed) — see moduleEffectMultiplier in model.js.
    const rawModuleEffects = Array.isArray(incomingControls.moduleEffects) ? incomingControls.moduleEffects : [];
    const seenModuleEffectIds = new Set();
    const cleanModuleEffects = [];
    const MODULE_EFFECT_CATEGORIES = [
      "none",
      "smeltSpeed",
      "craftSpeed",
      "alloyIngredient",
      "itemIngredient",
      "oreValue",
      "alloyValue",
      "itemValue",
    ];
    for (const e of rawModuleEffects) {
      if (!e || typeof e !== "object") continue;
      const category = MODULE_EFFECT_CATEGORIES.includes(e.category) ? e.category : "none";
      const amount =
        typeof e.amount === "number" && isFinite(e.amount) && e.amount > 0 ? e.amount : 1;
      const name = typeof e.name === "string" ? e.name : "";
      let id = typeof e.id === "string" && e.id && !seenModuleEffectIds.has(e.id) ? e.id : null;
      if (!id) id = "e" + Math.random().toString(36).slice(2, 10);
      seenModuleEffectIds.add(id);
      cleanModuleEffects.push({ id, name, category, amount });
    }
    incomingControls.moduleEffects = cleanModuleEffects;

    // `open` (disclosure-group state) is itself an object, so the top-level
    // Object.assign below would replace it wholesale rather than merging —
    // a partial saved `open` (e.g. from an older client, or a hand-edited
    // import) would silently lose every key it didn't mention. Merge onto
    // the default explicitly instead.
    const rawOpen = incomingControls.open && typeof incomingControls.open === "object" ? incomingControls.open : {};
    const cleanOpen = {};
    for (const [k, def] of Object.entries(defaultControls().open)) {
      cleanOpen[k] = typeof rawOpen[k] === "boolean" ? rawOpen[k] : def;
    }
    incomingControls.open = cleanOpen;

    return {
      version: STORAGE_VERSION,
      overrides: clean,
      controls: Object.assign(defaultControls(), incomingControls),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalizeState(null);
      return normalizeState(JSON.parse(raw));
    } catch (e) {
      return normalizeState(null);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — app still works for this session */
    }
  }

  // ---- resolution ---------------------------------------------------------
  // Builds an entity with defaults + overrides merged, and its sellPrice
  // fully resolved via sellPriceParts (basePrice x stars x the global
  // bonuses). basePrice itself is never overridable — see data.js.
  function resolved(id) {
    const base = DEFAULT_BY_ID[id];
    const ov = state.overrides[id] || {};
    const ovIng = ov.ingredients || {};
    const out = {
      id: base.id,
      name: base.name,
      category: base.category,
      basePrice: base.basePrice,
      stars: pick(ov.stars, base.stars),
      market: pick(ov.market, 1),
      ingredients: base.ingredients.map((i) => ({
        sellableId: i.sellableId,
        amount: pick(ovIng[i.sellableId], i.amount),
      })),
      smeltTimeSeconds: pick(ov.smeltTimeSeconds, base.smeltTimeSeconds),
    };
    out.priceParts = F().sellPriceParts(out, state.controls);
    out.sellPrice = out.priceParts.effective;
    return out;
  }

  function pick(a, b) {
    return typeof a === "number" ? a : b;
  }

  function isUnlocked(id) {
    const ov = state.overrides[id];
    if (ov && typeof ov.unlocked === "boolean") return ov.unlocked;
    return DEFAULT_BY_ID[id].unlockedByDefault;
  }

  function resolvedMap() {
    const m = {};
    for (const e of DEFAULT_ENTITIES) m[e.id] = resolved(e.id);
    return m;
  }

  // Layers the smelter/crafter speed and ingredient researched-tech
  // multipliers on top of resolved() — ores have no entry in `mults` (no
  // craft time, no ingredients) and pass through unchanged. sellPrice is
  // already fully resolved by resolved() and is untouched here —
  // value-project bonuses are part of sellPriceParts, not techMultipliers.
  function withTechs(entity, mults) {
    const m = mults[entity.category];
    if (!m) return entity;
    return Object.assign({}, entity, {
      ingredients: entity.ingredients.map((i) => ({
        sellableId: i.sellableId,
        amount: F().effectiveIngredientAmount(i.amount, m.ingredient),
      })),
      smeltTimeSeconds: F().effectiveSmeltTime(entity.smeltTimeSeconds, m.smeltTimeSeconds),
    });
  }

  function effectiveMap() {
    const mults = F().techMultipliers(state.controls);
    const m = {};
    for (const e of DEFAULT_ENTITIES) m[e.id] = withTechs(resolved(e.id), mults);
    return m;
  }

  // ---- overrides mutation ------------------------------------------------
  // These always record what the player actually entered, even when it
  // matches the current default — a value equal to today's default is not
  // necessarily equal to tomorrow's, and only a value the player never
  // touched should follow data.js when it changes.
  function setStat(id, key, value) {
    const ov = (state.overrides[id] = state.overrides[id] || {});
    ov[key] = value;
    saveState();
  }

  function setIngredientAmount(id, sellableId, value) {
    const ov = (state.overrides[id] = state.overrides[id] || {});
    const ing = (ov.ingredients = ov.ingredients || {});
    ing[sellableId] = value;
    saveState();
  }

  function setUnlocked(id, value) {
    if (value) {
      // unlock this and everything it depends on
      walk(id, (curId) => {
        markUnlock(curId, true);
        return DEFAULT_BY_ID[curId].ingredients.map((i) => i.sellableId);
      });
    } else {
      // lock this and everything that depends on it
      walk(id, (curId) => {
        markUnlock(curId, false);
        return DEPENDENTS[curId] || [];
      });
    }
    saveState();
  }

  function markUnlock(id, value) {
    const ov = (state.overrides[id] = state.overrides[id] || {});
    ov.unlocked = value;
  }

  function walk(startId, visit) {
    const seen = new Set();
    const stack = [startId];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      for (const next of visit(id)) stack.push(next);
    }
  }

  function resetAll() {
    state.overrides = {};
    saveState();
  }

  // ---- computed rows ----------------------------------------------------
  function computeRows() {
    const byId = effectiveMap();
    const memos = window.__model.newMemos();
    const rows = DEFAULT_ENTITIES.filter(
      (e) => e.category !== "ore" && isUnlocked(e.id)
    ).map((e) => {
      const ent = byId[e.id];
      return { entity: ent, value: window.__model.profitPerSecond(ent, byId, memos) };
    });

    const cat = state.controls.category;
    let filtered = rows.filter((r) => cat === "all" || r.entity.category === cat);

    const sort = state.controls.sort;
    filtered.sort((a, b) => {
      if (sort === "profit-desc") return b.value - a.value;
      if (sort === "profit-asc") return a.value - b.value;
      if (sort === "name-asc") return a.entity.name.localeCompare(b.entity.name);
      return b.entity.name.localeCompare(a.entity.name);
    });
    return { filtered, byId, memos };
  }

  // ---- chart ----------------------------------------------------------
  const F = () => window.__model;

  function renderChart() {
    const { filtered, byId, memos } = computeRows();
    const isLog = state.controls.scale === "logarithmic";

    let shown = filtered;
    let hiddenCount = 0;
    if (isLog) {
      shown = filtered.filter((r) => r.value > 0);
      hiddenCount = filtered.length - shown.length;
    }
    currentRows = shown;

    const note = document.getElementById("chart-note");
    if (isLog && hiddenCount > 0) {
      note.textContent = `${hiddenCount} hidden (profit ≤ $0/s — can't plot on a log axis)`;
    } else if (shown.length === 0) {
      note.textContent = "Nothing to show. Unlock some alloys or items below.";
    } else {
      note.textContent = "";
    }

    const wrap = document.getElementById("chart-canvas-wrap");
    wrap.style.height = Math.max(260, shown.length * 26 + 40) + "px";

    const labels = shown.map((r) => r.entity.name);
    const data = shown.map((r) => r.value);
    const colors = shown.map((r) =>
      r.entity.category === "alloy"
        ? getVar("--accent-alloy")
        : getVar("--accent-item")
    );

    const cfg = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Profit / sec",
            data,
            backgroundColor: colors,
            borderWidth: 0,
          },
        ],
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            type: isLog ? "logarithmic" : "linear",
            ticks: { callback: (v) => F().formatMoney(v) },
            title: { display: true, text: "Profit per second" },
          },
          y: { ticks: { autoSkip: false, font: { size: 11 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const r = currentRows[ctx.dataIndex];
                const e = r.entity;
                const price = F().sellPrice(e);
                const cost = F().netIngredientMaterialCost(e, byId, memos.cost);
                const time = F().totalTimeToCreate(e, byId, memos.time);
                return [
                  `Profit/sec: ${F().formatMoneyPerSec(r.value)}`,
                  `Sell price: ${F().formatMoney(price)}`,
                  `Ingredient cost: ${F().formatMoney(cost)}`,
                  `Time to create: ${F().formatDuration(time)}`,
                ];
              },
            },
          },
        },
      },
    };

    if (chart) {
      chart.destroy();
    }
    chart = new Chart(document.getElementById("profit-chart"), cfg);
  }

  function getVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function renderLegend() {
    document.getElementById("chart-legend").innerHTML =
      `<span><i style="background:${getVar("--accent-alloy")}"></i>Alloy</span>` +
      `<span><i style="background:${getVar("--accent-item")}"></i>Item</span>`;
  }

  // ---- stat tables --------------------------------------------------
  function renderStatTables() {
    renderStatTable("ore-tbody", "ore");
    renderStatTable("alloy-tbody", "alloy");
    renderStatTable("item-tbody", "item");
  }

  function renderStatTable(tbodyId, category) {
    const byId = resolvedMap();
    // Researched-tech multipliers apply per-category (alloy or item); ores
    // have no entry and always get the identity multiplier so no "effective"
    // field shows.
    const mults = F().techMultipliers(state.controls);
    const m = mults[category];
    const timeMult = m ? m.smeltTimeSeconds : 1;
    const ingredientMult = m ? m.ingredient : 1;

    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = "";
    const isOre = category === "ore";
    for (const base of DEFAULT_ENTITIES.filter((e) => e.category === category)) {
      const e = byId[base.id];
      const unlocked = isUnlocked(base.id);
      const tr = document.createElement("tr");
      if (!unlocked) tr.className = "locked";

      const tdOn = cell(tr);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = unlocked;
      cb.setAttribute("aria-label", "Unlocked: " + base.name);
      cb.addEventListener("change", () => {
        setUnlocked(base.id, cb.checked);
        renderAll();
      });
      tdOn.appendChild(cb);

      const tdName = cell(tr);
      tdName.className = "col-name";
      tdName.appendChild(entityIcon(base.id));
      tdName.appendChild(document.createTextNode(" " + base.name));

      if (isOre) {
        cell(tr); // time — not applicable to ores
        cell(tr); // ingredients — not applicable to ores
      } else {
        statInput(
          tr,
          e,
          base.id,
          "smeltTimeSeconds",
          { format: F().formatDurationCompact, parse: F().parseDuration },
          timeMult
        );
        renderIngredientCell(tr, e, base.id, ingredientMult);
      }

      renderPriceCells(tr, e, base.id);
      tbody.appendChild(tr);
    }
  }

  function cell(tr) {
    const td = document.createElement("td");
    tr.appendChild(td);
    return td;
  }

  // `assets/icons/<id>.webp` is usually a data.js entity id, but the "Researched
  // tech" checkboxes in index.html also have their own icons there (named by
  // checkbox id, e.g. tech-advanced-furnace.webp) even though they never go
  // through this function — index.html references those paths directly.
  function entityIcon(id) {
    const img = document.createElement("img");
    img.className = "entity-icon";
    img.src = "assets/icons/" + id + ".webp";
    img.alt = "";
    return img;
  }

  // `mult` is the researched-tech multiplier for this stat (1 = no effect).
  // When it isn't 1, a second "effective" field is shown alongside the raw
  // one the player edits — either can be typed into, and they stay linked.
  function statInput(tr, entity, id, key, opts, mult) {
    const td = cell(tr);
    const wrap = document.createElement("span");
    wrap.className = "stat-wrap";

    function fieldValue(v) {
      return opts.format ? opts.format(v) : String(v);
    }

    const input = document.createElement("input");
    if (opts.format) {
      // text field so it can hold e.g. "3.05M" or "1h 5m"; opts.parse inverts it
      input.type = "text";
      input.value = fieldValue(entity[key]);
    } else {
      input.type = "number";
      input.min = "0";
      input.step = opts.integer ? "1" : "any";
      input.value = String(entity[key]);
    }
    input.setAttribute("aria-label", `${entity.name} ${key}`);

    let effInput = null;
    input.addEventListener("input", () => {
      const raw = input.value.trim();
      const n = opts.parse ? opts.parse(raw) : Number(raw);
      let ok = raw !== "" && isFinite(n) && !Number.isNaN(n) && n >= 0;
      if (ok && opts.integer && !Number.isInteger(n)) ok = false;
      input.classList.toggle("invalid", !ok);
      if (!ok) return;
      setStat(id, key, n);
      if (effInput) effInput.value = fieldValue(F().effectiveSmeltTime(n, mult));
      renderChart();
    });
    wrap.appendChild(input);

    if (mult !== 1) {
      const arrow = document.createElement("span");
      arrow.className = "eff-arrow";
      arrow.textContent = "→";
      wrap.appendChild(arrow);

      effInput = document.createElement("input");
      effInput.className = "eff-input";
      if (opts.format) {
        effInput.type = "text";
      } else {
        effInput.type = "number";
        effInput.min = "0";
        effInput.step = opts.integer ? "1" : "any";
      }
      effInput.value = fieldValue(F().effectiveSmeltTime(entity[key], mult));
      effInput.setAttribute("aria-label", `${entity.name} ${key} (effective)`);
      effInput.addEventListener("input", () => {
        const raw = effInput.value.trim();
        const n = opts.parse ? opts.parse(raw) : Number(raw);
        let ok = raw !== "" && isFinite(n) && !Number.isNaN(n) && n >= 0;
        if (ok && opts.integer && !Number.isInteger(n)) ok = false;
        effInput.classList.toggle("invalid", !ok);
        if (!ok) return;
        const base = n / mult;
        setStat(id, key, base);
        input.value = fieldValue(base);
        renderChart();
      });
      wrap.appendChild(effInput);
    }

    td.appendChild(wrap);
  }

  // Renders the four price cells: read-only base price, editable stars,
  // editable market roll, and read-only effective sell price (the product of
  // basePrice, stars, market, and the global bonus controls — see
  // sellPriceParts in model.js). Only stars/market are per-entity; the rest
  // come from the "Sell price bonuses" card and apply across every row.
  function renderPriceCells(tr, entity, id) {
    const tdBase = cell(tr);
    tdBase.className = "price-readonly";
    tdBase.textContent = F().formatMoney(entity.basePrice);

    const tdStars = cell(tr);
    const starsInput = document.createElement("input");
    starsInput.type = "number";
    starsInput.min = "0";
    starsInput.step = "1";
    starsInput.className = "stars-input";
    starsInput.value = String(entity.stars);
    starsInput.setAttribute("aria-label", `${entity.name} stars`);
    starsInput.addEventListener("input", () => {
      const raw = starsInput.value.trim();
      const n = Number(raw);
      const ok = raw !== "" && isFinite(n) && n >= 0 && Number.isInteger(n);
      starsInput.classList.toggle("invalid", !ok);
      if (!ok) return;
      setStat(id, "stars", n);
      updateEffectivePriceCell(id);
      renderChart();
    });
    starsInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      focusNextStarsInput(starsInput);
    });
    tdStars.appendChild(starsInput);

    const tdMarket = cell(tr);
    const marketSelect = document.createElement("select");
    marketSelect.className = "market-select";
    marketSelect.setAttribute("aria-label", `${entity.name} market`);
    for (const opt of MARKET_OPTIONS) {
      const option = document.createElement("option");
      option.value = String(opt.value);
      option.textContent = opt.label;
      marketSelect.appendChild(option);
    }
    marketSelect.value = String(entity.market);
    marketSelect.addEventListener("change", () => {
      setStat(id, "market", Number(marketSelect.value));
      updateEffectivePriceCell(id);
      renderChart();
    });
    tdMarket.appendChild(marketSelect);

    const tdEff = cell(tr);
    tdEff.className = "price-readonly";
    tdEff.dataset.effFor = id;
    tdEff.textContent = F().formatMoney(entity.sellPrice);
  }

  // Move focus to the next unlocked row's stars field, wrapping around. If
  // `current` isn't itself in that list (e.g. its row just got locked), jump
  // to the first one instead.
  function focusNextStarsInput(current) {
    const inputs = Array.from(
      document.querySelectorAll(".stat-table tr:not(.locked) .stars-input")
    );
    if (inputs.length === 0) return;
    const idx = inputs.indexOf(current);
    const next = inputs[idx === -1 ? 0 : (idx + 1) % inputs.length];
    next.focus();
    next.select();
  }

  // Rewrite one row's effective-price cell in place (used after a per-row
  // stars/market edit) without rebuilding the table, so focus/caret survive.
  function updateEffectivePriceCell(id) {
    const td = document.querySelector(`.price-readonly[data-eff-for="${id}"]`);
    if (!td) return;
    td.textContent = F().formatMoney(resolved(id).sellPrice);
  }

  // Rewrite every row's effective-price cell (used after a global bonus
  // control changes, since that shifts every entity's price at once) without
  // rebuilding the table, so the focused control keeps its caret.
  function refreshEffectivePrices() {
    for (const td of document.querySelectorAll(".price-readonly[data-eff-for]")) {
      td.textContent = F().formatMoney(resolved(td.dataset.effFor).sellPrice);
    }
  }

  // `mult` is the researched-tech ingredient-cost multiplier (1 = no effect).
  // When it isn't 1, a second "effective" field is shown alongside the raw
  // one the player edits — either can be typed into, and they stay linked.
  function renderIngredientCell(tr, entity, id, mult) {
    const td = cell(tr);
    td.className = "col-ingredients";
    for (const ing of entity.ingredients) {
      const child = DEFAULT_BY_ID[ing.sellableId];
      const row = document.createElement("div");
      row.className = "ing-row";

      const name = document.createElement("span");
      name.className = "ing-name";
      name.appendChild(entityIcon(child.id));
      name.appendChild(document.createTextNode(" " + child.name));

      const x = document.createElement("span");
      x.className = "ing-x";
      x.textContent = "×";

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "any";
      input.value = String(ing.amount);
      input.setAttribute("aria-label", `${entity.name} ${child.name} amount`);

      let effInput = null;
      input.addEventListener("input", () => {
        const raw = input.value.trim();
        const n = Number(raw);
        const ok = raw !== "" && isFinite(n) && n > 0;
        input.classList.toggle("invalid", !ok);
        if (!ok) return;
        setIngredientAmount(id, ing.sellableId, n);
        if (effInput) effInput.value = String(F().effectiveIngredientAmount(n, mult));
        renderChart();
      });

      row.appendChild(name);
      row.appendChild(x);
      row.appendChild(input);

      if (mult !== 1) {
        const arrow = document.createElement("span");
        arrow.className = "eff-arrow";
        arrow.textContent = "→";
        row.appendChild(arrow);

        effInput = document.createElement("input");
        effInput.type = "number";
        effInput.min = "0";
        effInput.step = "any";
        effInput.value = String(F().effectiveIngredientAmount(ing.amount, mult));
        effInput.className = "eff-input";
        effInput.setAttribute(
          "aria-label",
          `${entity.name} ${child.name} amount (effective)`
        );
        effInput.addEventListener("input", () => {
          const raw = effInput.value.trim();
          const n = Number(raw);
          const ok = raw !== "" && isFinite(n) && n > 0;
          effInput.classList.toggle("invalid", !ok);
          if (!ok) return;
          const base = n / mult;
          setIngredientAmount(id, ing.sellableId, base);
          input.value = String(base);
          renderChart();
        });
        row.appendChild(effInput);
      }

      td.appendChild(row);
    }
  }

  // Checkbox id <-> controls key for each researched-tech toggle. Shared by
  // initControls (wiring) and syncControlsUI (post-import resync).
  const TECH_TOGGLES = [
    ["tech-advanced-furnace", "techAdvancedFurnace"],
    ["tech-smelting-efficiency", "techSmeltingEfficiency"],
    ["tech-superior-furnace", "techSuperiorFurnace"],
    ["tech-advanced-crafting", "techAdvancedCrafting"],
    ["tech-superior-crafting", "techSuperiorCrafting"],
    ["tech-crafting-efficiency", "techCraftingEfficiency"],
    ["tech-advanced-alloy-value", "techAdvancedAlloyValue"],
    ["tech-superior-alloy-value", "techSuperiorAlloyValue"],
    ["tech-advanced-item-value", "techAdvancedItemValue"],
    ["tech-superior-item-value", "techSuperiorItemValue"],
  ];

  // Every Mothership Room whose level feeds the price/speed model, generated
  // into #rooms-grid by renderRoomsGrid below (there are now 6 — too many to
  // keep hand-writing in index.html, especially once Sales/Marketing joined
  // Forge/Workshop/Underforge/Dorm). `kind` selects the formula in
  // model.js's roomMultiplier. Sales/Marketing change price only, not the
  // stat tables' effective time/ingredient twins, so their edits use the
  // caret-preserving tier-2 refresh instead of a full renderAll() — see
  // priceOnly below.
  const ROOMS = [
    { key: "forgeLevel", label: "Forge", kind: "speed", max: 60, effect: "smelt speed" },
    { key: "workshopLevel", label: "Workshop", kind: "speed", max: 60, effect: "craft speed" },
    { key: "underforgeLevel", label: "Underforge", kind: "ingredient", max: 11, effect: "alloy ingredients" },
    { key: "dormLevel", label: "Dorm", kind: "ingredient", max: 11, effect: "item ingredients" },
    { key: "salesRoomLevel", label: "Sales", kind: "sales", max: 60, effect: "alloy & item sell price", priceOnly: true },
    {
      key: "marketingRoomLevel",
      label: "Marketing",
      kind: "marketing",
      max: 60,
      effect: "scales market rolls above ×1",
      priceOnly: true,
    },
  ];

  // Every Station tech-node category, generated into #station-grid by
  // renderStationGrid below. "value" is the Items & Alloys ladder (boosts
  // alloy/item sell value) — it changes price only, like Sales/Marketing
  // above, unlike Smelting/Crafting which change the stat tables' effective
  // smelt/craft time.
  const STATION_CATEGORIES = [
    { prefix: "smelting", label: "Smelting", maxLevels: [5, 10, 15, 20, 20] },
    { prefix: "crafting", label: "Crafting", maxLevels: [5, 10, 15, 20, 20] },
    { prefix: "value", label: "Value", maxLevels: [5, 5, 5, 4, 4, 2, 2], priceOnly: true },
  ];

  // Formats a Room level's computed multiplier for its hint span, e.g. "2.10x".
  function roomMultiplierHint(kind, level) {
    return Number(F().roomMultiplier(kind, level).toFixed(2)) + "x";
  }

  // Formats one Station node's own bonus for its hint span, e.g. "+5%".
  function stationNodeHint(category, index, level) {
    const pct = Math.round(F().stationNodeBonus(category, index, level) * 100);
    return `+${pct}%`;
  }

  // Formats a Station category's combined multiplier across its nodes, e.g.
  // "2.50x". Nodes stack additively within a category (see
  // stationCategoryMultiplier in model.js).
  function stationCategoryHint(prefix) {
    const cat = STATION_CATEGORIES.find((c) => c.prefix === prefix);
    const levels = cat.maxLevels.map((_, i) => state.controls[`${prefix}${i + 1}`]);
    return Number(F().stationCategoryMultiplier(prefix, levels).toFixed(2)) + "x";
  }

  // Rebuilds #rooms-grid from ROOMS/state.controls. Full-rebuild-on-change,
  // the same convention as renderManagersList/renderModuleEffectsList below,
  // so initControls and syncControlsUI (post-import) share one code path.
  function renderRoomsGrid() {
    const container = document.getElementById("rooms-grid");
    container.innerHTML = "";
    for (const room of ROOMS) {
      const row = document.createElement("div");
      row.className = "room-row";

      const label = document.createElement("span");
      label.className = "room-label";
      label.textContent = room.label;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = String(room.max);
      input.step = "1";
      input.value = String(state.controls[room.key]);
      input.setAttribute("aria-label", `${room.label} level`);

      const hint = document.createElement("span");
      hint.className = "control-hint room-hint";
      hint.textContent = roomMultiplierHint(room.kind, state.controls[room.key]);

      const effect = document.createElement("span");
      effect.className = "room-effect";
      effect.textContent = room.effect;

      input.addEventListener("input", () => {
        const raw = input.value.trim();
        const n = Number(raw);
        const ok = raw !== "" && isFinite(n) && Number.isInteger(n) && n >= 0 && n <= room.max;
        input.classList.toggle("invalid", !ok);
        if (!ok) return;
        state.controls[room.key] = n;
        hint.textContent = roomMultiplierHint(room.kind, n);
        saveState();
        updateGroupSummary("rooms");
        if (room.priceOnly) {
          refreshEffectivePrices();
          renderChart();
        } else {
          // Forge/Workshop/Underforge/Dorm change the stat tables' effective
          // smelt/craft time or ingredient amount, not just price.
          renderAll();
        }
      });

      row.append(label, input, hint, effect);
      container.appendChild(row);
    }
  }

  // Rebuilds #station-grid from STATION_CATEGORIES/state.controls. Same
  // full-rebuild convention as renderRoomsGrid above.
  function renderStationGrid() {
    const container = document.getElementById("station-grid");
    container.innerHTML = "";
    for (const cat of STATION_CATEGORIES) {
      const group = document.createElement("div");
      group.className = "station-category";

      const head = document.createElement("div");
      head.className = "station-category-head";
      const name = document.createElement("span");
      name.className = "station-name";
      name.textContent = cat.label;
      const total = document.createElement("span");
      total.className = "control-hint";
      total.textContent = stationCategoryHint(cat.prefix);
      head.append(name, total);

      const nodes = document.createElement("div");
      nodes.className = "station-nodes";
      nodes.style.setProperty("--node-count", String(cat.maxLevels.length));

      cat.maxLevels.forEach((max, i) => {
        const key = `${cat.prefix}${i + 1}`;
        const node = document.createElement("div");
        node.className = "station-node";

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = String(max);
        input.step = "1";
        input.value = String(state.controls[key]);
        input.setAttribute("aria-label", `${cat.label} node ${i + 1} level`);

        const hint = document.createElement("span");
        hint.className = "control-hint";
        hint.textContent = stationNodeHint(cat.prefix, i, state.controls[key]);

        input.addEventListener("input", () => {
          const raw = input.value.trim();
          const n = Number(raw);
          const ok = raw !== "" && isFinite(n) && Number.isInteger(n) && n >= 0 && n <= max;
          input.classList.toggle("invalid", !ok);
          if (!ok) return;
          state.controls[key] = n;
          hint.textContent = stationNodeHint(cat.prefix, i, n);
          total.textContent = stationCategoryHint(cat.prefix);
          saveState();
          updateGroupSummary("station");
          if (cat.priceOnly) {
            refreshEffectivePrices();
            renderChart();
          } else {
            // Smelting/Crafting change the stat tables' effective smelt/
            // craft time, not just price.
            renderAll();
          }
        });

        node.append(input, hint);
        nodes.appendChild(node);
      });

      group.append(head, nodes);
      container.appendChild(group);
    }
  }

  // ---- disclosure groups & their live summaries ----------------------

  // <details> id (minus the "group-" prefix) <-> what its <summary> reports
  // while collapsed, so the whole setup is readable without opening
  // anything. Recomputed after any change that could affect the text.
  function groupSummaryText(key) {
    switch (key) {
      case "tech": {
        const n = TECH_TOGGLES.filter(([, k]) => state.controls[k]).length;
        return `${n} of ${TECH_TOGGLES.length} researched`;
      }
      case "rooms": {
        const bought = ROOMS.filter((r) => state.controls[r.key] > 0);
        return bought.length ? bought.map((r) => `${r.label} ${state.controls[r.key]}`).join(" · ") : "Not purchased";
      }
      case "station":
        return STATION_CATEGORIES.map((c) => `${c.label.toLowerCase()} ${stationCategoryHint(c.prefix)}`).join(" · ");
      case "managers": {
        const n = state.controls.managers.length;
        return n === 0 ? "None" : `${n} manager${n === 1 ? "" : "s"}`;
      }
      case "modules": {
        const n = state.controls.moduleEffects.length;
        return n === 0 ? "None" : `${n} effect${n === 1 ? "" : "s"}`;
      }
      case "ores":
      case "alloys":
      case "items": {
        const cat = key === "ores" ? "ore" : key === "alloys" ? "alloy" : "item";
        const all = DEFAULT_ENTITIES.filter((e) => e.category === cat);
        const unlocked = all.filter((e) => isUnlocked(e.id)).length;
        return `${unlocked} of ${all.length} unlocked`;
      }
      default:
        return "";
    }
  }

  function updateGroupSummary(key) {
    const el = document.getElementById(`summary-${key}`);
    if (el) el.textContent = groupSummaryText(key);
  }

  function updateAllGroupSummaries() {
    for (const key of Object.keys(state.controls.open)) updateGroupSummary(key);
  }

  // Wires each <details> group's open/closed state to state.controls.open
  // (view state only — never affects the model) and seeds its summary text.
  function initDisclosures() {
    for (const key of Object.keys(state.controls.open)) {
      const details = document.getElementById(`group-${key}`);
      if (!details) continue;
      details.open = state.controls.open[key];
      details.addEventListener("toggle", () => {
        state.controls.open[key] = details.open;
        saveState();
      });
    }
    updateAllGroupSummaries();
  }

  // ---- controls ----------------------------------------------------

  // Rebuilds the #managers-list rows from state.controls.managers. Each row
  // mutates its manager object in place (a live reference into that array)
  // before saveState(), the same convention used elsewhere in this file for
  // per-entity overrides.
  function renderManagersList() {
    const container = document.getElementById("managers-list");
    container.innerHTML = "";
    for (const m of state.controls.managers) {
      const row = document.createElement("div");
      row.className = "manager-row";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = m.name;
      nameInput.placeholder = "Manager name";
      nameInput.setAttribute("aria-label", "Manager name");
      nameInput.addEventListener("input", () => {
        m.name = nameInput.value;
        saveState();
      });

      const typeSelect = document.createElement("select");
      for (const [value, label] of [
        ["none", "No speed boost"],
        ["smelt", "Smelt speed"],
        ["craft", "Craft speed"],
      ]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (m.boostType === value) opt.selected = true;
        typeSelect.appendChild(opt);
      }
      typeSelect.setAttribute("aria-label", `${m.name || "Manager"} boost type`);

      const amountInput = document.createElement("input");
      amountInput.type = "number";
      amountInput.min = "0";
      amountInput.step = "any";
      amountInput.value = String(m.boostAmount);
      amountInput.disabled = m.boostType === "none";
      amountInput.setAttribute("aria-label", `${m.name || "Manager"} boost amount`);

      typeSelect.addEventListener("change", () => {
        m.boostType = typeSelect.value;
        amountInput.disabled = m.boostType === "none";
        saveState();
        renderAll();
      });

      amountInput.addEventListener("input", () => {
        const raw = amountInput.value.trim();
        const n = Number(raw);
        const ok = raw !== "" && isFinite(n) && n > 0;
        amountInput.classList.toggle("invalid", !ok);
        if (!ok) return;
        m.boostAmount = n;
        saveState();
        renderAll();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "manager-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", `Remove ${m.name || "manager"}`);
      removeBtn.addEventListener("click", () => {
        state.controls.managers = state.controls.managers.filter((x) => x.id !== m.id);
        saveState();
        renderManagersList();
        updateGroupSummary("managers");
        renderAll();
      });

      row.append(nameInput, typeSelect, amountInput, removeBtn);
      container.appendChild(row);
    }
  }

  // Category id <-> label for the Module-effect dropdown. Wider than
  // Managers' 3-value enum since a single Module effect can land in any of
  // the 7 categories this app tracks (speed, ingredient cost, or sell
  // value, including ore value — e.g. the Multiweave Hub's value
  // sub-effect) — see moduleEffectMultiplier in model.js. An effect
  // touching more than one category (a Module's "main effect" commonly
  // boosts both smelt and craft speed at once) needs one row per category.
  const MODULE_EFFECT_CATEGORY_LABELS = [
    ["none", "No effect"],
    ["smeltSpeed", "Smelt speed"],
    ["craftSpeed", "Craft speed"],
    ["alloyIngredient", "Alloy ingredient cost"],
    ["itemIngredient", "Item ingredient cost"],
    ["oreValue", "Ore sell value"],
    ["alloyValue", "Alloy sell value"],
    ["itemValue", "Item sell value"],
  ];

  // Rebuilds the #module-effects-list rows from state.controls.moduleEffects.
  // Structurally identical to renderManagersList above (reuses the same
  // .manager-row/.manager-remove styling — these are the same kind of
  // "player-entered, open-ended list" row, just with more category options.
  function renderModuleEffectsList() {
    const container = document.getElementById("module-effects-list");
    container.innerHTML = "";
    for (const e of state.controls.moduleEffects) {
      const row = document.createElement("div");
      row.className = "manager-row";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = e.name;
      nameInput.placeholder = "Module / effect name";
      nameInput.setAttribute("aria-label", "Module effect name");
      nameInput.addEventListener("input", () => {
        e.name = nameInput.value;
        saveState();
      });

      const categorySelect = document.createElement("select");
      for (const [value, label] of MODULE_EFFECT_CATEGORY_LABELS) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (e.category === value) opt.selected = true;
        categorySelect.appendChild(opt);
      }
      categorySelect.setAttribute("aria-label", `${e.name || "Module effect"} category`);

      const amountInput = document.createElement("input");
      amountInput.type = "number";
      amountInput.min = "0";
      amountInput.step = "any";
      amountInput.value = String(e.amount);
      amountInput.disabled = e.category === "none";
      amountInput.setAttribute("aria-label", `${e.name || "Module effect"} amount`);

      categorySelect.addEventListener("change", () => {
        e.category = categorySelect.value;
        amountInput.disabled = e.category === "none";
        saveState();
        renderAll();
      });

      amountInput.addEventListener("input", () => {
        const raw = amountInput.value.trim();
        const n = Number(raw);
        const ok = raw !== "" && isFinite(n) && n > 0;
        amountInput.classList.toggle("invalid", !ok);
        if (!ok) return;
        e.amount = n;
        saveState();
        renderAll();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "manager-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", `Remove ${e.name || "module effect"}`);
      removeBtn.addEventListener("click", () => {
        state.controls.moduleEffects = state.controls.moduleEffects.filter((x) => x.id !== e.id);
        saveState();
        renderModuleEffectsList();
        updateGroupSummary("modules");
        renderAll();
      });

      row.append(nameInput, categorySelect, amountInput, removeBtn);
      container.appendChild(row);
    }
  }

  function initControls() {
    segmented("scale-control", "scale");
    segmented("category-control", "category");

    const sortSel = document.getElementById("sort-control");
    sortSel.value = state.controls.sort;
    sortSel.addEventListener("change", () => {
      state.controls.sort = sortSel.value;
      saveState();
      renderChart();
    });

    for (const [checkboxId, key] of TECH_TOGGLES) {
      const cb = document.getElementById(checkboxId);
      cb.checked = state.controls[key];
      cb.addEventListener("change", () => {
        state.controls[key] = cb.checked;
        saveState();
        // Techs change the stat table's effective fields too, not just the
        // chart, so this needs the full re-render (unlike the other controls).
        renderAll();
      });
    }

    renderRoomsGrid();
    renderStationGrid();

    document.getElementById("add-manager-btn").addEventListener("click", () => {
      state.controls.managers.push({
        id: "m" + Math.random().toString(36).slice(2, 10),
        name: "",
        boostType: "none",
        boostAmount: 1,
      });
      saveState();
      renderManagersList();
      updateGroupSummary("managers");
    });
    renderManagersList();

    document.getElementById("add-module-effect-btn").addEventListener("click", () => {
      state.controls.moduleEffects.push({
        id: "e" + Math.random().toString(36).slice(2, 10),
        name: "",
        category: "none",
        amount: 1,
      });
      saveState();
      renderModuleEffectsList();
      updateGroupSummary("modules");
    });
    renderModuleEffectsList();

    document.getElementById("reset-all").addEventListener("click", () => {
      if (!confirm("Reset every stat and unlock back to the game defaults?")) return;
      resetAll();
      renderAll();
    });

    document.getElementById("export-data").addEventListener("click", exportData);

    const importInput = document.getElementById("import-file");
    document.getElementById("import-data").addEventListener("click", () => {
      importInput.value = ""; // allow re-importing the same file twice in a row
      importInput.click();
    });
    importInput.addEventListener("change", () => {
      const file = importInput.files[0];
      if (file) importData(file);
    });

    initDisclosures();
  }

  const importStatus = () => document.getElementById("import-status");

  // Hand the player a copy of everything they've entered — the only backup
  // that exists, since a code change or a browser evicting localStorage
  // (Safari/iOS, cleared site data, a new device) can't be undone otherwise.
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ipm-explorer-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const status = importStatus();
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        status.textContent = "That file isn't valid JSON — nothing was imported.";
        return;
      }
      if (
        !confirm(
          "Import this file? It will replace all your current stats and unlocks."
        )
      ) {
        return;
      }
      const next = normalizeState(parsed);
      state.overrides = next.overrides;
      state.controls = next.controls;
      saveState();
      syncControlsUI();
      renderAll();
      status.textContent = "Import complete.";
    };
    reader.onerror = () => {
      status.textContent = "Couldn't read that file — nothing was imported.";
    };
    reader.readAsText(file);
  }

  // Re-sync the chart-control widgets with state.controls after a bulk
  // replacement (import) rather than a single field's change.
  function syncControlsUI() {
    document.getElementById("sort-control").value = state.controls.sort;
    for (const [containerId, key] of [
      ["scale-control", "scale"],
      ["category-control", "category"],
    ]) {
      const container = document.getElementById(containerId);
      for (const b of container.querySelectorAll("button")) {
        b.classList.toggle("active", b.dataset.value === state.controls[key]);
      }
    }
    for (const [checkboxId, key] of TECH_TOGGLES) {
      document.getElementById(checkboxId).checked = state.controls[key];
    }
    renderRoomsGrid();
    renderStationGrid();
    renderManagersList();
    renderModuleEffectsList();
    for (const key of Object.keys(state.controls.open)) {
      const details = document.getElementById(`group-${key}`);
      if (details) details.open = state.controls.open[key];
    }
    updateAllGroupSummaries();
  }

  function segmented(containerId, controlKey) {
    const container = document.getElementById(containerId);
    const buttons = container.querySelectorAll("button");
    for (const b of buttons) {
      b.classList.toggle("active", b.dataset.value === state.controls[controlKey]);
      b.addEventListener("click", () => {
        state.controls[controlKey] = b.dataset.value;
        for (const other of buttons) other.classList.toggle("active", other === b);
        saveState();
        renderChart();
      });
    }
  }

  // ---- top-level render ------------------------------------------
  function renderAll() {
    renderChart();
    renderStatTables();
    updateAllGroupSummaries();
  }

  renderLegend();
  initControls();
  renderAll();
})();
