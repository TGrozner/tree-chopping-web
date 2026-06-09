# Tree Chopping Web

[![CI/CD](https://github.com/TGrozner/tree-chopping-web/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/TGrozner/tree-chopping-web/actions/workflows/ci-cd.yml)

Browser port target for the `tree-chopping-sbox` prototype.

Production: https://tgrozner.github.io/tree-chopping-web/

The current target is `A`: a dry, summit-hub, mow-the-lawn tree chopping loop. It intentionally excludes the Godot river, water, dams, and voxel terrain, but borrows useful Godot ideas such as the beaver identity, low-poly dense forest read, biome progression, and stronger tool silhouettes.

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

Production target: `https://tgrozner.github.io/tree-chopping-web/`.

## Controls

- `WASD` or arrow keys: move
- `Space` or left click: swing
- `E` or `Enter`: use station
- `F`: deposit backpack at the Wood Depot
- `R`: return to summit hub
- `Shift` + `Backspace` or Reset run button: clear saved progress and restart

## Current Scope

Included:

- dry mountain summit hub with four sbox stations: Tools, Wood Depot, Upgrades, Prestige
- dense starter sapling field plus biome-biased progression forest
- procedural low-poly beaver player and tool tier visuals
- real swing windup/recovery instead of instant chop
- sbox-style axe tiers from Hands to Chainsaw
- tree kind gates: Sapling, Normal, Veteran, Brittle, Mythic
- fallen trees remain the physical trunks, roll across slope instead of sliding, then split into wood items
- third-person chase camera behind the beaver, no crosshair
- backpack-to-stockpile deposit loop
- basic upgrades, prestige gate, combo pips, contextual HUD, debug snapshot
- browser e2e using real keyboard movement and swing requests
- local save/reload of progression, with explicit reset

Explicitly not included:

- water
- dams or barrages
- voxel terrain digging
- imported Godot assets
- multiplayer
- full engine-grade rigid-body simulation

## Verify

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run e2e
npm run e2e:visual
```

Or:

```bash
npm run verify
```
