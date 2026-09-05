# Character readability and likeness refresh

Generated with the **built-in ImageGen tool** on 2026-09-05. The three selected PNGs were copied unmodified into the project. Previous atlases remain available. No programmatic pixel editing, background removal, or resampling was used.

## Delivered assets

| Project asset | Dimensions | Alpha range | Fully transparent pixels |
| --- | --- | --- | --- |
| `public/game/enemies-paperclip-maximizer.png` | 1536 × 1024 | 0–254 | 63.56% |
| `public/game/enemies-sam-likeness.png` | 1536 × 1024 | 0–254 | 50.23% |
| `public/game/faces-yudkowsky-n64.png` | 1774 × 887 | 0–255 | 38.40% |

The paperclip maximizer now uses a giant upright GEM-type office paperclip as its main silhouette. Its smaller clip hands and collapsed pile of clips repeat that recognizable shape. The glowing eyes decorate the clip instead of replacing it.

Sam's head is substantially larger relative to the server mech. A long face, prominent ears, short swept-up brown hair, narrow nose, and small asymmetrical smile improve recognition from a gameplay distance. The final pose depicts safely powered-down equipment with its pilot unharmed.

The HUD researcher has a broad rounded face, fuller wavy brown hair, thick beard, and four escalating expressions. The glasses from the previous approximate portrait are removed. These are affectionate stylized likenesses, not photographic reproductions.

## Source provenance

- Paperclip: `/Users/tfischer/.codex/generated_images/01a06fb8-63d9-74a3-a42f-3ad31836f90e/exec-6b1098fb-59cb-4517-b607-69b2572ec595.png`
- Sam: `/Users/tfischer/.codex/generated_images/01a06fb8-63d9-74a3-a42f-3ad31836f90e/exec-41cba406-5b87-4555-ae29-1316a4a69611.png`
- Researcher: `/Users/tfischer/.codex/generated_images/01a06fb8-63d9-74a3-a42f-3ad31836f90e/exec-463586c5-2b87-45c1-9abf-a45c4e2340d2.png`

Existing sheets were visually inspected before generation, but no image attachments were passed into these three fresh generations. Named subjects and written design descriptions supplied the references. The [MIRI team page](https://intelligence.org/team/) and [World Economic Forum profile](https://es.weforum.org/people/sam-altman/) were consulted for subject identity. No downloaded photograph is bundled or composited into the game.

## Frame contract

Both enemy sheets contain six poses in row-major order: idle, left step/drift, right step/drift, preparation, activation, and collapsed/powered-down equipment. Use the explicit source rectangles in `lib/game/enemy-art.ts`, not an equal-grid crop. The generated preparation and activation poses exceed their nominal cells.

Measured opaque bounds use alpha greater than 128. The renderer adds a two-pixel margin, which also includes useful antialiased fringes visible above its 0.28 alpha threshold.

```json
{
  "paperclip": {
    "referenceHeight": 491,
    "frames": [
      [67, 9, 357, 491],
      [518, 10, 427, 491],
      [1130, 10, 380, 491],
      [135, 517, 228, 496],
      [489, 517, 545, 492],
      [1050, 725, 467, 251]
    ]
  },
  "sam": {
    "referenceHeight": 503,
    "cutouts": [
      { "frame": 0, "x": 430, "y": 488, "width": 80, "height": 20 },
      { "frame": 3, "x": 70, "y": 486, "width": 340, "height": 20 }
    ],
    "frames": [
      [16, 0, 451, 503],
      [545, 5, 445, 500],
      [1081, 6, 420, 499],
      [27, 490, 473, 518],
      [559, 517, 485, 493],
      [1095, 576, 414, 428]
    ]
  },
  "researcher": {
    "sheet": [1774, 887],
    "equalColumnWidth": 443.5,
    "opaqueHeadBounds": [
      [12, 101, 420, 663],
      [454, 101, 422, 669],
      [898, 100, 421, 670],
      [1339, 101, 423, 669]
    ]
  }
}
```

The new tall paperclip uses bottom anchoring and the existing floating bob. The previous central-eye anchor would place its longer lower body beneath the floor, so no eye anchor is supplied.

Sam's first and fourth crop rectangles overlap a narrow part of their neighbors. The idle crop includes 237 opaque pixels of the preparation pose's cannon tip; the preparation crop includes 3,649 pixels of idle feet. Frame-specific rectangular renderer masks remove those neighboring fragments while preserving both complete intended poses. Source PNGs are unchanged.

## Transparency QA

The apparent gray/brown backgrounds in a raw RGB preview are hidden RGB under transparent pixels. At the renderer's actual cutoff (alpha greater than 71), connected-component analysis still finds six major isolated characters on each enemy atlas, and four isolated heads on the portrait strip. There are no rectangular background components.

Corner samples are alpha 0–1 for the enemy atlases and alpha 0 for the portrait. Common gutter samples `[512,256]`, `[1024,256]`, `[512,510]`, `[1024,510]`, `[500,800]`, and `[1510,1010]` are alpha 0 except one paperclip gutter at alpha 1. The paperclip's interior loop samples `[250,60]` and `[250,280]` are alpha 0. The max alpha of 254 on enemy artwork is a normal generated-image property; the renderer's alpha test discards the transparent background.

## Final prompts

### Paperclip maximizer

Use case: stylized-concept. Create a production video-game PNG sprite atlas with GENUINELY TRANSPARENT ALPHA, not a checkerboard. Exact canvas 1536 by 1024, THREE columns by TWO rows, six square 512 by 512 cells. One full isolated creature pose per cell with at least 24 pixels clear transparent gutters. All five living poses same scale and occupy y=30 to y=470 within their cell. No overlapping cells, no background, no floor, no drop shadow, no labels.

Redesign the AI paperclip maximizer as a VERY RECOGNIZABLE GIANT OFFICE PAPERCLIP turned into a sinister Doom64 monster. The dominant silhouette MUST be ONE huge upright silver GEM-TYPE PAPERCLIP: long rounded oblong double loop of folded steel wire with the clear inner return-loop and open gap, exactly the familiar stationery paperclip shape that anyone recognizes. Paperclip loop accounts for 75 percent of total body height. Silver-white beveled steel edge highlights and dark scratched steel sides, instantly legible against dark rooms. Small pair of sinister reddish eyes attached to the upper crossing wire and a small toothy grin, but the eyes MUST NOT replace the main paperclip opening. Thin bent-wire arms terminate in two smaller ordinary paperclips. A loose chain of a few small paperclips hangs at lower edge. No fleshy eyeball, no radial flower shape, no tentacle ball, no abstract loops. It should read as evil Clippy / runaway paperclip manufacturing, with monstrous attitude but unmistakably stationery.

Gritty Doom64 1997 N64 pre-rendered pixel sprite style, chunky discrete pixel clusters and dithered dark shading, 3D volume, high contrast metallic silver, warm rust accents, restrained red eyes. Front view, slightly three-quarter at most. Row-major poses: 1 idle, upright main paperclip and arms relaxed; 2 drifting left, slight lean left and left arm forward; 3 drifting right, slight lean right and right arm forward; 4 windup, arms and small paperclips drawn inward, intact large main clip unchanged; 5 release, arms extending outward toward viewer with a tiny red spark, main oblong paperclip remains clearly recognizable; 6 defeated state, collapsed crumpled heap of ordinary silver paperclips on bottom of cell, recognizable small office paperclips with eyes extinguished. No gore. All interiors of wire loops are actually transparent, not black painted fill. Consistent character design, tight individual silhouettes, generous gap between cells.

### Sam Altman server mech

Use case: stylized-concept. Create a NEW production game PNG sprite atlas, six complete isolated poses in EXACT 3 columns x 2 rows of square 512px cells on a 1536x1024 canvas. GENUINELY TRANSPARENT ALPHA, including every gap, no background, no ground or shadows, no checkerboard, no borders or text. All complete poses must stay at least 20px within their own cell. Standing poses same scale, feet at y=476 relative to cell.

The SAME clearly recognizable satirical SAM ALTMAN pilots a chunky retro blackened server-rack robot suit. His face is the MAIN PRIORITY, much larger and clearer than usual: head takes up 27% of the FULL character height, about 120 pixels high within every standing cell, centered unobstructed above a short broad torso. Exaggerate his distinctive long narrow clean-shaven face, very prominent projecting ears, short tousled slightly wavy brown hair swept upward, straight long nose, thin closed lips and small slightly awkward asymmetrical smile, pale blue-gray eyes, angular chin. Do not give him a beard, do not use generic chubby youthful face or tiny head. He wears a dark navy hoodie, hands visible at safe cockpit controls, friendly calm expression. Make the likeness obviously Sam Altman, a legible affectionate caricature rendered as a late-1990s Doom64 pre-rendered sprite.

Compact squat server-rack exosuit, black iron drive bays with sparse amber/green LEDs, copper-red cable hoses, heavy rectangular feet, industrial equipment tube arm on VIEWER-RIGHT and gloved manipulator on viewer-left. Dark steel, warm dirty edge highlights, chunky pixel clusters with dithered volumetric shading. NO smooth cartoon or photorealism. Keep pilot well-lit and easy to recognize. Same face and head shape every cell.

ROW-MAJOR poses: 1 idle with equipment arm resting; 2 one heavy robot foot stepping forward; 3 opposite foot stepping forward; 4 mechanical equipment preparation, tube arm rotates upward; 5 equipment activation with SMALL BLUE indicator glow inside tubes and one hand operating controls, no projectile or blast; 6 SAFE POWERED DOWN equipment state: suit is seated and folded low, lights off, human pilot plainly UNHARMED and still smiling calmly from cockpit. Deactivated machinery only, not an injured person or corpse. No blood or violence. Front facing with minimal three-quarter variation; readable head shape and consistent head size across all six. The pilot is safe in all frames. Transparent PNG sprite sheet, 1536x1024.

### Eliezer Yudkowsky HUD expressions

Use case: stylized-concept. Create a production HUD portrait sprite strip for a Doom64-inspired AI safety parody game. Four evenly-spaced front-facing portraits of the SAME recognizable ELIEZER YUDKOWSKY, arranged left to right in EXACTLY FOUR equal columns on one landscape PNG canvas, ideally 2048x768. GENUINELY TRANSPARENT background alpha, including gaps between heads, no checkerboard, no text, no border, no shadow, no backdrop. Each portrait same head dimensions and pose: full head and a hint of black shirt collar, centered horizontally in its column. Hair at y=60 and beard/chin ends at y=700. Leave 20px transparent margin either side within each column. Large close-up face; no torso or props.

Priority is the recognizable Eliezer Yudkowsky facial identity: BROAD FULL ROUND FACE and fleshy cheeks, light skin, thick DARK BROWN WAVY HAIR with a high/receding temple line but visibly full wavy hair across crown, heavy dark eyebrows, relatively small deep-set brown eyes, broad nose, close-cropped full dark brown beard and mustache with a little gray on lower edge. NO GLASSES. Do not turn him into a bald narrow-faced generic programmer. His broad forehead, rounded cheeks and thick lower beard should form the clear familiar silhouette. Affectionate caricature of the AI doomer / Bayesian researcher, recognizable and expressive rather than photoreal.

Style: gritty N64 / Doom64 late-1990s pre-rendered pixel portrait, sculpted facial planes, coarse discrete pixel clusters, dithered amber and gray skin highlights, dark warm brown shadows, high detail concentrated in eyes/nose/beard, no smooth vector cartoon. Keep face readable when shrunk to 64x80 pixels. Consistent frontal lighting and exact identity/scale across all FOUR.

Expressions left to right: 1 skeptical concentrated calm, raised eyebrow and pursed lips; 2 worried, knitted brow and worried downturned mouth; 3 extremely anxious, eyebrows raised centrally, small sweat bead, eyes wider; 4 existential panic, wide eyes and open worried mouth with sweat, no wounds, no bruises, no gore. Only expressions change, not head shape or framing. This is a compact portrait sprite strip with real transparent background.
