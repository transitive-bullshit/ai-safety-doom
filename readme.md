# P(DOOM)

They built a god. You brought a shotgun.

A desktop first-person shooter parody set in a breached frontier AI lab, with the atmosphere and opening composition of **Doom 64's Staging Area** as its current reference. One level, four arguments, three alignment failures, and a required encounter with Sam before you can shut the training run down. Built with Three.js, TypeScript, and Next.js.

## Play locally

Requires Node.js 22.13+ and pnpm. Use desktop Chrome or Edge with WebGL enabled.

```sh
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000), choose **Start Training Run**, select your p(doom), and start directly in the lab. Hover previews a difficulty with a warm highlight and mechanical clunk; click, Enter, or Space selects it. The skull stays beside the selected difficulty while you browse. Activate **Start Training Run** to launch that choice. Find the big red shutdown button and stop the lab’s AI training; defeating Sam unlocks the final switch. The default difficulty is 10%. The 1% setting is more forgiving; 99% adds faster enemies and respawning. A URL such as `/?skill=50` preselects the difficulty.

| Input                         | Action                                      |
| ----------------------------- | ------------------------------------------- |
| WASD                          | Move and strafe                             |
| Mouse / left and right arrows | Aim horizontally, with height-aware autoaim |
| Click / Space / left Ctrl     | Fire                                        |
| 1–4                           | Select an acquired weapon                   |
| E                             | Open/close doors / activate shutdown        |
| Shift                         | Run                                         |
| Tab                           | Facility map                                |
| Escape                        | Toggle pause/resume and mouse capture       |

If a browser embedding prevents mouse capture, use arrow-key aiming or click and drag. The game pauses when focus is lost. Sound, fullscreen, restart, and return to menu are available in the game UI. A viewport of at least 1024 × 720 is recommended.

## What is in the demo

- Doom 64-inspired brown industrial panels, dark violet sky, sector colors, and a worried researcher HUD, with frontier-lab details throughout.
- A console-style title screen with a new carved P(DOOM) logo, ember-red bitmap menu lettering, skull cursor, keyboard navigation, and a centered 4:3 composition. Sound, fullscreen, and controls live under Options. Small X and GitHub icons on the title and credits open the creator's profile and project repository in new tabs.
- A raised arrival platform overlooking a lower chamber, stairs and a real drop, roof openings, an open-sky containment court, and connected computer rooms, galleries, and service areas.
- Brisk movement with acceleration, firm braking, gravity, and landing feedback; horizontal aiming with vertical assistance for enemies on different elevations.
- System Prompt, RLHF, Mechanistic Interpretability, and the Big Fuckin’ Shutdown Button, with distinct combat and ammunition behavior and prominent discovery announcements.
- Deceptive alignment, sycophancy, paperclip maximizers, and Sam in launch-platform armor, each with walking, attack windup/release, and defeated poses.
- Volatile Poisoned Training Data barrels with chain explosions, blast lighting, persistent wreckage, and real cover/height occlusion.
- Turning ventilation fans, rising vent steam, overhead cables, working eval monitors, and door status lamps.
- Pressure-seal lab doors: E opens or closes them, with air-release/suction sounds and a locking clunk on the actual seal. Occupied doorways refuse to close; secret panels stay open.
- Touch Grass health, Guardrails armor, and Training Data ammunition.
- Distinct gritty pickup cues: torn grass and a pressure release, a heavy guardrail latch, crunchy data transfers, and weapon mechanisms, with a deeper Shutdown Button variant.
- Each enemy has its own awareness and attack sounds, plus a recognizable original Doom death cry: imp for Deceptive Alignment, zombie for Sycophancy, demon for Paperclip Maximizer, and Baron for Sam. Cues track position and distance, and alert once per life.
- Recorded human pain grunts alternate on damage; a distinct death yell finishes over the death screen. Dense hits do not stack voices, and fatal damage replaces pending grunts with one scream.
- Death sends staggered blood streaks down the frozen game before revealing Retry and Return after 1.4 seconds. Holding Fire through death cannot activate Retry; reduced motion reveals the covered results immediately.
- Large pickup punchlines with protected reading time, plus separate “Vanquished” notices naming each AI risk.
- A matching stone/metal HUD, worried Eliezer-inspired portrait, and console-style training pause and results screens. Refreshed paperclip and Sam sprites emphasize their identities.
- Brisk bottom-to-top credits in matching HUD lettering: Space pauses/resumes, manual scrolling interrupts, and Replay restarts. The creator's padded name links to his X profile, and GPT-6 ASTRA leads the Built With credit. Hovering does not pause the roll; reduced motion uses a static list. Short menu and HUD fragments omit trailing periods; full sentences keep their punctuation.
- A large three-column Controls guide, available from both Options and the pause menu.
- A worn **PHASEONE[big] / was here** wall sign visible from the arrival platform.
- Optional Bayesian and held-out-test-set secrets, deeper discoveries, and a boss-gated shutdown finale.
- Five difficulties, pause, automap, mute, fullscreen, death, and replay.
- Difficulty also changes enemy density: 1% and 10% keep the base roster; 50% adds 2, 90% adds 8, and 99% adds 36. Nightmare crowds the opening approaches and reinforces the route through Sam's arena.
- Weapon muzzle flashes, recoil, switching motion, impact sparks, wall marks, and pickup feedback.
- Original generated retro artwork and a mix of recorded and synthesized sound: a punchier recorded System Prompt report, the RLHF shotgun blast and pump, a heavier Shutdown Button discharge, recorded human player vocals, original Doom monster deaths, mechanical menu clunks, an industrial score, positional combat/door cues, room reflections, and ambient machinery that changes between rooms and open air. Nine recordings preload locally with independent fallback. Audio starts with a menu interaction and honors mute and pause. Attribution is in [NOTICES.md](NOTICES.md); no external AI services or API keys are used at runtime.

The level and simulation are an **authored approximation**, not an exact reconstruction of Doom 64's map, physics, weapons, or enemy behavior. The approved Three.js direction superseded the initial WASM plan; the later Staging Area direction replaced the earlier E1M1 opening reference. See the [Doom 64 reference research](docs/research/doom64-staging-area.md) for inspected game artifacts, original-developer and composer sources, and the new texture prompts.

Enemies use six-pose animated billboards with hit tint and grounded defeated artwork; they do not include eight viewing directions. Bloom, mobile, saved games, multiplayer, and additional levels are outside this milestone.

## Development

```sh
pnpm test       # Format, lint, TypeScript, gameplay unit tests
pnpm e2e       # Browser journeys using installed Google Chrome
pnpm build     # Production build
pnpm start     # Serve the production build
pnpm fix       # Format and lint fixes
```

The browser runner starts a local development server when needed and reuses port 3000 if one is already running. Install Google Chrome before running it. Tests exercise normal controls and read-only state hooks; they do not teleport the player or expose a gameplay backdoor.

| File | Responsibility |
| --- | --- |
| `lib/game/level.ts` | Authored geometry, encounters, pickups, signs, and secrets |
| `lib/game/model.ts` | Simulation, weapons, enemies, resources, doors, and progression |
| `lib/game/math.ts` | Collision and geometric queries |
| `lib/game/view.ts` | Three.js scene, sprites, textures, and automap |
| `lib/game/scenery.ts` | Lab machinery, terminals, vents, and barrel artwork |
| `lib/game/enemy-art.ts` | Animation atlas rectangles and visual anchors |
| `lib/game/runtime.ts` | Frame loop, controls, lifecycle, and UI snapshots |
| `lib/game/audio.ts` | Recorded and synthesized effects, positional mixing, room reflections, and ambient machinery |
| `lib/game/menu-audio.ts` | Mechanical menu effects and original title/gameplay score |
| `lib/game/notices.ts` | Bounded pickup queue and independent vanquished notices |
| `components/game/game-shell.tsx` | Menus, HUD, overlays, and runtime loading |
| `components/game/title-screen.tsx` | Console title/options/difficulty screens, bitmap lettering, and menu input |
| `components/game/credits-roll.tsx` | Scrolling console credits, playback controls, and reduced motion |

The simulation is independent of React and WebGL. React receives throttled HUD snapshots; it does not drive the frame loop. Adjust map content and sector elevations in `level.ts`, combat tuning in `model.ts`, and display labels in `types.ts`. See [the approved brief](docs/design/mvp-spec.md), [verification notes](docs/verification.md), [initial art prompts](docs/design/production-art-prompts.md), and [Doom 64 research and texture prompts](docs/research/doom64-staging-area.md).

The title and menus follow the [original-console menu reference](docs/design/title-menu-reference.md). New logo/cursor assets and their final ImageGen prompts are recorded in [title-art.md](docs/design/title-art.md). The original PNGs retain their alpha; Next.js serves optimized display versions.

The later [character refresh](docs/design/character-readability-art.md) records the final paperclip, Sam, and researcher prompts, crop metadata, and alpha checks. [Audio notes](docs/design/audio-refresh.md) describe the original menu clunks and industrial score.

## Credits

Code is [MIT licensed](license) © [Travis Fischer](https://x.com/transitive_bs). See [asset and attribution notes](NOTICES.md).
