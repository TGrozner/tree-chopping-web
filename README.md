# Tree Chopping Web

Browser vertical slice remake of `Tree Chopping Cascade`.

This is not a Godot port. It is a dry, scoped web remake focused on proving the core loop:

> move → chop tree → tree falls → cascade hit → log → chunks → collect wood → axe upgrade

## Stack

- Vite
- React
- TypeScript
- Three.js
- Vitest
- Playwright

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL, usually `http://localhost:5173`.

## Controls

- `WASD` or arrow keys: move
- `Space` or left click: chop

## Verify

```bash
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run e2e
```

Or:

```bash
npm run verify
```

## Scope

Included in v0:

- 3/4 top-down dry arena
- procedural low-poly beaver placeholder
- 10 deterministic trees
- target detection
- multi-hit chopping
- deterministic falling trees
- cascade knockdown
- fallen logs
- log splitting
- auto pickup chunks
- wood counter
- axe level 2 upgrade
- debug HUD
- `window.__TREE_CHOPPING_TEST__` for e2e tests

Not included in v0:

- water
- voxel terrain
- real dam simulation
- imported assets
- multiplayer
- full physics engine

## Why no water yet?

The s&box prototype did not rely on water, and the Godot water/voxel stack is too expensive for a first browser slice. This repo intentionally starts with the tree-feel loop only.
