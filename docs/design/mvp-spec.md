# P(DOOM) — desktop playable demo

Status: approved and implemented as the first playable desktop demo, with the user's later Doom 64/Staging Area direction incorporated into the environment, level structure, movement, lighting, and sound. This brief records the selected direction; [verification notes](../verification.md) record the checks and tested behavior.

## Product promise

A funny, tactile, Doom 64-inspired first-person shooter about an Eliezer-inspired safety researcher in a breached frontier AI lab. The audience is AI engineers, researchers, safety practitioners, and tech early adopters. The satire is affectionate and directed at labs, doomers, accelerationists, and rationalist culture alike.

One normal-length level rewards continued exploration. A visitor should understand roughly 80% of the core concept and jokes in their first minute; that is an editorial goal, not a literal completion counter or a one-minute time limit.

## Selected technology and fidelity

Build with **Three.js/WebGL and TypeScript in the existing Next.js app**. This explicitly supersedes the initial requirement to run the original Doom engine in WASM. The user accepts convincing Doom-inspired gameplay instead of mechanically exact Doom simulation. The subsequent request to draw more closely on **Doom 64's Staging Area** determines the current level composition, materials, lighting, and sound mood.

Keep a low-resolution presentation, angular spaces, billboard enemies, a first-person weapon, the researcher status bar, and readable classic-shooter feedback. Movement uses acceleration and inertia, gravity, step traversal, drops, and landing feedback. Aiming stays horizontal, with vertical assistance for targets at different elevations. Implement movement, collision, combat, enemy behaviors, doors, pickups, and difficulty tuning in application code. The delivered level and simulation are an **authored approximation**, not exact Doom 64 map data, physics, random tables, weapon math, or AI. Do not build a general-purpose game engine.

The [engine comparison](../research/threejs-vs-doom.md) records the tradeoff: easier custom content and explicit game-state control, with more gameplay implementation and testing. The [WASM investigation](../research/doom-wasm-options.md) remains research history rather than the implementation plan.

The [Doom 64/Staging Area research](../research/doom64-staging-area.md) records inspected game artifacts and primary developer/composer sources, concrete visual observations, generated texture prompts, and the limits of the reference evidence.

## Visual direction

The initial blend of [A: classic Doom](concepts/a-1993-total-conversion.png) and [B: frontier lab](concepts/b-frontier-lab.png) establishes the parody vocabulary. The current environment follows **Doom 64's darker, grainier industrial presentation**: broad battered brown-gray panels, rust utility trim, deep ceiling shadows, restrained sector colors, and glimpses of a dark violet sky. Server racks, lab equipment, signs, and AI-research details remain integrated into that setting. B's paperclip enemy remains a preferred creature reference.

Use a raised arrival lip, an enclosed lower chamber with roof apertures, changing floor heights, stairs, connected galleries, and an open-sky court to make the architecture recognizable. Lighting should preserve readable routes and silhouettes while keeping the ceiling and distant recesses dark. Original low drones, filtered air, and sparse metallic events support an original dark industrial score; mechanical clunks mark menu navigation.

[C: cursed meme WAD](concepts/c-cursed-meme-wad.png) contributes occasional discoveries, not the dominant setting. Keep the jokes legible without covering every surface in text. Menus should look like part of the game.

The user's subsequent title-screen revision replaces the initial HTML-style landing composition and CSS wordmark. The current menu uses a new generated stone P(DOOM) logo, a centered 4:3 safe region, dark cloud/ember atmosphere, red beveled bitmap labels, and a skull cursor. Arrow keys and Enter navigate menus; Escape returns. Options contains sound, fullscreen, and controls. Small X and GitHub marks on the title and credits open the creator's profile and project repository in new tabs, with the same focus treatment and mechanical cues as other menu actions. The latest revision removes the start briefing and introduces the premise through the title tagline and opening gameplay notice. See [menu references](title-menu-reference.md) and [logo/cursor provenance](title-art.md).

The HUD face is an expressive pixel-art Eliezer-inspired portrait that becomes increasingly worried as health falls. It is an intentional parody element, not a claim to duplicate Doom 64's interface. Generated boards are references, not final animation sheets or evidence of implemented features. Production likenesses and animation remain approximate; missing classic assets may be recreated without absolute authenticity.

The training refresh extends the title-screen style to the HUD, pause, and results screens. Pickups get a large title and punchline; enemy defeats get independent “Vanquished” messages naming the risk. Weapon discoveries take priority, and rapid pickups retain a bounded queue so jokes have reading time. The largest weapon is announced in full as **Big Fuckin’ Shutdown Button**. The new paperclip maximizer uses one unmistakable giant paperclip silhouette with smaller clip appendages; Sam's enlarged face and the researcher's fuller-haired, bearded portrait improve identity at gameplay scale.

## Story and player journey

Title tagline and opening message:

> They built a god. You brought a shotgun.

The containment breach occurs before the next training run; there is no countdown mechanic. Bayesian/rationalist references belong in environmental details, pickup messages, and small UI moments. They do not introduce a math puzzle or probability-management system.

Flow: title/startup → main menu → choose p(doom) → loading → level → defeat Sam → activate shutdown switch → victory → replay. Starting the chosen run enters gameplay immediately after assets load, without a briefing or second entry gesture. The runtime and assets preload while difficulty is open. If the tab loses focus during loading, the completed run stays safely paused.

Player-facing actions use **Start Training Run**, **Resume Training**, and **Training Paused**. Difficulty hover and arrow keys preview an option with a warm highlight and mechanical cue. The skull marks only the confirmed difficulty, remaining visible while hovering other choices or Start. Click, Enter, or Space selects a difficulty without launching; a separate activation of Start launches the confirmed choice. Escape toggles pause/resume, ignores key repeats, and closes an open Controls dialog before resuming gameplay on a subsequent press. The explicit level objective is to find the big red lab shutdown button and stop AI training. Sam guards the required finale; defeating him unlocks the switch but does not itself stop the training run. The portable weapon and final fixed switch have distinct roles.

Credits roll from bottom to top at 75 pixels per second in the same console/HUD lettering, with pause, replay, and return controls. Space toggles playback; wheel, scrollbar, and scrolling keys pause it, and resuming continues from the current position. Hover and reading-area focus do not stop playback. Travis Fischer's name and its padding link to his X profile in a new tab. GPT-6 ASTRA appears first under Built With, followed by Codex and Three.js / Next.js. Reduced-motion settings use a static scrollable layout. Credits omit “Made to be modded,” and use “No training run lasts forever.” Short fragments and labels in the menu, HUD, and credits omit trailing periods; complete sentences and multi-sentence jokes retain punctuation. Controls contains only a large three-column key/action guide and Return, without extra explanatory paragraphs. Title, options, and difficulty menu stacks are vertically centered between their header and footer regions.

The arrival chamber includes a worn wall sign with **PHASEONE[big]** as the large headline and **was here** below it; the bracketed suffix is a literal part of the name. The internal-eval sign reads **IT'S ONLY AN INTERNAL EVAL / WHAT COULD GO WRONG**. Barrels carry **POISONED TRAINING DATA / DO NOT USE**, and the first ammunition pickup message reads **MORE POSTTRAINING RL. SURELY THIS WILL HELP**.

Victory payoff:

> Deployment shut down. For now...

Death freezes gameplay and brings ten broad overlapping sheets of blood down over the scene while the complete death scream plays. Blunt ragged edges, dark maroon clots, and static coarse grain give the blood weight; only the sheet transforms and final darkening opacity animate. The screen reaches dark red coverage before Retry and Return appear at 1.4 seconds. Repeated Space/Enter events from a key held through the fatal hit cannot activate Retry. Reduced motion skips the falling wipe and reveals the covered results immediately; retry and return discard the transition so a later death starts fresh. Sam is a required finale deeper in the level, not an opening encounter or optional secret boss.

## Arsenal

| Weapon | Reference | Required gameplay identity | Proposed placement |
| --- | --- | --- | --- |
| System Prompt | Pistol | Simple, weak, deliberate hitscan fire | Equipped at spawn |
| RLHF | Shotgun | Short burst of spread damage with a satisfying firing cadence | Obvious first-fight pickup |
| Mechanistic Interpretability | Plasma rifle | Rapid visible energy projectiles, distinguishable from hitscan | Early main route |
| Big Fuckin’ Shutdown Button | BFG | Costly, emphatic charged shot with a powerful group-clearing payoff | Deeper route before Sam |

Exact Doom weapon math is not required. All four must be usable and useful in the level, with distinct timing, effects, and ammunition costs. The Shutdown Button needs a satisfying payoff rather than merely a larger label on a standard shot.

System Prompt uses a short recorded report with a sharp attack and sustained body, adapted from a CC0 gunshot impulse. It remains the starting pistol with unchanged damage and 280 ms cadence. Shutdown's launch has a held blast, low impact, and delayed electrical aftershocks; charge timing, ammunition cost, damage, and projectile behavior stay unchanged. The approved RLHF recording and player pain/death voices retain their existing playback. All nine recorded assets preload independently with a bounded timeout and per-file fallback. See [audio design and measured mix headroom](audio-refresh.md).

Weapon placement is an implementation proposal consistent with the approved pacing: show the first three identities early and reserve the largest weapon for continued play. Number keys select weapons; firing, switching, recoil/bob, impact feedback, and sound should feel responsive.

## Pickups and difficulty

- **Touch Grass:** restores health. Use a recognizable small patch of grass; coffee is not a required pickup.
- **Guardrails:** armor/protection with clear safety-themed equipment art.
- **Training Data:** ammunition pickups represented by readable dataset/storage packs. Keep weapon ammunition pools distinct and make compatibility clear in the HUD/pickup feedback.

Successful pickups emit distinct audio by item category: torn grass and a pressure-release breath for health, a metal plate/latch for guardrails, rough tape/head transfer packets for ammunition, and heavy mechanical latches for weapons. Ammunition pools have pitch variations; the Shutdown Button has a deeper, longer discovery cue. Full resources and rejected pickups do not produce a cue, and collected items produce only one event. Pickup sounds honor the existing mute, pause, and bounded audio-voice lifecycle.

Offer **1%, 10%, 50%, 90%, and 99% p(doom)**, with **10% selected by default**. The 90% label is **There’s still a chance**, and 99% is **I told you so**. Higher means harder. The percentages are parody labels, not computed chances of death. Tune authored settings along the classic difficulty curve; the hardest mode includes faster enemies and respawning. Difficulty must change the actual simulation, not only the menu label.

## Enemy roster

The base enemy roster is shared by 1% and 10%. Higher difficulties add cumulative, authored reinforcements: **2 at 50%, 8 at 90%, and 36 at 99%**, for current totals of 21, 21, 23, 29, and 57. Nightmare adds twelve creatures around staging, feedback, and early access, with the rest spread through the lab and boss approach. It retains faster movement/attacks and respawning to make the swarm overwhelming. All tiers keep one Sam. Additional spawns have unique identities, clear floor/headroom, and separation from the arrival platform, doors, pickups, barrels, and other actors. Restart recreates the selected roster, and HUD kill totals use its actual size.

The three risk concepts and Sam are confirmed. The following behavior and silhouette assignments are implementation proposals using familiar Doom archetypes:

| Enemy | Visual identity | Behavior |
| --- | --- | --- |
| Deceptive alignment | Cheerful safety mask concealing a hostile second face | Walks, throws projectiles, attacks nearby; attack frames expose the deception |
| Sycophancy | Broad grinning yes-man with an exaggerated agreeable gesture | Pursues the player aggressively for close-range attacks |
| Paperclip maximizer | A giant familiar office paperclip with menacing eyes and smaller paperclip limbs | Floating ranged threat with a distinct silhouette and close-range attack |
| Sam | Recognizable caricature inside oversized launch-platform armor | Boss projectile/rocket volleys in an arena with space to dodge |

The creatures need visible movement, attack, hit, and death feedback. Billboard art and animation scope should serve clear gameplay; eight authentic Doom viewing angles are not a prerequisite for the Three.js demo. Enemies must respect walls, doors, and line of sight. Do not add adaptive persuasion, simulated deception, or live AI inference.

The fidelity pass supplies six poses per creature: idle, two walking poses, attack windup, attack release, and defeat. The floating paperclip uses a stable eye anchor; grounded creatures retain their foot baseline. Sam's defeated pose is a powered-down launch mech. [Art provenance and measured animation frames](polish-art.md).

Each enemy family has distinct awareness and attack audio: corrupted whispers/growls for deceptive alignment, strangled approving rasps for sycophancy, scraped wire/metal clatter for paperclips, and server motors/relays for Sam. Death uses original Doom recordings: imp, zombie, demon, and Baron respectively, with the preceding synthesized death profiles retained only as missing-file fallbacks. Awareness sounds once on first sight or a surviving hit, and resets on Nightmare resurrection. Attack cues coincide with release, including a missed sycophant swipe; canceled volleys and attacks interrupted by pain or death remain silent. Death cues emit once and a lethal surprise hit skips the awareness cue. All layers retain positional panning, distance attenuation, pause/mute behavior, and bounded voice cleanup.

Regular lab doors toggle open/closed with E, with a pressure-release hiss and latch on opening, vacuum hiss and motor on closing, and a separate sealing clunk at the actual closed position. Doors remain open until explicitly closed, refuse to close onto a player or living enemy, and reverse if obstructed during closing. Secret panels remain open permanently after discovery. All door audio retains positional mixing and pause/mute behavior.

Volatile Poisoned Training Data barrels add an environmental combat choice. They block movement while intact, accept player and enemy fire, chain into nearby barrels, and leave nonblocking wreckage. Their blast damage respects walls and changes in floor height. Wall impact marks, sparks, blast illumination, distinct muzzle flashes, and short positional sound cues make combat consequences readable.

Player damage uses two alternating recorded human grunts with a cooldown that prevents overlapping pain voices. Fatal damage emits one distinct recorded yell, removes undrained pain cues, stops an active grunt, and prevents later attacks from obscuring the death cue. The audio context stays running through the complete scream and its short reflections before suspension. Pickups, enemy awareness/attacks, plasma/shutdown weapons, and world effects use rough filtered/saturated material sounds with restrained pitch movement. System Prompt and RLHF use recorded reports; missing files retain synthesized fallbacks. The approved RLHF shotgun and player vocal playback remain unchanged. See [audio design](audio-refresh.md) and [recording provenance](../../public/game/audio/README.md).

## Level and discovery pacing

Create one authored level drawing on **Doom 64's Staging Area**, replacing the earlier E1M1 opening reference. The delivered layout has a broad raised arrival platform overlooking a lower enclosed chamber, stairs and a drop, roof apertures, bent connections through computer rooms and service areas, galleries, and an open-sky containment court. Continued exploration reaches the training/oversight areas and the required Sam encounter. This is a new layout using selected compositions and relationships; exact original geometry and a map importer are not requirements. See the [reference findings](../research/doom64-staging-area.md) for source evidence and interpretation boundaries.

Proposed opening sequence:

1. The raised arrival view into the lower staging chamber, worried portrait, System Prompt, and a restrained lab sign establish the setting and concept immediately.
2. The first deceptive-alignment encounter leads naturally to RLHF and ammunition.
3. Sycophancy introduces a contrasting rushing threat.
4. Mechanistic Interpretability precedes an obvious paperclip encounter; health, armor, and training data appear along this early route.
5. Continued exploration leads to the Shutdown Button, deeper jokes, the Sam arena, and the shutdown finale.

Place early content so an ordinary first-time player can encounter most of the premise in roughly a minute. Do not promise every player a specific traversal time. Preserve a normal-length level with optional routes and secrets.

Proposed optional discoveries use ordinary level geometry, art, and pickups:

- A HELD-OUT TEST SET secret conceals ANSWER KEY imagery and useful training data.
- A brief SAFETY REVIEW detour rewards the player with guardrails and a shortcut: the alignment tax.
- A Bayesian/rationalist shrine or wall detail rewards closer inspection without requiring a puzzle.

Sam's defeat actually unlocks the shutdown interaction. No exit or victory path may bypass that requirement. The ending stops combat and prevents continuation into another level.

## Desktop scope

Target current desktop **Chrome and Edge** first. Record the actual tested versions and reference machine during development. Firefox, Safari, and mobile are later work.

Provide WASD movement, horizontal mouse aiming with height-aware autoaim, click to fire, number-key weapon selection, an interact key, and brief visible instructions. Include pause/resume, mute, restart, and fullscreen. Combine recorded weapon, player, and enemy sounds with original synthesized effects over a dark ambient drone soundscape informed by the selected Doom 64 mood; audio starts after a user gesture. Escaping pointer lock or losing focus must leave the player in a predictable paused state.

A practical initial layout baseline is a desktop viewport of 1024 × 720 or larger. This is an implementation baseline, not mobile support. Show a useful unsupported-browser/WebGL message rather than an empty canvas.

## Acceptance criteria

1. From a direct page load, the player can reach the title/menu, select p(doom), load the game, and control the character. The chosen setting affects gameplay.
2. Movement with inertia, horizontal aiming with vertical assistance, collision, stairs/thresholds, gravity, drops, doors, and interaction work along the full route without clipping through walls, getting stuck, or allowing enemies/projectiles to ignore obstructions. The raised arrival, lower chamber, and later elevations remain readable and traversable.
3. All four weapons are available and have distinct functional behavior, feedback, and ammunition consumption. Pickups restore the intended resource without exceeding its limit or applying more than once.
4. The first-minute route communicates the portrait, lab setting, weapon premise, three risk concepts, and themed resources. Validate this by playthrough/review, not literal prose assertions or an invented 80% score.
5. All three risk types can pursue/attack, take damage, and die. Sam has a readable boss encounter; defeating him enables shutdown, which leads to the victory state.
6. The HUD reflects health, armor, active weapon, and appropriate ammunition. The portrait visibly responds to health. Weapon and resource feedback remains understandable while moving and fighting.
7. Pause/resume, focus loss, pointer-lock exit, mute, fullscreen, death, and replay work. Repeated restarts do not duplicate loops/input/audio or leave stale game state.
8. The complete level is playable in the recorded Chrome/Edge baseline. Asset-loading errors have an understandable recovery path; production assets load successfully from the built app.
9. Movement and firing remain responsive through a representative busy encounter. Target smooth 60 fps presentation on the recorded development desktop; measure actual frame timing and tune resolution/effects rather than claiming universal hardware performance.
10. Format, lint, type checks, production build, relevant gameplay unit tests, and critical browser journeys pass. Tests use game state, landmarks, and stable hooks rather than fixed editorial copy, synchronized content counts, or rendered prose.

## Build order and validation

1. **Gameplay proof:** one representative room with a player, enemy, weapon, door, pickup, audio activation, pause, and restart. Prove collision and responsive controls before expanding the map.
2. **Combat and state:** complete the four weapons, three risk behaviors, resources, difficulty, damage/death, and boss/shutdown gate. Keep settings/state explicit and test complex combat, collision, and validation logic.
3. **One complete level:** Staging Area-inspired arrival and lower chamber, connected rooms and service routes, stairs/drops, sky court, later arena, weapon/resource placement, secrets, finale, and replay. Tune first-minute discovery and later progression through playtests.
4. **Presentation:** finish title/menu, sprite and HUD art, muted Doom 64-inspired materials and sector colors, animation, original dark ambient sound, portrait states, and the Bayesian/environmental jokes. Iterate on presentation throughout the earlier stages as well.
5. **Release verification:** browser journeys through direct load, start/difficulty, combat/pickups/door, pause/resume, death/replay, boss/shutdown/victory, and recoverable loading failure. Verify the production build and browser lifecycle.

Use Three.js for rendering and one owned runtime for simulation/input/audio lifecycle. Keep React responsible for the menu and readable UI state; avoid driving the entire render loop through React state. Level and entity definitions should be explicit data. These are implementation choices, not extra product features.

## Out of scope for this milestone

- Original Doom WASM integration, exact Doom 64 map/physics reconstruction, engine compatibility, and a general WAD importer/editor.
- Mobile/touch, multiplayer, accounts, saved progression, leaderboards, and a campaign.
- Runtime LLM calls, procedural levels, adaptive persuasion, and Bayesian math gameplay.
- Long cutscenes, voice acting, research explanations, or a codex.
- Any Bloom mode or Bloom Easter egg. Revisit after the main demo meets its acceptance criteria.
- General-purpose engine development, a large asset-editing toolchain, and exact replica fidelity.

Repository conventions remain pnpm, modern TypeScript, no semicolons, oxfmt, and oxlint. Read the installed Next.js guides before implementation. Keep attribution/license notes in the repository as requested; do not put implementation details into the player flow.
