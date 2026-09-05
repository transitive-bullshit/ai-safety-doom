# Animated enemy art polish

Four production sprite sheets were generated with built-in ImageGen for the higher-fidelity Doom 64-inspired polish pass. Each image was copied unmodified from the generated output into `public/game`. The original `enemies.png` atlas is preserved. No programmatic pixel editing or background-removal workaround was used.

## Delivered sheets

All four images are **1536 × 1024 PNGs with real alpha ranging from 0 to 254**.

- `public/game/enemies-deception-animated.png`
- `public/game/enemies-sycophant-animated.png`
- `public/game/enemies-paperclip-animated.png`
- `public/game/enemies-sam-animated.png`

The six poses follow row-major order: idle, left step/drift, right step/drift, attack windup, attack release, and collapsed/powered-down state.

The source atlas was inspected first to preserve each creature's identity: masked olive imp, grinning red thumbs-up demon, metal paperclip eye, and Sam's server-armored mech. These are newly rendered pose variations, not pixel-exact transformations. The final sheets move toward a darker, sculpted late-1990s sprite appearance while keeping those silhouettes and jokes.

## Layout and crop contract

The requested layout was three equal columns by two equal rows. The output uses that arrangement, but some attack poses cross the nominal 512px cell boundaries. **Do not slice using a blind equal grid.** In particular, the paperclip release expands above and beside its nominal cell; deception and Sam windup reach slightly into the row above.

The following rectangles isolate the main opaque connected components. Coordinates are `[x, y, width, height]` in full-sheet pixels, measured without changing the source files. A two-pixel transparent margin is reasonable; clamp to image edges.

```json
{
  "deception": {
    "referenceHeight": 470,
    "rects": [
      [79, 12, 302, 470],
      [600, 12, 314, 481],
      [1114, 13, 326, 483],
      [57, 504, 415, 491],
      [586, 537, 345, 463],
      [1034, 738, 472, 246]
    ],
    "baseline": [482, 493, 496, 995, 1000, 984]
  },
  "sycophant": {
    "referenceHeight": 472,
    "rects": [
      [57, 9, 399, 472],
      [586, 16, 367, 469],
      [1099, 12, 364, 472],
      [52, 521, 396, 466],
      [515, 521, 506, 482],
      [1033, 724, 479, 242]
    ],
    "baseline": [481, 485, 484, 987, 1003, 966]
  },
  "paperclip": {
    "referenceHeight": 448,
    "rects": [
      [26, 11, 453, 448],
      [561, 30, 439, 429],
      [1071, 30, 437, 429],
      [93, 535, 306, 375],
      [484, 474, 563, 509],
      [1030, 768, 491, 230]
    ],
    "eyeAnchors": [
      [250, 235],
      [720, 233],
      [1353, 231],
      [246, 723],
      [765, 728]
    ],
    "corpseAnchor": [1275, 998]
  },
  "sam": {
    "referenceHeight": 500,
    "rects": [
      [33, 5, 431, 500],
      [547, 7, 446, 502],
      [1076, 8, 432, 501],
      [20, 509, 479, 507],
      [552, 529, 430, 484],
      [1047, 620, 469, 352]
    ],
    "baseline": [505, 509, 509, 1016, 1013, 972]
  }
}
```

For each texture crop:

```text
repeat = [width / 1536, height / 1024]
offset = [x / 1536, 1 - (y + height) / 1024]
```

Use the idle body's `referenceHeight` as the common pixel-to-world scale for every frame of that enemy. Scale frame width and height proportionally to the crop dimensions. Do not expand each frame to the same displayed height: this would enlarge the corpse and make windup poses pop in size.

### Grounded enemies

There is no exact shared living ground baseline in the generated artwork. The `baseline` arrays above give the actual lower body bound in full-sheet pixel coordinates, including all six poses. Anchor each grounded pose at its own bottom to prevent feet floating above the floor.

For living X alignment, a consistent nominal cell-center anchor (256, 768, 1280 by column) prevents changing arm/cannon widths from recentering the body. This is a practical initial anchor; small optical corrections may still improve animation in motion.

Given crop `[x,y,w,h]` and source anchor `[ax,ay]`, Three.js sprite center coordinates are:

```text
center.x = (ax - x) / w
center.y = (y + h - ay) / h
```

Corpse or powered-down frames can use bottom-center anchoring directly.

### Paperclip eye alignment

The paperclip's contraction and flare should happen around a fixed world-space eye position, not its lowest metal loop. The five listed `eyeAnchors` are initial optical alignment recommendations in full-sheet coordinates, informed by visual inspection and red-core/pupil pixel measurements. Keep the eye's world height constant while switching frames and apply any floating bob to that common point. Use ground anchoring for the sixth, collapsed frame.

The eye anchors are approximate visual alignment choices rather than claims of mathematically identical generated eye geometry. Tune them by a few pixels if a visible shift remains in the rendered animation.

## Transparency verification

The preview displays a colored gradient in RGB beneath transparent pixels. Decoding the PNG confirms that this is not an opaque backdrop.

For each sheet, all four corner samples and six inter-frame/gap samples had **alpha = 0**, even when their RGB values contained brown/gray. Sample positions were `[0,0]`, `[1535,0]`, `[0,1023]`, `[1535,1023]`, `[512,256]`, `[1024,256]`, `[20,500]`, `[1500,500]`, `[768,1018]`, and `[1530,700]`.

Outside the union of the reported frame rectangles:

| Sheet     | Outside pixels | Alpha > 70 |  Percent | Alpha > 128 |
| --------- | -------------: | ---------: | -------: | ----------: |
| Deception |        642,820 |         37 | 0.00576% |           0 |
| Sycophant |        496,259 |        115 | 0.02317% |           0 |
| Paperclip |        483,524 |         46 | 0.00951% |           0 |
| Sam       |        300,979 |         20 | 0.00664% |           0 |

The small nonzero values are antialiased edge fringes. No outside pixel exceeded alpha 128. The current opaque-component rectangles plus a small margin preserve the useful silhouettes.

A pixel-level integration review found that the widened paperclip release rectangle also includes 581 visible pixels from its neighboring defeated pose. The renderer masks the source-sheet corner `x >= 1028 && y >= 900` only while showing release frame 4. This retains the intended attack flare and leaves the defeated frame intact. The source PNG is unchanged.

## Visual QA and limits

- Deception has distinct walking, windup, release, and collapsed poses. The smiling mask remains on the viewer-left in living frames.
- Sycophancy keeps its grin and thumbs-up identity in locomotion, then shifts to a clearly aggressive lunge.
- Paperclip drift, contraction, flare, and crumpled metal heap are readable. Its attack flare has the largest cell overrun, so explicit crops and eye anchoring matter.
- Sam's suit has clear alternate steps, preparation, activation, and a seated powered-down state. The pilot remains visibly unharmed.
- The initial Sam damaged/death-frame request was rejected by the image tool for public-figure violence. The selected safer version depicts equipment deactivation with an unharmed pilot, not an injured person.
- The first reference-attached deception output had a baked-in checkerboard and no alpha; it was discarded. The selected output is a fresh generation preserving the described identity.
- These are six front-facing pose sheets. They do not add eight-direction locomotion, authored hit frames, or long death-animation sequences.

## Source provenance

- `enemies-deception-animated.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-e828c5df-ac16-4cc8-8b75-18e07e597de3.png`
- `enemies-sycophant-animated.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-c99b8df7-d1ed-4777-928e-71f599534e20.png`
- `enemies-paperclip-animated.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-4b8dbe1f-daec-42bc-8da9-4ce7ae5c31d4.png`
- `enemies-sam-animated.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-2991966b-5aa5-44f6-963b-d2d218055fbd.png`

## Final prompts

### deception

Generate a transparent-background PNG asset with alpha, suitable for compositing into a video game. This is a sprite animation atlas. Exactly 3 columns × 2 rows of equal square cells on a 1536×1024 canvas. Six full-body poses of the SAME character, each fully isolated within its own cell, no overlap or cropping. All five living frames use identical character scale, horizontally centered, with feet at y=472 in the first row and y=984 in the second row. Corpse uses the same lower baseline. Large empty transparent gutters. All blank space and holes in silhouettes genuinely transparent. No backdrop, no ground plane, no cast shadows, no labels, no borders. Gritty Doom 64 / 1997 pre-rendered pixel-art monster sprites, chunky dark dithered shading, readable silhouette, no smooth modern cartoon. Same identity, palette and proportions in every frame. Row-major pose order: top-left idle; top-middle left-foot step; top-right right-foot step; bottom-left attack windup; bottom-middle attack release; bottom-right collapsed dead body. Distinct walking legs and attack poses. All frames remain front-facing or very slightly turned, no rear/side views. Character: hunched olive-brown sinewy clawed imp, one hostile red snarling face with sharp small teeth and glowing red eye, behind a large ivory smiling comedy mask held on the viewer-left side in every living pose. Uneven short horns, sparse spikes on shoulders/back, clawed brown feet, strong grotesque proportions. Idle/walking: mask held close to cheek and chest, free claw hangs down. Attack windup: masked imp pulls a red-energy-holding claw back over its shoulder and braces legs. Attack release: free claw flung forward with red energy glowing in palm, mask shifted aside slightly to reveal red demonic face. No detached projectile. Corpse: collapsed low on hands/knees then folded sideways, mask fallen flat beside face, a little dark red stain. Preserve viewer-left mask side in every pose, do not mirror the identity.

### sycophant

Generate a transparent-background PNG asset with alpha, suitable for compositing into a video game. This is a sprite animation atlas. Exactly 3 columns × 2 rows of equal square cells on a 1536×1024 canvas. Six full-body poses of the SAME character, each fully isolated within its own cell, no overlap or cropping. All five living frames use identical character scale, horizontally centered, with feet at y=472 in the first row and y=984 in the second row. Corpse uses the same lower baseline. Large empty transparent gutters. All blank space and holes in silhouettes genuinely transparent. No backdrop, no ground plane, no cast shadows, no labels, no borders. Gritty Doom 64 / 1997 pre-rendered pixel-art monster sprites, chunky dark dithered shading, readable silhouette, no smooth modern cartoon. Same identity, palette and proportions in every frame. Row-major pose order: top-left idle; top-middle left-foot step; top-right right-foot step; bottom-left attack windup; bottom-middle attack release; bottom-right collapsed dead body. Distinct walking legs and attack poses. All frames remain front-facing or very slightly turned, no rear/side views. Character: broad obese crimson-red SYCOPHANCY demon, big round red belly, two thick cream-colored curled horns, bulging pale eyes with tiny red pupils, absurdly huge mouth packed with a wide grid of yellow-white teeth in a permanent agreeable grin, clawed feet, short thick arms. Idle and both walk frames give two big thumbs-up gestures. Walking has visibly alternate leading feet and opposite shoulder motion while preserving smile and horn placement. Attack windup: big grin leans back and both fists draw toward its chest, thumbs still visible. Attack release: demon lunges forward, mouth gaping aggressively and both thick clawed hands outstretched toward player. Corpse: fat red body collapsed flat/sideways, limbs folded, grin and one horn recognizable, tiny dark-red stain. No hands or horns crossing cell edges.

### paperclip

Generate a transparent-background PNG asset with alpha, suitable for compositing into a video game. This is a sprite animation atlas. Exactly 3 columns × 2 rows of equal square cells on a 1536×1024 canvas. Six full-body poses of the SAME character, each fully isolated within its own cell, no overlap or cropping. All five living frames use identical character scale, horizontally centered, with feet at y=472 in the first row and y=984 in the second row. Corpse uses the same lower baseline. Large empty transparent gutters. All blank space and holes in silhouettes genuinely transparent. No backdrop, no ground plane, no cast shadows, no labels, no borders. Gritty Doom 64 / 1997 pre-rendered pixel-art monster sprites, chunky dark dithered shading, readable silhouette, no smooth modern cartoon. Same identity, palette and proportions in every frame. Row-major pose order: top-left idle; top-middle left drift; top-right right drift; bottom-left attack windup; bottom-middle attack release; bottom-right collapsed dead body. Distinct tentacle drift and attack poses. All frames remain front-facing or very slightly turned, no rear/side views. Character: PAPERCLIP MAXIMIZER, an eldritch floating bundle of thick gleaming dark-silver steel paperclips curved into looping tentacles around one huge central fleshy red eyeball with black pupil and a ring of small teeth. No humanoid torso, hands, or feet: the entire body is many overlapping looped metal paperclips around the eye. Idle: circular spread of roughly eight readable loops. Left drift: eye tilts a little left while left-side loops curl inward and right loops extend. Right drift: opposite tentacle arrangement. The eye center stays at the same height and scale. Attack windup: loops draw inward around an intensely glowing red pupil. Attack release: loops flare radially outward, eye wide and red-energy glow at its center; no detached projectile. Corpse: eye extinguished and collapsed on the lower baseline, paperclip tentacles crumpled into a low scattered heap with recognizable metal loops, a dark shriveled eye. All metal-loop holes remain transparent.

### sam

Generate a transparent-background PNG sprite sheet of a humorous science-fiction ROBOT SUIT with a harmless Sam Altman caricature pilot. This is affectionate AI-lab satire. The human pilot is UNHARMED and calmly smiling in ALL six frames, including the final frame. No blood, injuries, human death, threatening human action, explosion or damage to the human.

Exactly 3 equal columns × 2 equal rows on a 1536×1024 landscape canvas: SIX square 512×512 cells. One complete full-body mech pose per cell, each centered with generous transparent margins, all standing poses identical scale and feet at 92% cell height. Genuinely transparent alpha background and all gaps, no backdrop, no checkerboard, no text or borders.

Character remains consistent in all six poses: small recognizable satirical Sam Altman face (short wavy brown hair, clean-shaven, light skin, friendly awkward smile) visible safely in an open cockpit atop a HUGE chunky retro blackened server-rack robot suit. Broad torso of server drive bays with tiny muted green/amber LEDs, thick rectangular mechanical legs, copper-red cable hoses over shoulders, large multi-tube equipment arm on VIEWER-RIGHT, heavy robot glove on viewer-left, small generic geometric lab badge on chest. Gritty Doom64 / 1997 low-resolution pre-rendered pixel-art style, dark dithered metal shading, no photorealism. Front-facing or slightly three-quarter, no side or rear view.

Six poses in ROW-MAJOR ORDER: 1 top-left: idle, feet planted, equipment arm resting. 2 top-middle: left walking step, one robot foot forward. 3 top-right: right walking step, opposite robot foot forward. 4 bottom-left: equipment preparation, robotic tube arm rotates upward and pilot calmly operates controls. 5 bottom-middle: equipment activation, tube arm faces forward with a SMALL BLUE ELECTRICAL indicator glow inside tubes, glove braced, NO projectile, blast, gunfire or violence. 6 bottom-right: SAFE POWERED-DOWN state, robot suit sitting and folded low with its mechanical limbs collapsed around it, panel lights off. Its human pilot is clearly UNHARMED, still calmly smiling from the cockpit. The robot is intact, just deactivated by its emergency stop. Low silhouette contained inside the cell, no corpse and no human injury.

Same face size, head shape, suit design and colors across all frames. Every complete pose must stay within its own square and must be separable by an equal 3×2 grid for game animation. Transparent background.

## Initial reference-attached deception prompt

This attempt established the first six-pose layout but was not selected because its background was opaque.

Generate a true TRANSPARENT PNG animation sprite sheet for a video game. Image 1 is the character reference atlas; use ONLY its LEFTMOST monster: the olive-brown hunched DECEPTIVE ALIGNMENT imp with sharp claws, evil red face, and pale happy smiling mask held on the viewer's LEFT side. Preserve that monster's recognizable design, proportions, texture colors and identity. Do not include any of the other three characters.

OUTPUT LAYOUT IS CRITICAL: a NEW landscape canvas with an exact 3:2 aspect ratio, ideally 1536x1024 pixels. Divide it into EXACTLY THREE EQUAL COLUMNS and TWO EQUAL ROWS, making SIX equal SQUARE cells. Place exactly ONE complete isolated pose centered horizontally inside EACH cell. All five living poses have the SAME head size and body scale; feet align to 92% of each cell's height. Each cell has generous empty transparent gutters on all four sides; no part crosses a cell boundary, no pieces of neighboring sprites, no frame or text. Keep all six cells equally sized even though the corpse is short. The background, including all space between limbs, MUST have alpha=0. Do not draw a checkerboard or a black/white background.

ROW-MAJOR ORDER: Top-left: IDLE, hunched front-facing pose, mask on viewer-left, clawed feet planted. Top-middle: LEFT STEP, advancing one foot toward viewer and opposite shoulder forward, a visibly distinct walking pose; keep face/mask on same sides, not a mirrored character. Top-right: RIGHT STEP, opposite foot advancing and opposite shoulder forward, clear second walking pose, identity unchanged. Bottom-left: ATTACK WINDUP, legs planted and one clawed arm pulled back preparing to throw a small sinister red energy orb, torso twisted only slightly, mask stays readable. Bottom-middle: ATTACK RELEASE, throwing arm extended toward viewer with red energy in the hand, mask pulled a little farther aside to expose the red hostile face; complete full body, do not draw a detached flying projectile. Bottom-right: COLLAPSED CORPSE, same monster crumpled low on the ground with the ivory mask fallen beside it, no upright body; corpse sits on the SAME lower baseline and fits fully within its square, a small dark-red stain may be part of the body cutout but no cast shadow.

Style: gritty low-resolution Doom 64 / late-1990s pre-rendered pixel monster sprites. Consistent chunky pixel clusters, limited olive/brown/red/ivory palette, sharp silhouette edges, dark dithered shading, visible material volume. No photorealism, no modern smooth vector cartoon. This is a production game sprite atlas for swapping animation frames, not a concept board. True transparency and six equal cells are mandatory.
