# Doom WASM base investigation

Date: 2026-09-05. Status: source research and a limited live-demo check, not a dependency decision. No application dependency or engine was added. Full runtime testing belongs to the spike below.

**Superseded by the Three.js decision:** after reopening this choice, the user selected a Three.js/WebGL recreation with convincing Doom-inspired gameplay. This document is retained as feasibility research, not the implementation plan. No WASM dependency was adopted. See the [current MVP specification](../design/mvp-spec.md).

## Recommendation

Spike **theMagicalKarp/wasmdoom v0.0.2** first. It publishes small, ready-built engine and music WASM files and has an existing TypeScript browser host. The release is tied to commit `3edb40a`; use the matching tag's host and ABI, not a mixture of release binaries and moving `main` code. [Release](https://github.com/theMagicalKarp/wasmdoom/releases/tag/v0.0.2)

The meaningful tradeoff is asset packaging: this port stages **one complete WAD**. It does not implement a usable runtime `-file`/`-merge` path. We would compose the chosen original game data and parody replacements into one WAD during the asset build, then load that unchanged engine. The source comment suggesting additional named files are loaded is stale: the actual initializer calls only `W_AddMemFile()`. [Tagged WAD loader](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/w_wad.c)

If separate IWAD + PWAD loading becomes a hard requirement, use a Chocolate Doom browser fork and prove its audio/build first. Do not choose a port merely because its title screen boots.

## Comparison

| Candidate | Verified from primary source | Gap for this demo | Position |
| --- | --- | --- | --- |
| [theMagicalKarp/wasmdoom](https://github.com/theMagicalKarp/wasmdoom) | Direct port of id's original C engine; software framebuffer; single-player; browser host supports SFX and OPL music | Single staged WAD; minimal release history; browser lifecycle cleanup requires care | First spike |
| [cloudflare/doom-wasm](https://github.com/cloudflare/doom-wasm) | Chocolate Doom via Emscripten; JS mounts WAD/config files and calls `callMain`; local single-player works without its multiplayer backend | Example explicitly disables music; current source tree has no committed `.wasm`; old-style toolchain/build integration | Chocolate fallback, conditional on build/audio proof |
| [gabrielbotandev/doom-wasm](https://github.com/gabrielbotandev/doom-wasm) | Committed JS/WASM/data; vendored Chocolate source; runtime custom IWAD and add-on loading; modular browser startup | Build disables SDL2_mixer, removing the standard digital SFX module; stock shell prevents a second launch and supplies no teardown | Useful packaging reference, poor first choice for sound-heavy parody |
| [jacobenget/doom.wasm](https://github.com/jacobenget/doom.wasm) | Doomgeneric lineage; custom multiple-WAD data API; small `initGame`/`tickGame`/key interface | README explicitly states no music or sound effects; screen-melt blocks in browser; no mouse input in documented interface | Reject for this MVP |

Cloudflare evidence: [startup HTML](https://github.com/cloudflare/doom-wasm/blob/main/src/index.html), [build script](https://github.com/cloudflare/doom-wasm/blob/main/scripts/build.sh), [source tree API](https://api.github.com/repos/cloudflare/doom-wasm/git/trees/main?recursive=1). The inspected tree SHA was `65e0d3ae2ffa604155eebd96ed40da6567bd08f4`.

Gabriel evidence: [browser adapter](https://github.com/gabrielbotandev/doom-wasm/blob/master/web/src/main.js), [build flags](https://github.com/gabrielbotandev/doom-wasm/blob/master/engine/scripts/build_wasm.sh), [CMake compile definition](https://github.com/gabrielbotandev/doom-wasm/blob/master/engine/vendor/chocolate-doom/CMakeLists.txt), [conditional SFX modules](https://github.com/gabrielbotandev/doom-wasm/blob/master/engine/vendor/chocolate-doom/src/i_sound.c). This establishes a standard SFX limitation, not that every possible audio backend is absent.

Jacob evidence: [interface, lineage, and explicit TODO limitations](https://github.com/jacobenget/doom.wasm/blob/master/README.md).

## First candidate: what is actually available

- **Ready binaries:** v0.0.2 includes `wasmdoom.wasm` (311,507 bytes) and `wasmdoom.music.wasm` (15,040 bytes). These exclude game data. [Release metadata](https://api.github.com/repos/theMagicalKarp/wasmdoom/releases)
- **Desktop input:** existing host maps WASD to movement/strafe, mouse X to turning, left click to fire, E to use, and number keys to weapons. A canvas click starts audio and requests pointer lock. This is original Doom horizontal aiming, not modern vertical mouselook. [Tagged input adapter](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/web/src/input.ts)
- **External difficulty/map:** flags include `-skill 1..5` and `-warp <episode> <map>`; a mode flag distinguishes shareware/registered/retail/commercial. The web host accepts `?warp=1,1&skill=3`. [Flags](https://github.com/theMagicalKarp/wasmdoom/blob/main/docs/flags.md), [tagged URL parser](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/web/src/wad-route.ts)
- **Host state:** tagged event definitions include level loaded/completed, player died, enemy killed, and pickups. These can drive custom completion chrome and stable browser-test state without OCR of the canvas. [Tagged event protocol](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/wd_events.h)
- **Static Next.js integration:** inferred feasible from its fetch/instantiate API and browser host: serve WASM, WAD, and music worklet as same-origin static files and initialize from client code after a user gesture. This still needs an actual Next production test. [Runtime](https://github.com/theMagicalKarp/wasmdoom/blob/main/web/src/doom-runtime.ts), [audio adapter](https://github.com/theMagicalKarp/wasmdoom/blob/main/web/src/doom-audio.ts)
- **Restart:** there is no complete disposable session abstraction in the stock input adapter. Its global event listeners have no removal path. A fresh iframe document per session is a straightforward isolation option; a direct adapter needs explicit listener, timer, audio, and pointer-lock cleanup. This is an integration recommendation, not a claimed upstream feature. [Tagged input adapter](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/web/src/input.ts)

Live demo for browser inspection: [E1M1 on skill 3](https://themagicalkarp.github.io/wasmdoom/?warp=1,1&skill=3).

### Limited browser observation

The live URL loaded into E1M1 and rendered the original world, pistol, and status bar in the Codex in-app browser. The documented Q key opened the native Doom menu, and Q again resumed the game. This verifies rendering and that menu input path only. The scripted fire attempts did not establish a shot/ammo change; do not treat shooting, mouse capture, or audio as browser-verified yet. The spike must exercise sustained real input and check those independently. No Safari/Firefox matrix, custom content, full game data, or application lifecycle has been tested.

## Content constraints are separate from the engine

The inspected bundled `doom1.wad` is 4,196,020 bytes, 1,264 lumps, SHA-256 `1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771`. Direct directory parsing found pistol, shotgun, chaingun, rocket-launcher, and Baron sprite families. Plasma (`PLSG`), BFG (`BFGG`/`BFGF`), cells (`CEL`), Cyberdemon (`CYBR`), Spider Mastermind (`SPID`), and Cacodemon (`HEAD`) families are absent. It also contains 46 `STF*` HUD-face lumps and 59 `BOSS*` Baron lumps. [Inspected original data file](https://github.com/theMagicalKarp/wasmdoom/blob/main/wads/doom1.wad)

Consequences:

- Four original gun behaviors are possible with shareware data: pistol, shotgun, chaingun, rocket launcher. Their placement can be concentrated near the start of the modified level.
- A real BFG requires complete supporting game data and the appropriate non-shareware mode. The engine contains BFG/plasma mechanics, but existing selection logic explicitly checks shareware mode. Merely renaming a rocket launcher to BFG does not reproduce BFG behavior. [Weapon logic](https://github.com/theMagicalKarp/wasmdoom/blob/main/src/p_pspr.c)
- A reskinned Baron can be the boss using shareware content. A Cyberdemon-based boss needs its missing asset family supplied.
- On Chocolate Doom, `-file` is also blocked for shareware mode. Its sprite/flat replacement convention uses `-merge` rather than assuming plain `-file` always works for a total conversion. [Cloudflare's inherited startup checks](https://github.com/cloudflare/doom-wasm/blob/main/src/doom/d_main.c), [Chocolate mod flags](https://www.chocolate-doom.org/wiki/index.php/Command_line_arguments)

**Boss death does not automatically open an exit on E1M1.** Vanilla `A_BossDeath` checks particular map slots and monster types; for episode 1 it requires map 8 and Barons. A content-only solution is to put the E1M1-derived geometry in the **E1M8 slot**, then have the final Baron death lower sector tag 666 to expose an exit switch. The UI can still call it the demo's first level. Another option is a regular exit switch with a boss encounter, or a host completion screen responding to the unique boss's engine death event. Pick one deliberately. [Actual boss-death logic](https://github.com/theMagicalKarp/wasmdoom/blob/main/src/p_enemy.c)

Keep original weapon physics, AI, collision, damage, and map simulation inside the WASM engine. Presentation changes belong in WAD art/sounds/map data and the surrounding web menu. License and attribution inventory can live in repository notices as requested.

## Follow-up: authored missing assets preserve the requested mechanics

The user approved **System Prompt / pistol**, **RLHF / shotgun**, **Mechanistic Interpretability / plasma rifle**, and **Big Fucking Shutdown Button / BFG**, and explicitly allowed recreating missing art. Tagged `v0.0.2` source supports that combination without changing engine mechanics. The earlier reference to “complete supporting game data” does **not** require the full original registered WAD: a composed shareware-derived WAD can supply the resources actually needed by the selected mode, level, weapons, and boss. This remains source-verified feasibility; that composed WAD has not been built or run.

### Mode and startup checks

`IdentifyVersion()` accepts `-mode shareware`, `registered`, `retail`, or `commercial`; mode is declared by argv, not inferred from the staged filename or WAD contents. The host writes NUL-separated arguments to `wasmdoom_argv_ptr()`, stages one WAD with `wasmdoom_wad_alloc()`, and calls the zero-argument `wasmdoom_init()`. Comments mentioning a mode argument on `wasmdoom_init` are stale. [Tagged startup](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/d_main.c), [tagged exports](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/wasmdoom.c)

The inherited registered-data validation checks episode 2/3 map markers and several registered-only lumps, but it runs only inside `if (modifiedgame)`. This tag sets `modifiedgame = false`, has removed the `-file` argument path, and its single memory-WAD loader does not set the flag. Consequently those old validation checks are not an unconditional demand for all registered episodes or monster families on this path. The loader accepts an `IWAD` or `PWAD` header, but the staged file must contain all resources needed for the session because no second file is loaded. [Tagged checks](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/d_main.c), [tagged loader](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/w_wad.c)

There is a separate, real startup dependency: **registered mode unconditionally resolves 20 extra switch texture names**, even when the level never uses them. All are missing from the tagged bundled shareware WAD. They need valid `TEXTURE1`/`TEXTURE2` definitions, which can reuse existing switch patches: the `SW1`/`SW2` pairs for `BLUE`, `CMT`, `GARG`, `GSTON`, `HOT`, `LION`, `SATYR`, `SKIN`, `VINE`, and `WOOD`. `R_TextureNumForName()` errors on a missing definition. Merely adding weapon sprites is therefore insufficient. `retail` happens to avoid this particular switch-list expansion in the inherited code, but introduces other episode/menu assumptions; prefer an explicit, complete `registered` package over relying on that quirk. [Tagged switch initialization](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/p_switch.c), [texture lookup](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/r_data.c)

### Minimum supplemental resources for this concept

The following missing resources were checked against the public [tagged shareware WAD](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/wads/doom1.wad). They are a source-derived dependency inventory, not a runtime-validated build manifest.

| Feature | Resources to author or supply from existing permitted data |
| --- | --- |
| Plasma mechanics | `PLSG` A–B, `PLSF` A–B, `PLSS` A–B, `PLSE` A–E, world pickup `PLASA0`, sound `DSPLASMA` |
| BFG mechanics | `BFGG` A–B, `BFGF` A–B, `BFS1` A–B, `BFE1` A–F, `BFE2` A–D, world pickup `BFUGA0`, sound `DSBFG` |
| Shared cell ammunition | `CELLA0`; `CELPA0` if the larger cell pickup is placed |
| Cyberdemon-based Sam | `CYBR` A–P; sounds `DSCYBSIT`, `DSCYBDTH`, `DSHOOF`, `DSMETAL` |
| Registered startup | The 20 switch texture definitions listed above |
| E2M8 native boss-exit option | Complete modified map lump block under `E2M8`, `SKY2` texture definition, `D_E2M8` music; provide `SFLR6_1` flat and `VICTORY2` patch as safe native-finale resources |

Existing shareware data already provides the shared rocket/explosion/pain/activity sounds used by these actors, and `D_VICTOR` finale music. Alias or repaint appropriate existing resources where bespoke art is not yet needed. No Cacodemon, Spider Mastermind, or other unused registered-only actor family is required by the inspected initialization path. State/frame requirements come from the [tagged state table](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/info.c); sounds are looked up by `DS` plus the engine sound name and missing used sounds are fatal. [Tagged sound adapter](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/i_sound.c)

Compose a coherent sprite namespace between `S_START` and `S_END`, replacing old frames rather than appending overlapping rotation definitions. Rotation `0` is supported for a frame visible from every angle, allowing simple spike art such as `CYBRA0` through `CYBRP0`. If directional art is used, the renderer requires all eight rotations, with paired mirrored frames supported. Every frame through the highest supplied frame must exist. Artwork still needs valid Doom patch encoding, palette indices, dimensions, and offsets. [Tagged sprite validation](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/r_things.c), [sprite resource initialization](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/r_data.c)

Plasma and BFG selection explicitly rejects only `shareware` mode; their simulation is already implemented. The BFG consumes 40 cells and retains its projectile plus tracer-spray attack. Replacing its pictures with a shutdown-button device does not require replacing its behavior. [Tagged weapon selection](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/p_user.c), [tagged weapon simulation](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/p_pspr.c)

### Required Sam finale without engine changes

If this WASM route is selected, **Sam as a reskinned Cyberdemon in the E2M8 slot** is a suitable native-mechanics option. Start with `-mode registered -warp 2 8 -skill N`, placing the E1M1-derived geometry in that internal slot. The Cyberdemon preserves its 4,000 health, rocket salvos, movement, and damage behavior; its projectile and explosion resources already exist in shareware. Its final death state calls `A_BossDeath`, which exits E2M8 after the last Cyberdemon dies while a player remains alive. A Baron alternative has 1,000 health, melee/fireball attacks, and can lower sector tag 666 in E1M8 to reveal an exit switch. Choose based on the encounter, not missing original sprite art. [Tagged actor definitions](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/info.c), [tagged attacks and boss-death rules](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/p_enemy.c)

For either map-8 option, the host should use **`EV_LEVEL_EXIT_TRIGGERED` (103)** for the custom completion transition: `G_ExitLevel()` emits it, whereas `G_DoCompleted()` returns early into victory on map 8 before reaching `emit_level_completed()`. Keep safe native-finale resources in the package and prove event/tick timing in the spike rather than assuming the host always interrupts before the engine accesses them. Restrict the custom menu/session to the intended map so native episode selection cannot launch missing content. [Tagged completion flow](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/g_game.c), [tagged event protocol](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/wd_events.h), [tagged finale resource use](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/src/f_finale.c)

**Remaining proof:** the asset assembler, actual release-binary launch, all weapon/actor animations and sounds, pickup/switch interactions, boss completion timing, and browser lifecycle still need the proposed spike. No gameplay compromise is established by the absence of original full-game art, and no engine fork is implied by this follow-up.

## Go/no-go spike before committing to the base

These are proposed acceptance criteria, not completed checks:

1. Pin the release binary and matching source/host, record checksums, and boot it from this app's production build with same-origin assets and no third-party runtime game service.
2. Launch the same modified level from two custom menu difficulty choices and read back distinct engine skill state. Keep the native Doom simulation and map collision.
3. Replace one actual enemy sprite frame, one HUD face frame, one weapon frame, and one sound in the packaged WAD. Show the replacements in gameplay and confirm original surrounding animations still load. Merely overlaying HTML does not pass this check.
4. Put four usable original weapon behaviors and ammunition on the level route, with early weapons establishing the parody in the first minute and any later unlocks following the approved pacing. If BFG is part of the selected concept, demonstrate its real projectile/tracer behavior using complete assets and non-shareware mode.
5. Play through movement, strafing, mouse turn, shooting, door interaction, pickup, damage, and death. Verify SFX and music after the start gesture.
6. Escape pointer lock, return to menu, restart twice with different difficulty, and navigate away/back. There must be one active session, no stuck input, and no continuing audio after exit.
7. Finish the proposed boss encounter and completion transition. Prove the selected exit mechanism in the actual map slot and prohibit accidental continuation into a second level.
8. Exercise the critical journey in current desktop Chrome, Firefox, and Safari if all three are targeted. Record the actual browser/version matrix and stable game-state hooks; do not substitute a README compatibility claim.

Go if all selected product requirements pass with the published port and a bounded asset/host adapter. No-go if the work expands into implementing missing engine audio, a new renderer, or a new Doom simulation. Separate-PWAD loading is an explicit candidate tradeoff, not an invisible promise.
