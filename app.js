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
  const STAT_KEYS = ["sellPrice", "smeltTimeSeconds", "marketBoost"];

  // model.js declares these as globals in the browser (classic script). Bridge
  // them onto one object so the rest of this file reads uniformly.
  window.__model = {
    sellPrice,
    netIngredientMaterialCost,
    totalTimeToCreate,
    profitPerSecond,
    newMemos,
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
  let chart = null;
  let currentRows = []; // [{ entity, value }] in chart order

  function defaultControls() {
    return { scale: "linear", sort: "profit-desc", category: "all" };
  }

  function loadState() {
    const fallback = { overrides: {}, controls: defaultControls() };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const overrides =
        parsed && typeof parsed.overrides === "object" && parsed.overrides
          ? parsed.overrides
          : {};
      // keep only known ids / keys
      const clean = {};
      for (const [id, ov] of Object.entries(overrides)) {
        if (!DEFAULT_BY_ID[id] || !ov || typeof ov !== "object") continue;
        const entry = {};
        for (const k of STAT_KEYS) {
          if (typeof ov[k] === "number" && isFinite(ov[k]) && ov[k] >= 0) {
            entry[k] = ov[k];
          }
        }
        if (typeof ov.unlocked === "boolean") entry.unlocked = ov.unlocked;
        if (ov.ingredients && typeof ov.ingredients === "object") {
          const defAmounts = {};
          for (const ing of DEFAULT_BY_ID[id].ingredients) {
            defAmounts[ing.sellableId] = ing.amount;
          }
          const cleanIng = {};
          for (const [sid, amt] of Object.entries(ov.ingredients)) {
            if (
              sid in defAmounts &&
              typeof amt === "number" &&
              Number.isInteger(amt) &&
              amt >= 1
            ) {
              cleanIng[sid] = amt;
            }
          }
          if (Object.keys(cleanIng).length) entry.ingredients = cleanIng;
        }
        if (Object.keys(entry).length) clean[id] = entry;
      }
      return {
        overrides: clean,
        controls: Object.assign(defaultControls(), parsed.controls || {}),
      };
    } catch (e) {
      return fallback;
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
      marketBoost: pick(ov.marketBoost, base.marketBoost),
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

  // ---- overrides mutation ------------------------------------------------
  function setStat(id, key, value) {
    const ov = (state.overrides[id] = state.overrides[id] || {});
    if (value === DEFAULT_BY_ID[id][key]) {
      delete ov[key];
    } else {
      ov[key] = value;
    }
    pruneOverride(id);
    saveState();
  }

  function setIngredientAmount(id, sellableId, value) {
    const defAmount = DEFAULT_BY_ID[id].ingredients.find(
      (i) => i.sellableId === sellableId
    ).amount;
    const ov = (state.overrides[id] = state.overrides[id] || {});
    const ing = (ov.ingredients = ov.ingredients || {});
    if (value === defAmount) {
      delete ing[sellableId];
    } else {
      ing[sellableId] = value;
    }
    if (Object.keys(ing).length === 0) delete ov.ingredients;
    pruneOverride(id);
    saveState();
  }

  function pruneOverride(id) {
    const ov = state.overrides[id];
    if (ov && Object.keys(ov).length === 0) delete state.overrides[id];
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
    if (value === DEFAULT_BY_ID[id].unlockedByDefault) {
      const ov = state.overrides[id];
      if (ov) {
        delete ov.unlocked;
        pruneOverride(id);
      }
    } else {
      const ov = (state.overrides[id] = state.overrides[id] || {});
      ov.unlocked = value;
    }
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
    const byId = resolvedMap();
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

  // ---- market boosts --------------------------------------------------
  const CATEGORY_LABELS = { ore: "Ores", alloy: "Alloys", item: "Items" };

  function renderBoosts() {
    const byId = resolvedMap();
    const list = document.getElementById("boost-list");
    list.innerHTML = "";

    const boosted = DEFAULT_ENTITIES.filter((e) => byId[e.id].marketBoost !== 1);
    if (boosted.length === 0) {
      const empty = document.createElement("p");
      empty.className = "boost-empty";
      empty.textContent = "No active boosts.";
      list.appendChild(empty);
    }

    for (const base of boosted) {
      const e = byId[base.id];
      const row = document.createElement("div");
      row.className = "boost-row";

      const name = document.createElement("span");
      name.className = "boost-name";
      name.textContent = base.name;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "any";
      input.value = String(e.marketBoost);
      input.className = "boost-input";
      input.dataset.entityId = base.id;
      input.setAttribute("aria-label", `${base.name} market boost`);
      input.addEventListener("input", () => {
        const raw = input.value.trim();
        const n = Number(raw);
        const ok = raw !== "" && isFinite(n) && n > 0;
        input.classList.toggle("invalid", !ok);
        if (!ok) return;
        setStat(base.id, "marketBoost", n);
        renderChart();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "boost-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${base.name} boost`);
      remove.addEventListener("click", () => {
        setStat(base.id, "marketBoost", 1);
        renderBoosts();
        renderChart();
      });

      row.appendChild(name);
      row.appendChild(input);
      row.appendChild(remove);
      list.appendChild(row);
    }

    renderBoostAddSelect(byId, boosted);
  }

  function renderBoostAddSelect(byId, boosted) {
    const select = document.getElementById("boost-add-select");
    select.innerHTML = "";
    const boostedIds = new Set(boosted.map((e) => e.id));

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose entity…";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    for (const category of ["ore", "alloy", "item"]) {
      const candidates = DEFAULT_ENTITIES.filter(
        (e) => e.category === category && isUnlocked(e.id) && !boostedIds.has(e.id)
      );
      if (candidates.length === 0) continue;
      const group = document.createElement("optgroup");
      group.label = CATEGORY_LABELS[category];
      for (const e of candidates) {
        const option = document.createElement("option");
        option.value = e.id;
        option.textContent = e.name;
        group.appendChild(option);
      }
      select.appendChild(group);
    }

    select.onchange = () => {
      const id = select.value;
      if (!id) return;
      setStat(id, "marketBoost", 2);
      renderBoosts();
      renderChart();
      const added = document.querySelector(
        `#boost-list input[data-entity-id="${id}"]`
      );
      if (added) {
        added.focus();
        added.select();
      }
    };
  }

  // ---- stat tables --------------------------------------------------
  function renderStatTables() {
    renderStatTable("ore-tbody", "ore");
    renderStatTable("alloy-tbody", "alloy");
    renderStatTable("item-tbody", "item");
  }

  function renderStatTable(tbodyId, category) {
    const byId = resolvedMap();
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
      tdName.textContent = base.name;

      if (isOre) {
        cell(tr); // time — not applicable to ores
        cell(tr); // ingredients — not applicable to ores
      } else {
        statInput(tr, e, base.id, "smeltTimeSeconds", {
          format: F().formatDurationCompact,
          parse: F().parseDuration,
        });
        renderIngredientCell(tr, e, base.id);
      }

      renderSellPriceCell(tr, e, base.id);
      tbody.appendChild(tr);
    }
  }

  function cell(tr) {
    const td = document.createElement("td");
    tr.appendChild(td);
    return td;
  }

  function statInput(tr, entity, id, key, opts) {
    const td = cell(tr);
    const input = document.createElement("input");
    if (opts.format) {
      // text field so it can hold e.g. "3.05M" or "1h 5m"; opts.parse inverts it
      input.type = "text";
      input.value = opts.format(entity[key]);
    } else {
      input.type = "number";
      input.min = "0";
      input.step = opts.integer ? "1" : "any";
      input.value = String(entity[key]);
    }
    input.setAttribute("aria-label", `${entity.name} ${key}`);
    input.addEventListener("input", () => {
      const raw = input.value.trim();
      const n = opts.parse ? opts.parse(raw) : Number(raw);
      let ok = raw !== "" && isFinite(n) && !Number.isNaN(n) && n >= 0;
      if (ok && opts.integer && !Number.isInteger(n)) ok = false;
      input.classList.toggle("invalid", !ok);
      if (!ok) return;
      setStat(id, key, n);
      renderChart();
    });
    td.appendChild(input);
  }

  // Sell price is edited as a plain number plus a K/M/B/... suffix dropdown
  // (instead of one free-text field) so the player can type digits and hit
  // Enter without reaching for a suffix letter.
  function renderSellPriceCell(tr, entity, id) {
    const td = cell(tr);
    td.className = "col-price";

    const prefix = document.createElement("span");
    prefix.className = "price-prefix";
    prefix.textContent = "$";

    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.step = "any";
    numInput.min = "0";
    numInput.className = "price-num";
    numInput.setAttribute("aria-label", `${entity.name} sellPrice`);

    const select = document.createElement("select");
    select.className = "price-suffix";
    for (const opt of SUFFIX_OPTIONS) {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.value || "—";
      select.appendChild(option);
    }
    select.setAttribute("aria-label", `${entity.name} sell price suffix`);

    const { mantissa, suffix } = F().splitCompact(entity.sellPrice);
    numInput.value = String(mantissa);
    select.value = suffix;

    function commit() {
      const raw = numInput.value.trim();
      const n = Number(raw);
      const ok = raw !== "" && isFinite(n) && n >= 0;
      numInput.classList.toggle("invalid", !ok);
      if (!ok) return;
      const mult = SUFFIX_OPTIONS.find((o) => o.value === select.value).mult;
      setStat(id, "sellPrice", n * mult);
      renderChart();
    }

    numInput.addEventListener("input", commit);
    select.addEventListener("change", commit);
    numInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      focusNextSellPriceInput(numInput);
    });

    td.appendChild(prefix);
    td.appendChild(numInput);
    td.appendChild(select);
  }

  // Move focus to the next unlocked row's sell-price field, wrapping around.
  // If `current` isn't itself in that list (e.g. its row just got locked),
  // jump to the first one instead.
  function focusNextSellPriceInput(current) {
    const inputs = Array.from(
      document.querySelectorAll(".stat-table tr:not(.locked) .price-num")
    );
    if (inputs.length === 0) return;
    const idx = inputs.indexOf(current);
    const next = inputs[idx === -1 ? 0 : (idx + 1) % inputs.length];
    next.focus();
    next.select();
  }

  function renderIngredientCell(tr, entity, id) {
    const td = cell(tr);
    td.className = "col-ingredients";
    for (const ing of entity.ingredients) {
      const child = DEFAULT_BY_ID[ing.sellableId];
      const row = document.createElement("div");
      row.className = "ing-row";

      const name = document.createElement("span");
      name.className = "ing-name";
      name.textContent = child.name;

      const x = document.createElement("span");
      x.className = "ing-x";
      x.textContent = "×";

      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.step = "1";
      input.value = String(ing.amount);
      input.setAttribute("aria-label", `${entity.name} ${child.name} amount`);
      input.addEventListener("input", () => {
        const raw = input.value.trim();
        const n = Number(raw);
        const ok = raw !== "" && isFinite(n) && Number.isInteger(n) && n >= 1;
        input.classList.toggle("invalid", !ok);
        if (!ok) return;
        setIngredientAmount(id, ing.sellableId, n);
        renderChart();
      });

      row.appendChild(name);
      row.appendChild(x);
      row.appendChild(input);
      td.appendChild(row);
    }
  }

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

    document.getElementById("reset-all").addEventListener("click", () => {
      if (!confirm("Reset every stat and unlock back to the game defaults?")) return;
      resetAll();
      renderAll();
    });
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
    renderBoosts();
    renderStatTables();
  }

  renderLegend();
  initControls();
  renderAll();
})();
