# PRD: Idle Planet Miner Profitability Explorer

## 1. Background

`profit.py` currently models the game's ores, alloys, and items as Python
objects (`Ore`, `Alloy`, `Item`, all subclassing `Sellable`). Each has a base
sell price, a star rating (each star = +20% sell price), an optional list of
ingredients (with quantities), a smelt/craft time, and fixed
project/station/sales-room bonus multipliers per category. A `MARKET_BOOSTS`
dict applies a temporary multiplier to specific items by name. The script
computes `profit_per_second` for every alloy and item (sell price minus the
recursive raw-ore cost of its ingredients, divided by total time to produce)
and renders static matplotlib bar charts (linear/log, per-category and
combined).

This PRD covers turning that one-off script into an interactive web app.

## 2. Goal

Let the user interactively explore which alloy or item is most profitable to
smelt/craft, by editing the game's stat values (stars, price, craft time,
market boosts) and immediately seeing the effect on a profit-per-second bar
chart, with controls for axis scale, sort order, and category filtering.

## 3. Non-Goals (v1)

- No backend/server — this is a static, client-side-only web app.
- No user accounts or multi-device sync.
- No adding/removing ores, alloys, or items, or editing ingredient recipes/quantities — the entity set and recipe graph are fixed, ported as-is from `profit.py`.
- No editing of project/station/sales-room bonus multipliers (these stay as fixed per-category constants, same as today).
- ~~No deployment/hosting step — runs locally for now (e.g. open `index.html` or run a local dev server).~~ Done: deployed to GitHub Pages at https://jkelle.github.io/idle-planet-miner/.

## 4. Users

Just the requester, using this as a personal decision-support tool while
playing Idle Planet Miner.

## 5. Data Model

Port the existing `profit.py` data into a static JS data module (or JSON),
preserving the object graph:

```
Sellable {
  id: string            // stable key, e.g. slug of name
  name: string
  category: "ore" | "alloy" | "item"
  baseSellPrice: number
  stars: number
  smeltTimeSeconds: number
  ingredients: [{ sellableId: string, amount: number }]
  marketBoost: number    // default 1.0
}
```

Derived (computed, never stored):

- `sellPrice = baseSellPrice * marketBoost * (1 + 0.2 * stars) * categoryBonuses`
  - `categoryBonuses` for ore = 1.0 for all three factors; alloy = 1.44 × 1.04 × 1.45; item = 1.20 × 1.04 × 1.45 (matches current hardcoded values in `profit.py`).
- `netIngredientMaterialCost`: recursive raw-ore cost of ingredients (same algorithm as `Sellable.get_net_ingredient_material_cost`).
- `totalTimeToCreate`: recursive sum of ingredient creation time + own smelt time.
- `profitPerSecond = (sellPrice - netIngredientMaterialCost) / totalTimeToCreate` — defined only for alloys and items (ores have no craft time and are excluded from the chart, matching current behavior).

Any edit to any entity (including an ore several levels down an ingredient
chain) must recompute derived values for everything that depends on it, live.

## 6. Functional Requirements

### 6.1 Editing values

- **Alloys and items**: click a bar in the chart to open an edit
  panel/popover for that entity, with fields for stars, base sell price,
  smelt time, and market boost. Changes apply live and re-render the chart.
- **Ores**: ores are never plotted (no profit/sec), so provide a separate,
  always-visible compact panel/table listing all ores with the same editable
  fields (stars, base sell price, market boost — no smelt time, since ores
  have none). This is the only way to edit ore stats.
- Numeric inputs should validate for non-negative numbers and reject invalid entry inline (no silent NaN/negative values reaching calculations).
- Provide a **"Reset to defaults"** action (global, and/or per-entity) that restores `profit.py`'s original values.

### 6.2 Persistence

- Edited values persist across page reloads via `localStorage`.
- Defaults (from the ported data module) are the fallback/reset target and are never mutated.

### 6.3 Chart

- A single bar chart visible at a time (no side-by-side subplot grids like the current script's `fig`/`fig2`).
- X-axis: entity name. Y-axis: profit per second, formatted with the existing K/M/B/T suffix convention from `format_money_per_sec` in `profit.py`.
- Use a **horizontal bar chart** (names on the axis running alongside the bars) rather than rotated x-axis tick labels — with ~15–25 items this reads more cleanly and is the more polished choice. Bars sorted per the active sort order (see below).
- Hovering/tapping a bar shows a tooltip with: sell price, net ingredient cost, total time to create, and profit/sec.
- Clicking a bar (for alloys/items) opens the edit panel from 6.1.

### 6.4 Chart controls

Persistent toggle/control bar above or beside the chart:

- **Axis scale**: linear / log toggle for the value axis.
- **Sort order**: profit/sec descending (default), profit/sec ascending, alphabetical A→Z, alphabetical Z→A.
- **Category filter**: All (alloys + items), Alloys only, Items only.

All three controls update the same chart in place — never multiple charts on screen at once.

## 7. Non-Functional Requirements

- **Stack**: static site — plain HTML/CSS/JS (a lightweight framework is fine if it simplifies state management, but no backend/API).
- **Charting library**: use a well-established, actively maintained JS charting library appropriate for a static site (e.g. Chart.js or Plotly.js) — implementer's choice, but it must natively support log-scale axes and hover tooltips so we aren't hand-rolling those.
- **Design**: clean, modern, light theme — card-based layout, one consistent accent color, clear typography hierarchy, generous whitespace. Should feel like a polished dashboard, not a raw data dump. Follow good accessibility practice (sufficient color contrast, focus states on interactive controls).
- **Responsiveness**: should be usable on a typical laptop viewport at minimum; mobile support is a nice-to-have, not required for v1.
- **Performance**: edits must re-render the chart with no perceptible lag (all computation is simple arithmetic over ~40 entities).

## 8. Out of Scope / Future Work

- Editable project/station/sales-room bonus levels.
- Adding/removing ores/alloys/items or editing recipes.
- ~~Deployment to static hosting (GitHub Pages/Vercel/etc.).~~ Done: deployed to GitHub Pages at https://jkelle.github.io/idle-planet-miner/.
- Multi-user accounts / server-side persistence.
- Additional chart types (e.g. cost breakdown, time-to-create comparisons).

## 9. Assumptions Made in This PRD

- Ores are edited via a separate always-visible panel/table (not click-on-bar), since they don't appear in the profit chart themselves.
- Market boost is exposed as an editable per-entity multiplier (default 1.0), generalizing today's hardcoded `MARKET_BOOSTS` dict.
- Sort order options are: profit/sec desc/asc and alphabetical A–Z/Z–A.
- Horizontal bar orientation is used for chart readability instead of the current script's rotated vertical labels.
- Charting library is left to the implementer's judgment, constrained to one that supports log axes and tooltips natively.
