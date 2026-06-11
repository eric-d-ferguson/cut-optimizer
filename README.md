# Cut Optimizer

A browser-based tool for figuring out how to cut lumber and sheet goods with the least waste. Enter the stock you have and the pieces you need, and it lays out where each cut goes on each board — accounting for blade kerf — and shows a diagram plus a measured cut list.

Built for the workshop: dimensions are entered and displayed in **feet or inches**, shown as **fractions** (to the nearest 1/16"), the way a tape measure reads.

## Why I built this

I wanted to make something light and useful that I'd actually use, a tool that solves a real problem I run into whenever I'm planning out cuts. I also had never worked with [Vite](https://vite.dev/) and wanted to give it a shot, so this was a good excuse to learn it on a small, focused project.

## Features

- **Stock + cut entry** — define the boards/sheets you have and the pieces you want
- **Per-item units** — enter each item in inches or feet (defaults to inches)
- **Fractional display** — measurements shown as mixed fractions (e.g. `47 1/2"`)
- **Kerf-aware** — accounts for blade width (default 1/8") so cuts actually fit
- **Visual layout** — a diagram of each board showing where every piece lands
- **Cut list** — per-board list of pieces with dimensions and marking positions
- **Waste reporting** — percentage of material wasted per board

## Tech

- [Vite](https://vite.dev/) + TypeScript — no framework, no runtime dependencies
- HTML Canvas for the layout diagrams
- Guillotine bin-packing algorithm for placement

## Getting Started

Requires [Node.js](https://nodejs.org/) (18+).

```bash
# install dependencies
npm install

# start the dev server (with hot reload)
npm run dev
```

Then open the URL printed in the terminal (typically `http://localhost:5173/cut-optimizer/`).

## Build

```bash
# type-check and build for production
npm run build

# preview the production build locally
npm run preview
```

The build outputs static files to `dist/`, deployable to any static host (GitHub Pages, Cloudflare Pages, etc.).

> **Note:** the app is configured to be served from the `/cut-optimizer/` path (see `base` in `vite.config.ts`). If you deploy it at a domain root instead, change `base` to `'/'`.

## Usage

1. Set your **blade kerf** (defaults to 0.125" — a standard circular saw blade).
2. Add your **stock**: label, width, length, unit, and quantity.
3. Add the **cuts** you need: label, width, length, unit, and quantity.
4. Click **Optimize Cuts**.
5. Review the diagrams and cut lists for each board.

## Project Structure

```
src/
├── types.ts      — shared interfaces (StockPiece, DesiredCut, CutPlan, …)
├── optimizer.ts  — bin-packing algorithm
├── renderer.ts   — Canvas diagram rendering
├── format.ts     — unit conversion + fraction formatting
├── main.ts       — UI logic and event handling
└── style.css     — styling
```

## License

MIT
