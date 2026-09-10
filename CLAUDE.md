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

There is no build/lint/test tooling yet. Run the existing script directly:

```
python3 profit.py
```

This prints a profit/sec ranking of all alloys and items to stdout and pops
up matplotlib bar charts (requires `matplotlib` installed).

## Repository state

- `profit.py` — the current implementation: a Python model of the game's
  ores/alloys/items and a script that computes and plots profit-per-second.
  This is the reference implementation for the game-economy math.
- `PRD.md` — product requirements for turning `profit.py` into an
  interactive static web app (editable stats, live-updating chart with
  axis/sort/filter controls). No web app code exists yet — this is the spec
  to build against.

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
