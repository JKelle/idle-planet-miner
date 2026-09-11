# Idle Planet Miner — Profitability Explorer

**Live app:** https://jkelle.github.io/idle-planet-miner/

A tool for the mobile game [Idle Planet
Miner](https://idle-planet-miner.fandom.com/wiki/Idle_Planet_Miner_Wiki) that
helps you figure out which alloy or item is most profitable to smelt or craft
per second, given *your own* current in-game state (star levels, prices,
active market boosts, etc.) — not a pre-baked "optimal strategy".

The numbers you see when you first open it are one player's save. Edit the
sell prices, boosts, and unlock toggles in the Stats section to match your
own game.

## Development

The web app is a static site (`index.html`, `styles.css`, `data.js`,
`model.js`, `app.js`) with no build step — open `index.html` directly, or
run `python3 -m http.server` and visit `localhost:8000`. State is saved to
`localStorage` in your browser; there's no backend.

`profit.py` is the original Python/matplotlib version the web app was ported
from — see `CLAUDE.md` for details on both.
