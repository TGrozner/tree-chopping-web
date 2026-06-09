# Playtest checklist

## Target A: sbox-like dry loop

- Player spawns on a readable mountain summit hub.
- Four stations are visible around the hub: Tools, Wood Depot, Upgrades, Prestige.
- The starter area feels like a dense sapling field, not a 10-tree test arena.
- No water, river, dam, or barrage affordance appears.
- WASD movement feels immediate on desktop.
- Touch controls expose movement, swing, interact, and return-home actions.
- Space or left click starts a swing with visible windup/recovery.
- The target ring and HUD make the current standing or fallen tree readable.
- Saplings can be chopped with Hands.
- Normal or advanced trees block the player until the required axe tier.
- Final hits make trees fall as physical trunks, without spawning a separate log.
- Fallen trees roll across slope instead of sliding along their length.
- Split fallen trees produce wood items that magnetize into the backpack.
- The camera stays behind the beaver in a readable third-person chase view.
- Backpack count increases but stockpile stays unchanged until depot deposit.
- Wood Depot transfers backpack into stockpile.
- Tools station spends stockpile wood on the next axe tier.
- Reloading preserves banked progression, and Reset run starts fresh.
- R returns to the summit hub without resetting the world.

## Failure cases

- Chopping empty air does not crash.
- Repeated swing requests queue at most one follow-up swing.
- Fallen trees do not duplicate wood when hit repeatedly after splitting.
- Backpack capacity stops pickups instead of overflowing.
- Player cannot leave the dry forest radius.
- Station interaction outside a station does not mutate resources.
- Reloading the page gives the same deterministic layout.
- No browser console errors appear during the tested loop.

## Still intentionally approximate

- Tree physics are deterministic browser gameplay with rolling trunks, not full sbox/Jolt rigid bodies.
- Terrain is procedural mesh height, not Godot voxel digging.
- Visual assets are procedural Three.js primitives, not copied repo assets.
