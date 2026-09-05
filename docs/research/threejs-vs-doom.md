# Three.js versus Doom WASM for P(DOOM)

Date: 2026-09-05. Decision recorded after this comparison: the user selected **Three.js with convincing Doom-inspired gameplay**, accepting approximate mechanics. No application dependency has been installed and implementation has not started. The [current MVP specification](../design/mvp-spec.md) supersedes this document's earlier open-choice framing. Scope remains one normal-length desktop level, four weapons, three risk creatures, and a required Sam finale.

**Three.js simplifies custom presentation and rules; Doom WASM supplies the game.** Three.js's own manual calls it a 3D library rather than a game engine. Choosing it means authoring the simulation around the renderer. It should not be presented as an automatically easier route to almost-identical Doom gameplay. [Official game-development manual](https://threejs.org/manual/en/game.html)

## Verified building blocks

| Three.js provides | What P(DOOM) must still supply |
| --- | --- |
| Mouse capture, camera rotation, lock/unlock events, and movement helpers through [PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html) | Keyboard state, movement feel, collision response, pause/focus handling, and any Doom-style horizontal aim/autoaim |
| Camera-facing [sprites](https://threejs.org/docs/pages/Sprite.html), image loading, and nearest-neighbor [texture filtering](https://threejs.org/manual/en/textures.html) | Coherent artwork, animation selection/timing, hitboxes, weapon overlays, HUD, palette and low-resolution presentation |
| [Octree](https://threejs.org/docs/pages/Octree.html) intersections and a [Capsule FPS example](https://github.com/mrdoob/three.js/blob/dev/examples/games_fps.html) | Reliable stairs, corners, doors, moving geometry, enemy navigation, projectiles and hitscan. The example demonstrates a static collision world and thrown balls, not a complete shooter |
| [Global audio](https://threejs.org/docs/pages/Audio.html) and [positional audio](https://threejs.org/docs/pages/PositionalAudio.html) using Web Audio | Sound assets, weapon/enemy sound timing, mixing, music, and browser activation/restart handling |

Neither these helpers nor the example provide four balanced weapon systems, damage rules, enemy AI, pickups, difficulty, secrets, boss gating, death, or victory. Those become our TypeScript game code. Exact BFG tracer behavior would be a recreation task; a satisfying room-clearing Shutdown Button could instead be an explicitly approved approximation.

## Project-specific consequences

**Doom WASM:** classic movement, combat, enemy behavior, doors, pickups, and map rules already exist. Our [candidate investigation](doom-wasm-options.md) identifies integration and content work: compose one WAD, supply missing asset families, select the appropriate game mode, and prove the boss exit. The candidate's [tagged loader](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/w_wad.c) loads one staged WAD. Testing concentrates on custom data and browser integration rather than rebuilding combat.

**Three.js:** ordinary images and authored level/state data can make changes to paperclip silhouettes, lab decorations, jokes, and the shutdown sequence more direct. That is an engineering inference from the APIs, not a measured productivity result. We also inherit more gameplay testing: collision at doorways/stairs, line-of-sight, damage, firing cadence, projectile obstruction, AI transitions, and progression. Familiar TypeScript does not remove those systems.

**Art scope persists in both.** Frontier-lab textures and paperclip creatures do not require switching engines. Generated concept boards are not finished animation sheets. Front-facing enemy art can reduce production work if accepted, but that aesthetic compromise is not uniquely available to Three.js.

**Browser lifecycle persists in both.** Current [WebGLRenderer requires WebGL 2](https://threejs.org/docs/pages/WebGLRenderer.html). Three.js requires explicit [resource disposal](https://threejs.org/manual/en/how-to-dispose-of-objects.html); restarts must also stop loops/audio and detach input. Neither route has a verified performance/browser matrix for this project yet.

## Recommendation and decision

For this authored parody, favor **Three.js only if recognizable Doom feel is sufficient**, with bespoke boss/progression logic and approximate weapon behavior. Favor **Doom WASM if original gameplay remains an acceptance criterion**. The A/B visual blend alone does not justify switching.

The user confirmed the second option: **prioritize a custom Three.js game that looks and feels like Doom while allowing approximate mechanics**. The next technical validation is one representative room, enemy, weapon, door, audio activation, and restart before expanding to the full level.
