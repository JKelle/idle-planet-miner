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
  const STAT_KEYS = ["sellPrice", "smeltTimeSeconds"];

  // Bump this whenever a stat key is removed/renamed or an override's shape
  // changes, and add a migration step in normalizeState below. Never change
  // STORAGE_KEY itself (that would just orphan everyone's existing save under
  // the old key) and never let unrecognized fields get silently dropped on
  // load/save — that's how past deploys ("Editable sell price", "Remove
  // market boost") ended up discarding players' saved edits.
  const STORAGE_VERSION = 2;

  // model.js declares these as globals in the browser (classic script). Bridge
  // them onto one object so the rest of this file reads uniformly.
  window.__model = {
    sellPrice,
    netIngredientMaterialCost,
    totalTimeToCreate,
    profitPerSecond,
    newMemos,
    techMultipliers,
    formatMoney,
    formatMoneyPerSec,
    formatCompact,
    splitCompact,
    SUFFIX_TIERS,
    formatDuration,
    formatDurationCompact,
    parseDuration,
  };

  // Sell-price suffix dropdown, low to high, plus a "—" entry for the bare
  // (×1) tier. SUFFIX_TIERS itself is ordered high to low (largest-first,
  // for formatCompact's lookup), so build this the other way round.
  const SUFFIX_OPTIONS = [{ value: "", mult: 1 }].concat(
    SUFFIX_TIERS.slice()
      .reverse()
      .map(([mult, value]) => ({ value, mult }))
  );

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
      techAdvancedAlloyValue: false,
      techSuperiorAlloyValue: false,
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
      if (ov.ingredients && typeof ov.ingredients === "object") {
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
      if (Object.keys(entry).length) clean[id] = entry;
    }

    return {
      version: STORAGE_VERSION,
      overrides: clean,
      controls: Object.assign(defaultControls(), (parsed && parsed.controls) || {}),
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
  function resolved(id) {
    const base = DEFAULT_BY_ID[id];
    const ov = state.overrides[id] || {};
    const ovIng = ov.ingredients || {};
    const out = {
      id: base.id,
      name: base.name,
      category: base.category,
      ingredients: base.ingredients.map((i) => ({
        sellableId: i.sellableId,
        amount: pick(ovIng[i.sellableId], i.amount),
      })),
      sellPrice: pick(ov.sellPrice, base.sellPrice),
      smeltTimeSeconds: pick(ov.smeltTimeSeconds, base.smeltTimeSeconds),
    };
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

  // Layers the researched-tech multipliers on top of resolved() — only alloys
  // are affected (smelters make alloys; items change only indirectly, through
  // the recipe recursion over their alloy ingredients).
  function withTechs(entity, mults) {
    if (entity.category !== "alloy") return entity;
    return {
      id: entity.id,
      name: entity.name,
      category: entity.category,
      ingredients: entity.ingredients.map((i) => ({
        sellableId: i.sellableId,
        amount: i.amount * mults.ingredient,
      })),
      sellPrice: entity.sellPrice * mults.sellPrice,
      smeltTimeSeconds: entity.smeltTimeSeconds * mults.smeltTimeSeconds,
    };
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
    // Researched-tech multipliers only apply to alloys (smelters); ores and
    // items always get the identity multiplier so no "effective" field shows.
    const mults = F().techMultipliers(state.controls);
    const isAlloy = category === "alloy";
    const timeMult = isAlloy ? mults.smeltTimeSeconds : 1;
    const ingredientMult = isAlloy ? mults.ingredient : 1;
    const sellPriceMult = isAlloy ? mults.sellPrice : 1;

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

      renderSellPriceCell(tr, e, base.id, sellPriceMult);
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
      if (effInput) effInput.value = fieldValue(n * mult);
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
      effInput.value = fieldValue(entity[key] * mult);
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

  // Builds one $ + number + K/M/B/... suffix-dropdown widget (instead of one
  // free-text field) so the player can type digits and hit Enter without
  // reaching for a suffix letter. Shared by the raw and effective sell-price
  // fields — `onCommit` receives the fully-expanded value the player entered.
  function buildPriceWidget(entity, ariaLabel, value, onCommit) {
    const prefix = document.createElement("span");
    prefix.className = "price-prefix";
    prefix.textContent = "$";

    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.step = "any";
    numInput.min = "0";
    numInput.className = "price-num";
    numInput.setAttribute("aria-label", ariaLabel);

    const select = document.createElement("select");
    select.className = "price-suffix";
    for (const opt of SUFFIX_OPTIONS) {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.value || "—";
      select.appendChild(option);
    }
    select.setAttribute("aria-label", `${ariaLabel} suffix`);

    function setValue(v) {
      const { mantissa, suffix } = F().splitCompact(v);
      numInput.value = String(mantissa);
      select.value = suffix;
    }
    setValue(value);

    function commit() {
      const raw = numInput.value.trim();
      const n = Number(raw);
      const ok = raw !== "" && isFinite(n) && n >= 0;
      numInput.classList.toggle("invalid", !ok);
      if (!ok) return;
      const mult = SUFFIX_OPTIONS.find((o) => o.value === select.value).mult;
      onCommit(n * mult);
    }

    numInput.addEventListener("input", commit);
    select.addEventListener("change", commit);

    // A <td> can't safely be display:flex — that would opt it out of the
    // table's column-width sharing with its header cell. Flex an inner
    // wrapper instead so the cell itself stays a normal table-cell box.
    const wrap = document.createElement("span");
    wrap.className = "price-wrap";
    wrap.appendChild(prefix);
    wrap.appendChild(numInput);
    wrap.appendChild(select);
    return { wrap, numInput, setValue };
  }

  // `mult` is the researched-tech sell-price multiplier (1 = no effect).
  // When it isn't 1, a second "effective" widget is shown alongside the raw
  // one the player edits — either can be typed into, and they stay linked.
  function renderSellPriceCell(tr, entity, id, mult) {
    const td = cell(tr);
    const outer = document.createElement("span");
    outer.className = "stat-wrap";

    const raw = buildPriceWidget(
      entity,
      `${entity.name} sellPrice`,
      entity.sellPrice,
      (n) => {
        setStat(id, "sellPrice", n);
        if (eff) eff.setValue(n * mult);
        renderChart();
      }
    );
    raw.numInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      focusNextSellPriceInput(raw.numInput);
    });
    outer.appendChild(raw.wrap);

    let eff = null;
    if (mult !== 1) {
      const arrow = document.createElement("span");
      arrow.className = "eff-arrow";
      arrow.textContent = "→";
      outer.appendChild(arrow);

      eff = buildPriceWidget(
        entity,
        `${entity.name} sellPrice (effective)`,
        entity.sellPrice * mult,
        (n) => {
          const base = n / mult;
          setStat(id, "sellPrice", base);
          raw.setValue(base);
          renderChart();
        }
      );
      eff.wrap.classList.add("eff-input");
      outer.appendChild(eff.wrap);
    }

    td.appendChild(outer);
  }

  // Move focus to the next unlocked row's raw sell-price field, wrapping
  // around (skips the effective one, so Enter never jumps into it). If
  // `current` isn't itself in that list (e.g. its row just got locked), jump
  // to the first one instead.
  function focusNextSellPriceInput(current) {
    const inputs = Array.from(
      document.querySelectorAll(
        ".stat-table tr:not(.locked) .price-wrap:not(.eff-input) .price-num"
      )
    );
    if (inputs.length === 0) return;
    const idx = inputs.indexOf(current);
    const next = inputs[idx === -1 ? 0 : (idx + 1) % inputs.length];
    next.focus();
    next.select();
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
        if (effInput) effInput.value = String(n * mult);
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
        effInput.value = String(ing.amount * mult);
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
    ["tech-advanced-alloy-value", "techAdvancedAlloyValue"],
    ["tech-superior-alloy-value", "techSuperiorAlloyValue"],
  ];

  // ---- controls ----------------------------------------------------
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
  }

  renderLegend();
  initControls();
  renderAll();
})();
