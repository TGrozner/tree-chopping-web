# Test report

## Current status

The web prototype now targets `tree-chopping-sbox` target A: dry summit hub, dense starter forest, third-person beaver camera, rolling fallen trees, station economy, backpack/depot loop, and axe progression. Godot water, dams, barrages, and voxel digging remain intentionally out of scope.

## Commands run

```bash
npm run typecheck
npm run test
npm run build
npm run e2e
```

All passed locally on June 8, 2026.

## Automated coverage included

- Unit tests for deterministic world generation, station layout, and dense starter forest.
- Unit test for real swing timing into sapling fall, rolling fallen tree, split wood, and backpack pickup.
- Unit test for Stone-tier gating on harder trees.
- Unit test for Wood Depot deposit and Tools station axe upgrade.
- Unit test for R summit return without world reset.
- Playwright test for browser keyboard loop: swing, move to fallen tree, split, collect, move to depot, deposit, return hub.
- Playwright controls test for no crosshair, keyboard movement, hold-to-chop, touch dpad/chop, and mobile HUD/control separation.
- Playwright also fails on browser console errors during the tested loop.

## Known limitations

- No water, dams, barrages, or voxel digging by design.
- Tree physics are deterministic browser gameplay with rolling trunks rather than full rigid bodies.
- Three.js visuals are procedural primitives, not imported source assets.
- The economy is first-pass and tuned for proving the loop, not final pacing.
- Build currently warns that the Three.js bundle chunk is above 500 kB.
