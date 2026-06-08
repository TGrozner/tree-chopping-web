# Playtest checklist

## Core loop

- Player spawns in a readable dry forest arena.
- WASD movement feels immediate.
- It is obvious which tree is targeted from the HUD and tree scale highlight.
- Space or left click chops the current tree.
- Tree hit feedback is visible.
- Final hit triggers stronger fall feedback.
- Tree fall direction matches player-to-tree hit direction.
- Falling tree can knock over the next tree in the default layout.
- Fallen trees become logs.
- Logs can be chopped into chunks.
- Chunks auto-collect when the player is close.
- Wood count increases.
- Axe upgrades to level 2 at 6 wood.

## Failure cases

- Chopping empty air does not crash.
- Fast repeated chopping does not duplicate chunks from the same log.
- Cascades do not trigger infinite loops.
- Player cannot leave the arena bounds.
- No console errors appear during the core loop.
- Reloading the page gives the same deterministic layout.

## Explicitly out of scope for v0

- No water.
- No voxel terrain.
- No real river/dam simulation.
- No multiplayer.
- No imported art assets.
