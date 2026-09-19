# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

This is a side project for the mobile game **Idle Planet Miner** (fan wiki:
https://idle-planet-miner.fandom.com/wiki/Idle_Planet_Miner_Wiki). The goal
is to help the player figure out the most profitable thing to smelt/craft
*given their own current in-game state* (star levels, prices, active market
boosts, etc.) — not to hand them a pre-baked "optimal strategy". Do not pull
in or bake in other players' strategies, tier lists, or guides from the
internet (e.g. the wiki, forums, YouTube). The wiki is useful only as a
reference for raw game data (ore/alloy/item names, base prices, recipes,
smelt times) — never for strategy advice. The tool is intentionally an
approximation of the game's economy, not a perfect simulation; it will be
improved iteratively rather than trying to model every mechanic up front.

## Commands

There is no build/lint/test tooling. The web app is a static site with no
build step — open `index.html` directly in a browser, or serve it locally:

```
python3 -m http.server
```

The original Python script still runs standalone:

```
python3 profit.py
```

This prints a profit/sec ranking of all alloys and items to stdout and pops
up matplotlib bar charts (requires `matplotlib` installed).

## Repository state

- `index.html` / `styles.css` / `data.js` / `model.js` / `app.js` — the web
  app: an interactive, editable version of `profit.py`'s model with a
  live-updating Chart.js chart. Deployed via GitHub Pages
  (https://jkelle.github.io/idle-planet-miner/). Per-browser edits persist
  in `localStorage`; there is no backend or server-side state.
- `vendor/chart.umd.js` — Chart.js, vendored locally (not loaded from a CDN).
- `profit.py` — the original Python model of the game's ores/alloys/items
  and a script that computes and plots profit-per-second. Still the
  reference implementation for the game-economy math, but no longer kept in
  sync field-for-field with `data.js` (the web app dropped the
  stars/base-price/bonus derivation in favor of one directly-editable sell
  price per entity).
- `PRD.md` — product requirements the web app was built against.

## Architecture (`profit.py`)

The economy model is an object graph, not a flat table:

- `Sellable` is the base class with shared logic; `Ore`, `Alloy`, and `Item`
  subclass it and each register themselves into a module-level list
  (`ORES`, `ALLOYS`, `ITEMS`) on construction — so simply instantiating e.g.
  `Ore("Copper Ore", 1, stars=2)` at module scope is how new game data gets
  added, not by appending to a list manually.
- Each `Sellable` optionally has `ingredients`: a list of
  `(Sellable, amount)` tuples, forming a recipe DAG (e.g. an `Item` can
  require `Alloy`s, which require `Ore`s). `get_net_ingredient_material_cost`
  and `get_total_time_to_create` recurse down this graph to the raw ores.
- Sell price is computed as `base_sell_price * market_boost * star_bonus *
  project_bonus * station_bonus * sales_room_bonus`. The last three bonuses
  are fixed per category (`Ore`=1.0/1.0/1.0, `Alloy`=1.44/1.04/1.45,
  `Item`=1.20/1.04/1.45) — these represent bonus levels the player has
  presumably maxed out, and are not yet configurable.
- `MARKET_BOOSTS` is a name-keyed dict of temporary per-item multipliers
  (currently only Palladium is boosted); look up by `self.name` in
  `_get_market_boost`.
- Ores are excluded from profit/sec ranking and plotting — they have no
  craft time, so `profit_per_second` would divide by zero. Only `ALLOYS +
  ITEMS` are ranked/plotted.
- Higher-tier ores/alloys/items beyond what's currently obtainable in the
  player's game are present but commented out at the bottom of each section
  (ores, alloys, items) — uncomment as the player progresses rather than
  deleting/re-adding.

When extending this model (e.g. toward the web app in `PRD.md`), preserve
this recursive-ingredient-graph structure — profit calculations for any
alloy/item are only correct if they walk the full dependency chain down to
raw ore costs, not just their direct ingredients.

## Persistence (web app)

Player edits are the whole value of this tool — entering sell prices for
every ore/alloy/item is tedious, so losing them is treated as a critical
bug, not a cosmetic one. `app.js` stores them in `localStorage` under
`STORAGE_KEY` (`"ipm-explorer-v1"`) as `{ version, overrides, controls }`,
where `overrides` is sparse: it holds only fields a player actually touched,
keyed by entity id, and unrecognized ids/fields are kept rather than
dropped so a future rename can't silently discard someone's edits.

- **Never change `STORAGE_KEY`.** That would orphan every existing save
  under the old key with no migration path.
- **Never let `loadState`/`normalizeState` silently drop a field.** Two past
  deploys did this by accident (a whitelist of known stat keys quietly
  shrank), which is exactly the "my edits were forgotten" failure mode.
  Removing or renaming a stat key requires bumping `STORAGE_VERSION` and
  adding an explicit migration step in `normalizeState` instead.
- **An override should be written whenever the player touches a field, even
  if the value matches the current default.** Otherwise a later change to
  that default in `data.js` silently rewrites what looks like "their" value.
- The "Export my data" / "Import data" buttons are the only backup —
  `localStorage` can also be lost outside of any deploy (Safari/iOS
  eviction, cleared site data, a new device/browser), which the versioned
  schema above can't help with.

## Cache-busting (web app)

`index.html` loads `styles.css`/`data.js`/`model.js`/`app.js` each with its
own `?v=N` query string, since GitHub Pages caches aggressively and a stale
`v` means a returning player's browser can keep running old JS/CSS after a
deploy — silently, with no error.

- **Bump the `v` for every one of those four files a commit touches, in
  that same commit.** Easy to forget because the version lives in
  `index.html`, not the file you're actually editing. It's already bitten
  this project once: the "Round computed smelt/craft times" fix shipped
  touching `model.js`/`app.js` without bumping either `v`, so a returning
  player with either file cached could have missed it entirely.
- This also affects local testing, not just deploys: a browser profile
  that has ever loaded this app's `localhost` origin before will keep
  serving cached JS on later test sessions too, unless the `v` changes (or
  you force a hard reload) — a stale-looking result may just be a stale
  cache, not a bug in the edit itself.
