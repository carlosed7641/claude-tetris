# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page Tetris implementation in vanilla JavaScript with HTML5 Canvas rendering. No build process, no package manager, no external dependencies — three files: `index.html`, `style.css`, `game.js`.

## Running

Open directly, or serve statically:

```bash
open index.html                 # macOS, just works
python3 -m http.server 8000     # or any static server
```

There is no build, lint, or test tooling in this repo — changes are verified by opening `index.html` in a browser and playing.

## Architecture (`game.js`, ~300 lines, no modules)

Everything lives in one file as top-level `const`/`let` and functions operating on shared module-level state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`).

- **Board model**: `ROWS × COLS` matrix; each cell is `0` (empty) or an integer 1–8 indexing into `COLORS`/`PIECES` for the piece that placed it.
- **Pieces**: the 7 standard tetrominoes plus a non-standard 8th piece, the "nut" (`tuerca`), are each a square matrix in `PIECES`. Rotation (`rotateCW`) is a transpose + row-reverse, not a lookup table of rotation states. The nut is a 3×3 ring (`[[8,8,8],[8,0,8],[8,8,8]]`) with an empty center cell — `collide`/`merge` treat that `0` as empty like any other gap, so a line through a locked nut can't clear until another piece fills the hole. It's drawn specially via `drawNut()` (a gray plate with a dark circle) wherever it's the active/ghost/preview piece; once locked on the board it renders as plain blocks via the normal per-cell loop.
- **Collision** (`collide`): checks a shape at an offset against board bounds and already-locked cells.
- **Wall kicks** (`tryRotate`): on rotation collision, retries the rotated shape at horizontal offsets (±1, ±2 columns) before giving up.
- **Game loop** (`loop`, driven by `requestAnimationFrame`): accumulates elapsed time in `dropAccum`; when it exceeds `dropInterval`, the piece drops a row or `lockPiece()` fires.
- **Line clears** (`clearLines`): scans bottom-up, removes full rows, unshifts empty rows at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` indexed by lines-cleared-at-once, multiplied by `level`. Hard drop adds 2 pts/cell traveled; soft drop adds 1 pt/row.
- **Leveling/speed**: level increments every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects `current` straight down to its landing row, drawn at `globalAlpha = 0.2`.
- Game over triggers when a freshly-spawned piece (`spawn()`) immediately collides.

### Control flow

```
init() → createBoard(), pick next via randomPiece(), spawn(), start loop()
loop(ts) → accumulate dt → drop piece or lockPiece() at dropInterval → draw() → recurse via rAF
keydown → move / rotateCW via tryRotate() / softDrop() / hardDrop() / togglePause()
```

## Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (px per cell), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If you change `COLS`/`ROWS`/`BLOCK`, also update the `width`/`height` attributes of `<canvas id="board">` in `index.html` to match (`COLS*BLOCK` × `ROWS*BLOCK`).
