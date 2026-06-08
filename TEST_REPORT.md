# Test report

## Current status

Initial browser vertical slice scaffold created from ChatGPT via GitHub connector.

I could create and inspect repository files, but I could not run `npm install` or browser tests from this chat environment. The repository includes automated checks so the first local or GitHub Actions run can validate the implementation properly.

## Commands to run locally

```bash
npm install
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run e2e
```

Or all checks:

```bash
npm run verify
```

## Automated coverage included

- Unit tests for tree chopping into log.
- Unit test for deterministic cascade reaction.
- Unit test for log splitting, wood pickup, and axe upgrade.
- Playwright test for the browser core loop through `window.__TREE_CHOPPING_TEST__`.
- Playwright also fails on browser console errors during the tested loop.

## Known limitations

- No water by design.
- No voxel terrain.
- No real rigid body physics yet.
- Tree falls are deterministic semi-physics, not Rapier/Jolt simulation.
- Visuals use procedural primitives only.
- The first CI run is the source of truth because checks were not executed inside ChatGPT.

## Manual verification target

The minimum acceptable v0 is not just a compiling app. It must feel readable and responsive when playing the default loop:

1. Move near the first tree.
2. Chop until it falls.
3. Watch it knock the second tree.
4. Chop at least two fallen logs.
5. Collect 6 wood.
6. Confirm axe level reaches 2.
