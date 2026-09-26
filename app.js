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
  const STAT_KEYS = ["stars", "smeltTimeSeconds"];

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
  const STORAGE_VERSION = 9;

  // Market boost presets, matching what the in-game Market dialog offers.
  // The colored chevrons next to this select (see boostChevronsSvg below)
  // already show the direction and count, so these labels stay plain
  // numbers rather than duplicating that with a second, uncolored set of
  // arrows.
  const MARKET_OPTIONS = [
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
      // Active market boosts, entered directly rather than derived — same
      // open-ended list shape as managers/moduleEffects (id, plus a
      // sellableId + amount per entry). See marketBoostFor below for how an
      // entry's amount reaches sellPriceParts as entity.market.
      marketBoosts: [],
      // Mothership Room levels (Forge/Workshop/Underforge/Dorm/Sales/
      // Marketing) and Station tech-node levels (Smelting/Crafting 5 each,
      // Items & Alloys "value" 7) — see techMultipliers/sellPriceParts in
      // model.js. 0 is a valid, common value here ("not purchased"/"not
      // researched") — see LEVEL_CONTROL_KEYS, which validates all of these.
      // Defaults reproduce profit.py's fixed per-category constants (Alloy
      // 1.04/1.45, Item 1.04/1.45): Sales level 7 -> x1.45, value4 level 2 ->
      // x1.04 (2 x 0.02/lvl, the only exact-fit combination of the value
      // ladder's per-node increments), Marketing level 0 -> x1.00 (no
      // active market boost in the default save). Ores have no station-value
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
      // market boosts change often; everything else defaults closed.
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

    // v7 -> v8: data.js's base smelt/craft times were corrected to the
    // game's true base values (19cf3e4), but a saved smeltTimeSeconds
    // override still has the player's own boosted in-game time baked in —
    // it can't be un-baked, so like the ingredient drop above it's dropped
    // rather than migrated: keeping it would silently double-apply the
    // Station/Manager/Forge/Workshop/Module speed boosts now modeled on top.
    const preV8 = !parsed || typeof parsed.version !== "number" || parsed.version < 8;

    // v8 -> v9: the per-entity `market` stat (a dropdown on every stats-table
    // row) was replaced by controls.marketBoosts, an explicit list of active
    // boosts edited in the Market card. STAT_KEYS no longer includes "market",
    // so a saved ov.market would otherwise just be dropped by the STAT_KEYS
    // loop below like any other unrecognized field — collected here instead
    // and turned into marketBoosts entries after the loop, so nobody's
    // current market state is lost.
    const preV9 = !parsed || typeof parsed.version !== "number" || parsed.version < 9;
    const migratedBoosts = [];

    const clean = {};
    for (const [id, ov] of Object.entries(overrides)) {
      if (!ov || typeof ov !== "object") continue;
      const entry = {};
      for (const k of STAT_KEYS) {
        if (preV8 && k === "smeltTimeSeconds") continue;
        if (typeof ov[k] === "number" && isFinite(ov[k]) && ov[k] >= 0) {
          entry[k] = ov[k];
        }
      }
      if (preV9 && typeof ov.market === "number" && isFinite(ov.market) && ov.market > 0 && ov.market !== 1) {
        migratedBoosts.push({
          id: "b" + Math.random().toString(36).slice(2, 10),
          sellableId: id,
          amount: ov.market,
        });
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
    if (preV9 && migratedBoosts.length) {
      incomingControls.marketBoosts = migratedBoosts;
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

    // Market boosts: same array-of-entries shape and validation approach as
    // Managers above. sellableId is kept even when it no longer matches a
    // data.js entity (e.g. after a rename) rather than dropped, per this
    // function's own no-silent-drop rule.
    const rawMarketBoosts = Array.isArray(incomingControls.marketBoosts)
      ? incomingControls.marketBoosts
      : [];
    const seenMarketBoostIds = new Set();
    const cleanMarketBoosts = [];
    for (const b of rawMarketBoosts) {
      if (!b || typeof b !== "object") continue;
      const sellableId = typeof b.sellableId === "string" ? b.sellableId : "";
      const amount =
        typeof b.amount === "number" && isFinite(b.amount) && b.amount > 0 ? b.amount : 1;
      let id = typeof b.id === "string" && b.id && !seenMarketBoostIds.has(b.id) ? b.id : null;
      if (!id) id = "b" + Math.random().toString(36).slice(2, 10);
      seenMarketBoostIds.add(id);
      cleanMarketBoosts.push({ id, sellableId, amount });
    }
    incomingControls.marketBoosts = cleanMarketBoosts;

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
      market: marketBoostFor(base.id),
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

  // controls.marketBoosts is an ordered list the player edits directly, so
  // two entries can name the same resource (an import, or a stale entry);
  // the last one wins, since the game only ever has one active boost per
  // resource. The list is a handful of entries, so scanning it per entity is
  // cheaper than caching a map that could go stale.
  function marketBoostFor(id) {
    let mult = 1;
    for (const b of state.controls.marketBoosts) {
      if (b.sellableId === id) mult = b.amount;
    }
    return mult;
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

  // Market boosts change every few hours in-game — this clears the whole
  // Market card's list in one go rather than making the player remove each
  // boost individually.
  function resetMarkets() {
    state.controls.marketBoosts = [];
    saveState();
  }

  // Per-value reset for the stat tables. Like resetMarkets, these delete the
  // key rather than writing the default back, and prune what they empty.
  function clearStat(id, key) {
    const ov = state.overrides[id];
    if (!ov) return;
    delete ov[key];
    if (!Object.keys(ov).length) delete state.overrides[id];
    saveState();
  }

  function clearIngredientAmount(id, sellableId) {
    const ov = state.overrides[id];
    if (!ov || !ov.ingredients) return;
    delete ov.ingredients[sellableId];
    if (!Object.keys(ov.ingredients).length) delete ov.ingredients;
    if (!Object.keys(ov).length) delete state.overrides[id];
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
      tdOn.className = "unlock-cell";
      const cbLabel = document.createElement("label");
      cbLabel.className = "unlock-toggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = unlocked;
      cb.setAttribute("aria-label", "Unlocked: " + base.name);
      cb.addEventListener("change", () => {
        setUnlocked(base.id, cb.checked);
        renderAll();
      });
      cbLabel.appendChild(cb);
      tdOn.appendChild(cbLabel);

      const tdName = cell(tr);
      tdName.className = "col-name";
      tdName.appendChild(entityIcon(base.id));
      tdName.appendChild(document.createTextNode(" " + base.name));

      renderStarsCell(tr, e, base.id);

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

      renderPriceCell(tr, e, base.id);
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

  // The revert button shown next to a derived value the player has overridden.
  // Its slot is always reserved (visibility, not display) so toggling it never
  // shifts the row. syncOverrideUI labels it with the value it restores so the
  // player sees what they get back before clicking.
  function resetButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stat-reset";
    btn.textContent = "↺";
    return btn;
  }

  // Keeps an input's orange styling and its revert button in step with whether
  // the player's stored value now yields a different effective number than the
  // default would.
  function syncOverrideUI(input, btn, overridden, restoreText, ariaPrefix) {
    input.classList.toggle("overridden", overridden);
    btn.classList.toggle("shown", overridden);
    btn.tabIndex = overridden ? 0 : -1;
    btn.title = overridden ? `Reset to ${restoreText}` : "";
    btn.setAttribute("aria-label", `${ariaPrefix} to ${restoreText}`);
  }

  // Shows the *effective* value (the base run through the researched-tech
  // multiplier `mult`; 1 = no effect). What the player types is an effective
  // number, stored as the implied base (n / mult) so it keeps tracking later
  // tech changes. A value that differs from what the model predicts is drawn in
  // orange with a revert button.
  function statInput(tr, entity, id, key, opts, mult) {
    const td = cell(tr);
    const wrap = document.createElement("span");
    wrap.className = "stat-wrap";

    function fieldValue(v) {
      return opts.format ? opts.format(v) : String(v);
    }
    const defBase = DEFAULT_BY_ID[id][key];
    const toEff = (b) => F().effectiveSmeltTime(b, mult);
    const defEff = toEff(defBase);

    const input = document.createElement("input");
    if (opts.format) {
      // text field so it can hold e.g. "3.05M" or "1h 5m"; opts.parse inverts it
      input.type = "text";
    } else {
      input.type = "number";
      input.min = "0";
      input.step = opts.integer ? "1" : "any";
    }
    input.value = fieldValue(toEff(entity[key]));
    input.setAttribute("aria-label", `${entity.name} ${key}`);

    const resetBtn = resetButton();
    function sync() {
      const stored = state.overrides[id] && state.overrides[id][key];
      const overridden = stored !== undefined && toEff(stored) !== defEff;
      syncOverrideUI(input, resetBtn, overridden, fieldValue(defEff), `Reset ${entity.name} ${key}`);
    }
    sync();

    input.addEventListener("input", () => {
      const raw = input.value.trim();
      const n = opts.parse ? opts.parse(raw) : Number(raw);
      let ok = raw !== "" && isFinite(n) && !Number.isNaN(n) && n >= 0;
      if (ok && opts.integer && !Number.isInteger(n)) ok = false;
      input.classList.toggle("invalid", !ok);
      if (!ok) return;
      // Typing the model's own number back stores the exact default base, not
      // the lossy n / mult (effectiveSmeltTime rounds), so it can't drift when
      // mult later changes.
      setStat(id, key, n === defEff ? defBase : n / mult);
      sync();
      renderChart();
    });
    resetBtn.addEventListener("click", () => {
      clearStat(id, key);
      input.value = fieldValue(defEff);
      input.classList.remove("invalid");
      sync();
      renderChart();
    });

    wrap.appendChild(input);
    wrap.appendChild(resetBtn);
    td.appendChild(wrap);
  }

  // Renders the editable stars cell, placed right next to the entity name so
  // it stays on screen together with the row it belongs to (see
  // renderStatTable). Stars is one of the inputs to sellPrice, computed in
  // renderPriceCells below along with the other price cells.
  //
  // The primary way to edit stars is the +/- stepper (hold to auto-repeat);
  // the number itself stays a real input so typing/Enter-to-next-row still
  // work as a secondary path. See focusNextStarsInput below, which depends
  // on the "stars-input" class staying on that field.
  function renderStarsCell(tr, entity, id) {
    const tdStars = cell(tr);
    const wrap = document.createElement("span");
    wrap.className = "stars-stepper";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "stars-step";
    minusBtn.textContent = "−";
    minusBtn.setAttribute("aria-label", `Decrease ${entity.name} stars`);

    const starsInput = document.createElement("input");
    starsInput.type = "number";
    starsInput.min = "0";
    starsInput.step = "1";
    starsInput.inputMode = "numeric";
    starsInput.className = "stars-input";
    starsInput.value = String(entity.stars);
    starsInput.setAttribute("aria-label", `${entity.name} stars`);

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "stars-step";
    plusBtn.textContent = "+";
    plusBtn.setAttribute("aria-label", `Increase ${entity.name} stars`);

    // Renders during a hold only touch the current row (cheap); the chart —
    // a full recompute across all entities plus a Chart.js destroy/rebuild
    // (see renderChart) — is deferred until the hold ends so a fast repeat
    // doesn't janks it every tick.
    function commit(n, { deferChart } = {}) {
      starsInput.value = String(n);
      minusBtn.disabled = n <= 0;
      setStat(id, "stars", n);
      updateEffectivePriceCell(id);
      if (deferChart) return;
      renderChart();
    }

    starsInput.addEventListener("focus", () => starsInput.select());
    starsInput.addEventListener("input", () => {
      const raw = starsInput.value.trim();
      const n = Number(raw);
      const ok = raw !== "" && isFinite(n) && n >= 0 && Number.isInteger(n);
      starsInput.classList.toggle("invalid", !ok);
      if (!ok) return;
      commit(n);
    });
    starsInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      focusNextStarsInput(starsInput);
    });

    // Press-and-hold auto-repeat: one immediate step on press, then repeats
    // after a short delay, accelerating after ~1s. Pointer capture keeps the
    // hold alive (and endable) even if the finger/cursor slides off the
    // button.
    function bindStep(btn, delta) {
      let timeoutId = null;
      let intervalId = null;
      function step() {
        const current = Number(starsInput.value) || 0;
        const next = Math.max(0, current + delta);
        if (next !== current) commit(next, { deferChart: true });
      }
      let active = false;
      function stop() {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        timeoutId = null;
        intervalId = null;
        // Guards against a spurious render on e.g. tabbing focus off the
        // button without ever pressing it (blur fires with nothing pending).
        if (!active) return;
        active = false;
        renderChart();
      }
      btn.addEventListener("pointerdown", (ev) => {
        if (btn.disabled) return;
        active = true;
        // Best-effort: keeps the hold going if the pointer slides off the
        // button. Not critical — swallow so a capture failure never blocks
        // the step below.
        try {
          btn.setPointerCapture(ev.pointerId);
        } catch (e) {
          /* ignore */
        }
        step();
        timeoutId = setTimeout(() => {
          intervalId = setInterval(step, 160);
          timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            intervalId = setInterval(step, 50);
          }, 1000);
        }, 500);
      });
      btn.addEventListener("pointerup", stop);
      btn.addEventListener("pointercancel", stop);
      btn.addEventListener("lostpointercapture", stop);
      btn.addEventListener("blur", stop);
    }
    bindStep(minusBtn, -1);
    bindStep(plusBtn, 1);

    minusBtn.disabled = entity.stars <= 0;

    wrap.appendChild(minusBtn);
    wrap.appendChild(starsInput);
    wrap.appendChild(plusBtn);
    tdStars.appendChild(wrap);
  }

  // Renders the read-only effective sell price (the product of basePrice,
  // stars, market, and the global bonus controls — see sellPriceParts in
  // model.js). Stars is rendered separately by renderStarsCell; market comes
  // from the Market card's boost list now, not a per-row control; the rest
  // come from the "Sell price bonuses" card and apply across every row.
  function renderPriceCell(tr, entity, id) {
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
      const defBase = DEFAULT_BY_ID[id].ingredients.find(
        (i) => i.sellableId === ing.sellableId
      ).amount;
      const toEff = (b) => F().effectiveIngredientAmount(b, mult);
      const defEff = toEff(defBase);

      const row = document.createElement("div");
      row.className = "ing-row";

      const name = document.createElement("span");
      name.className = "ing-name";
      name.appendChild(entityIcon(child.id));
      name.appendChild(document.createTextNode(" " + child.name));

      const x = document.createElement("span");
      x.className = "ing-x";
      x.textContent = "×";

      // Shows the effective amount; what's typed is stored as the implied base
      // (see statInput).
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "any";
      input.value = String(toEff(ing.amount));
      input.setAttribute("aria-label", `${entity.name} ${child.name} amount`);

      const resetBtn = resetButton();
      function sync() {
        const stored =
          state.overrides[id] &&
          state.overrides[id].ingredients &&
          state.overrides[id].ingredients[ing.sellableId];
        const overridden = stored !== undefined && toEff(stored) !== defEff;
        syncOverrideUI(
          input,
          resetBtn,
          overridden,
          String(defEff),
          `Reset ${entity.name} ${child.name} amount`
        );
      }
      sync();

      input.addEventListener("input", () => {
        const raw = input.value.trim();
        const n = Number(raw);
        const ok = raw !== "" && isFinite(n) && n > 0;
        input.classList.toggle("invalid", !ok);
        if (!ok) return;
        setIngredientAmount(id, ing.sellableId, n === defEff ? defBase : n / mult);
        sync();
        renderChart();
      });
      resetBtn.addEventListener("click", () => {
        clearIngredientAmount(id, ing.sellableId);
        input.value = String(defEff);
        input.classList.remove("invalid");
        sync();
        renderChart();
      });

      row.appendChild(name);
      row.appendChild(x);
      row.appendChild(input);
      row.appendChild(resetBtn);
      td.appendChild(row);
    }
  }

  // The 10 TECH_TREE (data.js) nodes that actually feed the model, i.e. the
  // ones with a `key` — the rest are inert context tiles. Shared by
  // renderTechTree (rebuild) and updateGroupSummary (the "N of 10" count).
  const TECH_NODES = TECH_TREE.nodes.filter((n) => n.key);

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
      effect: "scales market boosts above ×1",
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

  // Formats a Room level's computed effect for its hint span. Ingredient
  // rooms (Underforge/Dorm) show a discount ("-30%"), matching how the game
  // itself displays them, even though the underlying multiplier (consumed by
  // sellPriceParts/techMultipliers) is unchanged. Every other kind keeps the
  // multiplier display, e.g. "2.10x".
  function roomMultiplierHint(kind, level) {
    const mult = F().roomMultiplier(kind, level);
    if (kind === "ingredient") {
      const pct = Math.round((1 - mult) * 100);
      return pct === 0 ? "0%" : `-${pct}%`;
    }
    return Number(mult.toFixed(2)) + "x";
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

  // Rebuilds #tech-tree from TECH_TREE (data.js), laid out on a CSS grid at
  // the same col/row coordinates as the in-game tech tree. Modeled nodes
  // (those with a `key`) are clickable buttons wired to state.controls;
  // nodes without a `key` are other in-game techs this tool doesn't model,
  // rendered dim and inert just to keep the tree's shape recognizable and
  // its connector lines from dead-ending. Same full-rebuild convention as
  // renderStationGrid above.
  function renderTechTree() {
    const container = document.getElementById("tech-tree");
    container.style.setProperty("--tech-cols", String(TECH_TREE.cols));
    container.style.setProperty("--tech-rows", String(TECH_TREE.rows));

    const nodeByCoordId = {};
    for (const node of TECH_TREE.nodes) nodeByCoordId[`c${node.col}r${node.row}`] = node;
    const lines = TECH_TREE.edges
      .map(([a, b]) => {
        const na = nodeByCoordId[a];
        const nb = nodeByCoordId[b];
        return `<line x1="${na.col + 0.5}" y1="${na.row + 0.5}" x2="${nb.col + 0.5}" y2="${nb.row + 0.5}" />`;
      })
      .join("");
    container.innerHTML = `<svg class="tech-tree-edges" viewBox="0 0 ${TECH_TREE.cols} ${TECH_TREE.rows}" preserveAspectRatio="none">${lines}</svg>`;

    for (const node of TECH_TREE.nodes) {
      const el = document.createElement(node.key ? "button" : "div");
      el.className = "tech-node";
      el.style.gridColumn = String(node.col + 1);
      el.style.gridRow = String(node.row + 1);

      if (node.key) {
        el.type = "button";
        const researched = !!state.controls[node.key];
        el.classList.toggle("is-researched", researched);
        el.setAttribute("aria-pressed", String(researched));
        el.title = `${node.name} — ${node.effect}`;
        el.setAttribute("aria-label", el.title);
      } else {
        el.classList.add("is-context");
        el.setAttribute("aria-hidden", "true");
      }

      const iconId = node.key ? node.id : `tech-tree/ctx-c${node.col}r${node.row}`;
      const icon = entityIcon(iconId);
      icon.className = "tech-icon";
      el.appendChild(icon);

      if (node.key) {
        const label = document.createElement("span");
        label.className = "tech-name";
        label.textContent = node.name;
        el.appendChild(label);

        el.addEventListener("click", () => {
          const next = !state.controls[node.key];
          state.controls[node.key] = next;
          el.classList.toggle("is-researched", next);
          el.setAttribute("aria-pressed", String(next));
          saveState();
          updateGroupSummary("tech");
          // Techs change the stat table's effective fields too, not just the
          // chart, so this needs the full re-render (unlike the other
          // controls) — same as the checkbox list this replaced.
          renderAll();
        });
      }

      container.appendChild(el);
    }
  }

  // ---- disclosure groups & their live summaries ----------------------

  // <details> id (minus the "group-" prefix) <-> what its <summary> reports
  // while collapsed, so the whole setup is readable without opening
  // anything. Recomputed after any change that could affect the text.
  function groupSummaryText(key) {
    switch (key) {
      case "tech": {
        const n = TECH_NODES.filter((node) => state.controls[node.key]).length;
        return `${n} of ${TECH_NODES.length} researched`;
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

  // Category id -> singular label, for the resource-search listbox's
  // per-option category hint (ore/alloy/item are the only categories
  // DEFAULT_ENTITIES uses — see data.js).
  const CATEGORY_LABELS = {
    ore: "Ore",
    alloy: "Alloy",
    item: "Item",
  };

  // How many up/down chevrons a boost's amount draws, matching the in-game
  // Market dialog's own arrow count: x2/x0.5 -> 1, x3/x0.33 -> 2, and so on.
  // Capped at 4 so an off-preset amount (e.g. an older/imported save) can't
  // draw an arbitrarily tall stack.
  function boostChevronCount(amount) {
    const raw = amount >= 1 ? amount : 1 / amount;
    return Math.max(1, Math.min(4, Math.round(raw) - 1));
  }

  // Builds the small stacked-chevron indicator next to a boost tag's amount,
  // colored green (boost) or red (glut) via currentColor — see .boost-up/
  // .boost-down in styles.css. Always the same overall height regardless of
  // count, so a x5 tag isn't taller than a x2 tag.
  function boostChevronsSvg(amount) {
    const svgNS = "http://www.w3.org/2000/svg";
    const up = amount >= 1;
    const count = boostChevronCount(amount);
    const pitch = 4;
    const chevronHeight = 3;
    const stackHeight = chevronHeight + (count - 1) * pitch;
    const startY = (18 - stackHeight) / 2;
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 10 18");
    svg.setAttribute("class", "boost-chevrons");
    svg.setAttribute("aria-hidden", "true");
    for (let i = 0; i < count; i++) {
      const y = startY + i * pitch;
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute(
        "d",
        up ? `M1.5,${y + chevronHeight} L5,${y} L8.5,${y + chevronHeight}` : `M1.5,${y} L5,${y + chevronHeight} L8.5,${y}`
      );
      svg.appendChild(path);
    }
    return svg;
  }

  // Set to a just-added boost's id right before renderMarketBoostsList() so
  // that one tag (and only that one) plays the boost-enter entrance
  // animation — the whole list is rebuilt on every change, so without this
  // every tag would replay the animation on every edit, not just its own
  // arrival.
  let lastAddedBoostId = null;

  // Rebuilds the #market-boosts-list tags from state.controls.marketBoosts,
  // and shows/hides the "Clear all" button (#reset-markets) alongside them —
  // it's redundant with a single tag's own remove button, so it only earns
  // its place once there are 2+ boosts to clear at once.
  function renderMarketBoostsList() {
    const container = document.getElementById("market-boosts-list");
    container.innerHTML = "";
    const boosts = state.controls.marketBoosts;

    if (!boosts.length) {
      const empty = document.createElement("p");
      empty.className = "boost-empty";
      empty.textContent = "No boosts set. Add the resources currently boosted in your game's market.";
      container.appendChild(empty);
    }

    for (const b of boosts) {
      const entity = DEFAULT_BY_ID[b.sellableId];
      const tag = document.createElement("div");
      tag.className = "boost-tag " + (b.amount >= 1 ? "boost-up" : "boost-down");
      if (b.id === lastAddedBoostId) tag.classList.add("boost-enter");

      if (entity) {
        tag.appendChild(entityIcon(entity.id));
        const name = document.createElement("span");
        name.className = "boost-name";
        name.textContent = entity.name;
        tag.appendChild(name);
      } else {
        // A sellableId that no longer matches any entity (e.g. after a
        // rename) is kept rather than silently dropped — shown as its own
        // raw id instead of an icon+name so it's still visible and editable.
        const name = document.createElement("span");
        name.className = "boost-name boost-name-unknown";
        name.textContent = b.sellableId || "(no resource)";
        tag.appendChild(name);
      }

      tag.appendChild(boostChevronsSvg(b.amount));

      const amountSelect = document.createElement("select");
      amountSelect.className = "boost-amount";
      amountSelect.setAttribute("aria-label", `${entity ? entity.name : "resource"} boost amount`);
      let amountMatched = false;
      for (const opt of MARKET_OPTIONS) {
        const option = document.createElement("option");
        option.value = String(opt.value);
        option.textContent = opt.label;
        if (opt.value === b.amount) {
          option.selected = true;
          amountMatched = true;
        }
        amountSelect.appendChild(option);
      }
      // Same round-trip rule as the resource id above, for an amount not
      // among today's presets (e.g. an older/imported save).
      if (!amountMatched) {
        const option = document.createElement("option");
        option.value = String(b.amount);
        option.textContent = `×${b.amount}`;
        option.selected = true;
        amountSelect.insertBefore(option, amountSelect.firstChild);
      }
      amountSelect.addEventListener("change", () => {
        b.amount = Number(amountSelect.value);
        saveState();
        renderMarketBoostsList();
        renderAll();
      });
      tag.appendChild(amountSelect);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "boost-remove";
      removeBtn.textContent = "✕";
      removeBtn.setAttribute("aria-label", `Remove ${entity ? entity.name : "resource"} boost`);
      removeBtn.addEventListener("click", () => {
        state.controls.marketBoosts = state.controls.marketBoosts.filter((x) => x.id !== b.id);
        saveState();
        renderMarketBoostsList();
        renderAll();
      });
      tag.appendChild(removeBtn);

      container.appendChild(tag);
    }
    lastAddedBoostId = null;

    document.getElementById("reset-markets").hidden = boosts.length < 2;
  }

  // Wires up the "Add a resource…" combobox once at startup. Unlike the tag
  // list above, this widget is never torn down and rebuilt — only the
  // dropdown's own option list is refreshed as the player types or a boost
  // is added/removed elsewhere — so focus and the typed query survive
  // across keystrokes.
  function initResourceSearch() {
    const input = document.getElementById("resource-search-input");
    const listbox = document.getElementById("resource-search-listbox");
    let options = []; // entities currently shown in the listbox
    let activeIndex = -1;

    function availableEntities(query) {
      const taken = new Set(state.controls.marketBoosts.map((b) => b.sellableId));
      const q = query.trim().toLowerCase();
      return DEFAULT_ENTITIES.filter(
        (e) => !taken.has(e.id) && (!q || e.name.toLowerCase().includes(q))
      );
    }

    function setActive(index) {
      activeIndex = index;
      for (const li of listbox.children) {
        li.classList.toggle("active", li.dataset.index === String(index));
      }
      input.setAttribute("aria-activedescendant", index >= 0 ? `resource-option-${index}` : "");
    }

    function openList() {
      options = availableEntities(input.value);
      listbox.innerHTML = "";
      for (const [i, e] of options.entries()) {
        const li = document.createElement("li");
        li.id = `resource-option-${i}`;
        li.className = "resource-option";
        li.setAttribute("role", "option");
        li.dataset.index = String(i);
        li.appendChild(entityIcon(e.id));
        const name = document.createElement("span");
        name.className = "resource-option-name";
        name.textContent = e.name;
        li.appendChild(name);
        const cat = document.createElement("span");
        cat.className = "resource-option-cat";
        cat.textContent = CATEGORY_LABELS[e.category];
        li.appendChild(cat);
        // mousedown (not click) fires before the input's blur, so choosing
        // with the mouse commits before closeList()'s blur handler runs.
        li.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          commit(e.id);
        });
        listbox.appendChild(li);
      }
      const hasOptions = options.length > 0;
      listbox.hidden = !hasOptions;
      input.setAttribute("aria-expanded", String(hasOptions));
      setActive(hasOptions ? 0 : -1);
    }

    function closeList() {
      listbox.hidden = true;
      input.setAttribute("aria-expanded", "false");
      setActive(-1);
    }

    function commit(sellableId) {
      const boost = { id: "b" + Math.random().toString(36).slice(2, 10), sellableId, amount: 2 };
      state.controls.marketBoosts.push(boost);
      saveState();
      lastAddedBoostId = boost.id;
      renderMarketBoostsList();
      renderAll();
      input.value = "";
      openList();
      input.focus();
    }

    input.addEventListener("input", openList);
    input.addEventListener("focus", openList);
    input.addEventListener("blur", () => {
      // Deferred so a listbox mousedown's preventDefault (above) still gets
      // to run commit() before the list closes.
      setTimeout(closeList, 100);
    });
    input.addEventListener("keydown", (ev) => {
      if (listbox.hidden && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
        openList();
        return;
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        if (options.length) setActive((activeIndex + 1) % options.length);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (options.length) setActive((activeIndex - 1 + options.length) % options.length);
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        if (activeIndex >= 0 && options[activeIndex]) commit(options[activeIndex].id);
      } else if (ev.key === "Escape") {
        closeList();
      }
    });
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

    renderTechTree();

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

    initResourceSearch();
    renderMarketBoostsList();

    document.getElementById("reset-all").addEventListener("click", () => {
      if (!confirm("Reset every stat and unlock back to the game defaults?")) return;
      resetAll();
      renderAll();
    });

    document.getElementById("reset-markets").addEventListener("click", () => {
      resetMarkets();
      renderMarketBoostsList();
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
    renderTechTree();
    renderRoomsGrid();
    renderStationGrid();
    renderManagersList();
    renderModuleEffectsList();
    renderMarketBoostsList();
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
