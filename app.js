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
  const STAT_KEYS = ["stars", "baseSellPrice", "smeltTimeSeconds", "marketBoost"];

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
    formatDuration,
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
  let selectedId = null;
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
    const out = {
      id: base.id,
      name: base.name,
      category: base.category,
      ingredients: base.ingredients,
      baseSellPrice: pick(ov.baseSellPrice, base.baseSellPrice),
      stars: pick(ov.stars, base.stars),
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

  function resetEntityStats(id) {
    const ov = state.overrides[id];
    if (!ov) return;
    for (const k of STAT_KEYS) delete ov[k];
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
        onClick: (evt, els) => {
          if (els && els.length) openEditor(currentRows[els[0].index].entity.id);
        },
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

  // ---- edit panel -----------------------------------------------------
  function openEditor(id) {
    selectedId = id;
    const e = resolved(id);
    document.getElementById("edit-empty").hidden = true;
    const form = document.getElementById("edit-form");
    form.hidden = false;

    document.getElementById("edit-name").textContent = e.name;
    document.getElementById("edit-category").textContent = e.category;

    setInput("edit-stars", e.stars);
    setInput("edit-price", e.baseSellPrice);
    setInput("edit-smelt", e.smeltTimeSeconds);
    setInput("edit-boost", e.marketBoost);

    document.getElementById("field-smelt").style.display =
      e.category === "ore" ? "none" : "";

    clearErrors(form);
    updateSmeltHint();
    renderDerived();
  }

  function setInput(inputId, value) {
    const el = document.getElementById(inputId);
    el.value = String(value);
    el.classList.remove("invalid");
  }

  function clearErrors(scope) {
    scope.querySelectorAll(".field-error").forEach((s) => (s.textContent = ""));
    scope.querySelectorAll("input").forEach((i) => i.classList.remove("invalid"));
  }

  const FIELD_RULES = {
    "edit-stars": { key: "stars", integer: true, min: 0, label: "Stars" },
    "edit-price": { key: "baseSellPrice", min: 0, label: "Base sell price" },
    "edit-smelt": { key: "smeltTimeSeconds", min: 0, label: "Smelt time" },
    "edit-boost": { key: "marketBoost", min: 0, exclusiveMin: true, label: "Market boost" },
  };

  function validateField(inputId) {
    const rule = FIELD_RULES[inputId];
    const el = document.getElementById(inputId);
    const err = document.getElementById("err-" + inputId.split("-")[1]);
    const raw = el.value.trim();
    let msg = "";
    const n = Number(raw);
    if (raw === "" || Number.isNaN(n) || !isFinite(n)) {
      msg = "Enter a number";
    } else if (rule.integer && !Number.isInteger(n)) {
      msg = "Must be a whole number";
    } else if (rule.exclusiveMin && n <= rule.min) {
      msg = `Must be greater than ${rule.min}`;
    } else if (!rule.exclusiveMin && n < rule.min) {
      msg = `Must be ${rule.min} or more`;
    }
    el.classList.toggle("invalid", !!msg);
    err.textContent = msg;
    return msg ? null : n;
  }

  function onEditInput(inputId) {
    const val = validateField(inputId);
    if (inputId === "edit-smelt") updateSmeltHint();
    if (val === null || !selectedId) return;
    setStat(selectedId, FIELD_RULES[inputId].key, val);
    renderDerived();
    renderChart();
    renderOreTable(); // ore sell price may be shown there too
  }

  function updateSmeltHint() {
    const raw = document.getElementById("edit-smelt").value.trim();
    const n = Number(raw);
    const hint = document.getElementById("hint-smelt");
    hint.textContent =
      raw !== "" && isFinite(n) && n >= 60 ? `= ${F().formatDuration(n)}` : "";
  }

  function renderDerived() {
    if (!selectedId) return;
    const byId = resolvedMap();
    const memos = F().newMemos();
    const e = byId[selectedId];
    const price = F().sellPrice(e);
    const cost = F().netIngredientMaterialCost(e, byId, memos.cost);
    const time = F().totalTimeToCreate(e, byId, memos.time);
    const rows = [
      ["Sell price", F().formatMoney(price)],
      ["Ingredient cost", F().formatMoney(cost)],
      ["Time to create", F().formatDuration(time)],
    ];
    if (e.category !== "ore") {
      rows.push(["Profit / sec", F().formatMoneyPerSec((price - cost) / time)]);
    }
    document.getElementById("edit-derived").innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join("");
  }

  // ---- ore table -----------------------------------------------------
  function renderOreTable() {
    const byId = resolvedMap();
    const tbody = document.getElementById("ore-tbody");
    tbody.innerHTML = "";
    for (const base of DEFAULT_ENTITIES.filter((e) => e.category === "ore")) {
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
      const nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = "ore-name-btn";
      nameBtn.textContent = base.name;
      nameBtn.addEventListener("click", () => openEditor(base.id));
      tdName.appendChild(nameBtn);

      oreInput(tr, e, base.id, "stars", { integer: true });
      oreInput(tr, e, base.id, "baseSellPrice", {});
      oreInput(tr, e, base.id, "marketBoost", { exclusiveMin: true });

      const tdPrice = cell(tr);
      tdPrice.textContent = F().formatMoney(F().sellPrice(e));

      tbody.appendChild(tr);
    }
  }

  function cell(tr) {
    const td = document.createElement("td");
    tr.appendChild(td);
    return td;
  }

  function oreInput(tr, entity, id, key, opts) {
    const td = cell(tr);
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = opts.integer ? "1" : "any";
    input.value = String(entity[key]);
    input.setAttribute("aria-label", `${entity.name} ${key}`);
    input.addEventListener("input", () => {
      const raw = input.value.trim();
      const n = Number(raw);
      let ok = raw !== "" && isFinite(n) && !Number.isNaN(n);
      if (ok && opts.integer && !Number.isInteger(n)) ok = false;
      if (ok && opts.exclusiveMin && n <= 0) ok = false;
      if (ok && !opts.exclusiveMin && n < 0) ok = false;
      input.classList.toggle("invalid", !ok);
      if (!ok) return;
      setStat(id, key, n);
      td.parentElement.lastElementChild.textContent = F().formatMoney(
        F().sellPrice(resolved(id))
      );
      renderChart();
      if (selectedId) renderDerived();
    });
    td.appendChild(input);
  }

  // ---- unlock lists -------------------------------------------------
  function renderUnlockLists() {
    fillUnlock("unlock-alloys", "alloy");
    fillUnlock("unlock-items", "item");
  }

  function fillUnlock(ulId, category) {
    const ul = document.getElementById(ulId);
    ul.innerHTML = "";
    for (const base of DEFAULT_ENTITIES.filter((e) => e.category === category)) {
      const unlocked = isUnlocked(base.id);
      const li = document.createElement("li");
      if (!unlocked) li.className = "is-locked";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = unlocked;
      cb.id = "unlock-" + base.id;
      cb.addEventListener("change", () => {
        setUnlocked(base.id, cb.checked);
        renderAll();
      });

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "name-btn";
      btn.textContent = base.name;
      btn.addEventListener("click", () => openEditor(base.id));

      li.appendChild(cb);
      li.appendChild(btn);
      ul.appendChild(li);
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
      if (selectedId && !DEFAULT_BY_ID[selectedId]) selectedId = null;
      closeEditorIfLocked();
      renderAll();
      if (selectedId) openEditor(selectedId);
    });

    document.getElementById("edit-reset").addEventListener("click", () => {
      if (!selectedId) return;
      resetEntityStats(selectedId);
      openEditor(selectedId);
      renderChart();
      renderOreTable();
    });

    for (const inputId of Object.keys(FIELD_RULES)) {
      document
        .getElementById(inputId)
        .addEventListener("input", () => onEditInput(inputId));
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

  function closeEditorIfLocked() {
    // editor stays open for any entity; nothing to do, but keep hook for clarity
  }

  // ---- top-level render ------------------------------------------
  function renderAll() {
    renderChart();
    renderOreTable();
    renderUnlockLists();
    if (selectedId) renderDerived();
  }

  renderLegend();
  initControls();
  renderAll();
})();
