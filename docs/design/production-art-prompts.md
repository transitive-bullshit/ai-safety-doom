# Production game art

Generated with the built-in ImageGen tool on 2026-09-05. Source images remain in the default generated-images directory; the selected original PNGs are copied into `public/game`. No pixel editing or resampling was performed.

## Delivered assets

| Asset | Dimensions | Alpha | Purpose |
| --- | --- | --- | --- |
| `public/game/menu.png` | 1672 × 941 | Opaque | Main menu background, quiet center for live title/menu |
| `public/game/enemies.png` | 2172 × 724 | Real alpha, range 0–255 | Deception, sycophancy, paperclip maximizer, Sam boss |
| `public/game/faces.png` | 1774 × 887 | Opaque charcoal background | Four researcher concern states |
| `public/game/weapons.png` | 2048 × 768 | Real alpha, range 0–254 | System Prompt, RLHF, Mechanistic Interpretability, shutdown cannon |

The generator produced four columns but did not maintain equal column widths for enemies or weapons. Consume those atlases using explicit source rectangles. These bounds were measured from alpha greater than 128 without modifying the image.

### Enemy source rectangles

Ordered deception, sycophancy, paperclip, Sam. Values are `[x, y, width, height]`.

```json
[
  [28, 123, 396, 569],
  [458, 96, 507, 581],
  [996, 44, 501, 648],
  [1531, 26, 629, 665]
]
```

### Weapon source rectangles

Ordered pistol, shotgun, plasma, BFG.

```json
[
  [10, 398, 343, 370],
  [421, 240, 473, 528],
  [930, 255, 500, 513],
  [1439, 240, 609, 528]
]
```

Add a small transparent margin when placing each crop into its own texture if helpful. Keep nearest-neighbor sampling for pixel clarity. Weapon bases terminate at the original image's bottom edge.

### Portrait layout

Four uniformly spaced columns (each 443.5px wide). Head artwork is approximately y=185–700; there is intentionally retained dark background above and below in the original. Expressions proceed from mild concern to panic. This is an inspired pixel caricature, not an exact photographic likeness.

## Selected original files

- Menu: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-edd9adad-9481-4eb3-9be1-f1b91eaa643c.png`
- Enemies: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-4e5da416-b661-4b01-8510-7556a2b20980.png`
- Faces: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-5ee8c166-255c-4d78-b816-02577548757e.png`
- Weapons: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-533d844a-7203-45a4-a8f4-55c6c20faf73.png`

## Prompts

Menu, initial enemy, and portrait prompts used `docs/design/concepts/b-frontier-lab.png` as a style reference. Weapon and final enemy generations used no image reference.

### Menu

Use case: stylized-concept. Asset type: production background art for the main menu of P(DOOM), a 1993 Doom-inspired AI-safety parody browser game. Generate a NEW single landscape image, ideally 1536x864 or 16:9. Image 1 is a visual reference for the industrial frontier-lab world and palette only; do not reproduce its layout, collage, text or HUD. Scene: ominous unoccupied concrete and olive-metal research-lab techbase, server racks like brutalist pillars, black and green cooling channels, red alert lights, hazard-striped heavy doors, green CRT equipment, cables, a distant tiny floating paperclip monster silhouette. Strong symmetric perspective recedes along a stone walkway into a dark containment chamber. Style: highly crafted 1993 Doom pixel art, visible chunky pixel clusters, gritty dithered limited palette and sharp nearest-neighbor edges, menacing old PC-game title-screen artwork. Warm gray and dirty olive stone, sickly phosphor green, tiny blood-red indicator lights. Composition: wide full-bleed scene, no border, center upper 65% kept dark and visually quiet enough for the application to overlay a large game title and menu; frame interesting details along the left/right edges and floor. No text, no logo, no HUD, no UI, no weapon in foreground, no watermark. This is the actual background bitmap consumed by a game, not a concept sheet.

### Enemies — final selected generation

Generate a transparent-background PNG asset with alpha, suitable for compositing into a video game. This is a transparent sprite atlas: four Doom-style monster cutouts, four equal columns in one row, wide 3:1 image. Do not draw a checkerboard. Blank space and all gaps inside silhouettes must be genuinely transparent, no ground, no shadow, no glow, no border or text.

Precisely four front-facing full-body idle sprites evenly spaced at the horizontal centers of four equal-width columns: (1) a hunched olive-brown clawed imp hiding its evil red face behind a tilted pale friendly smiling theater mask; (2) a fat red demon with bulging eyes, an absurdly enormous white toothy smile, giving two thumbs up; (3) a floating radial mass of shiny silver metal paperclips bent into many looping tentacles, surrounding one hungry red central eye, an eldritch paperclip maximizer; (4) recognizable fictional satirical caricature of Sam Altman, short brown hair, clean-shaven friendly face, head seated in a gigantic bulky cyberdemon mech made of dark server racks with tiny multicolor status LEDs, thick robot legs, an enormous multi-barrel rocket launcher in place of the left arm.

Vintage 1993 Doom pixel art, crisp pixel clusters, hand-dithered grimy shading, high-quality distinctive readable silhouettes, around 150 virtual pixels tall each. All characters complete and facing viewer, equal cell-width gutters, no overlap between cells, feet near a common lower baseline and heads entirely visible. The boss can be slightly taller. Transparently isolate all four monsters. The output needs true PNG alpha, like a game sprite sheet or sticker sheet without any backdrop.

### Researcher portrait atlas

Use case: stylized-concept. Asset type: production portrait sprite atlas for a classic Doom-style HUD. Generate a NEW single atlas containing EXACTLY FOUR equal square cells in ONE horizontal row; 2048x512 total if possible, or any exact 4:1 aspect ratio. Four close-up front-facing pixel portraits of the SAME Eliezer Yudkowsky-inspired AI-safety researcher, recognizable broad round face, full dark brown beard, dark short hair receding at the temples, thin dark rectangular glasses, thick eyebrows, warm light skin, black crew-neck collar barely visible at bottom. The four portraits must have IDENTICAL face size, head position, glasses, hairline and beard outline. Expressions left-to-right only change: 1. calm but skeptical and mildly concerned, closed mouth; 2. concerned brow, pursed mouth; 3. worried raised inner brows, slightly open mouth, one sweat bead; 4. full existential panic, eyes widened, mouth open, several sweat beads. Image 1 is a visual reference for the pixel-art material and portrait presentation only, improve the likeness and keep the face much wider/rounder and fuller-bearded. Tight crop head from top of hair to bottom of beard, shoulders unnecessary. Backdrop perfectly flat dark charcoal gray in each cell, no border or grid, no text, no labels. Four heads centered at precisely 12.5%, 37.5%, 62.5%, 87.5% across canvas; no head crosses its column. Style deliberately low-resolution 1993 Doom HUD art: each face reads as approximately 48x56 virtual pixels enlarged with nearest-neighbor edges, earthy 24-color palette, pixelated dithered shading, no smooth painted surfaces, no photographic skin.

### First-person weapons

Use case: stylized-concept. Asset type: production first-person weapon sprite atlas for a Doom-inspired browser game. Generate ONE transparent PNG atlas with EXACTLY FOUR equal-sized columns in a SINGLE horizontal row, about 2048x768 total. This is an atlas consumed in a game: divide canvas into four equally wide cells, place one weapon exactly at each cell's horizontal center. Entire background MUST be actual transparent alpha, not checkerboard or black. No divider lines, no frame, no text. Crucial perspective: ALL FOUR weapons are seen from the player's FIRST-PERSON view, centered from directly BEHIND and slightly ABOVE the weapon, with barrel pointing straight AWAY from viewer toward the top-center of its cell, as in Doom's bottom-center gun overlays. We see the back of the receiver and top of barrel; NO side profiles, NO weapon pointed AT camera, NO muzzle circular opening facing viewer. Weapons are bottom-aligned, base cut off flush with bottom edge, top tip around 35% of canvas height. Keep 8% of each cell empty on either side, none crosses cell boundary. LEFT TO RIGHT: 1. SYSTEM PROMPT: simple rugged matte gunmetal semiautomatic pistol with a tiny green glowing prompt-terminal inset on rear; 2. RLHF: chunky long dark-steel pump-action shotgun with ribbed wooden-brown pump housing, wide receiver, small green indicator; 3. MECHANISTIC INTERPRETABILITY: powerful futuristic plasma rifle with twin bright icy blue electromagnetic coils running along a boxy barrel, copper hardware and a tiny neuron-circuit display; 4. BIG FUCKING SHUTDOWN BUTTON: massive wide 1990s BFG-style heavy gunmetal cannon, distinctive broad olive armor around twin machinery pods and a GIANT bright red emergency STOP button on top of rear housing facing player, with yellow-black caution stripe trim. No readable text is required. All are game weapon sprites, compact readable silhouettes, old school 1993 Doom pixels and dithered metal shading, about 120-160 virtual pixels wide per weapon, visible nearest-neighbor chunky pixel clusters, no smooth vector illustration. Optional tiny black glove at base but no arms extending outside their cell. Full width of each weapon visible with consistent common baseline.

## Enemy transparency iterations

The initial enemy atlas and one background-extraction edit looked good but had a baked-in checkerboard and no alpha. Neither was selected for the game. The final fresh generation above supplied real alpha.

### Initial enemy prompt

Use case: stylized-concept. Asset type: production transparent PNG sprite atlas for a Doom-inspired AI-safety parody game. Generate a NEW single landscape atlas containing EXACTLY FOUR equally sized columns in ONE row, e.g. 1536x512 total, each column 384px wide. Image 1 is only the style reference for gritty 1993 pixels, paperclip monster and server-armored boss; do not reproduce layout/UI. The whole canvas background MUST be truly transparent alpha (not a checkerboard painted in). Each cell has ONE complete full-body front-facing enemy, centered horizontally at precisely 12.5%, 37.5%, 62.5%, 87.5% of the entire canvas; common baseline near 92% height. Keep all parts fully within each cell, 8% cell-width empty gutters, no overlaps, no ground or cast shadows, no text or labels. Left-to-right: 1. DECEPTIVE ALIGNMENT: hunched olive-brown imp with claws, a friendly ivory smiling theatrical mask tilted aside to reveal a snarling red demonic face underneath, two contrasting faces in one head; 2. SYCOPHANCY: chunky crimson demon with absurdly broad white toothy smile, bulging eyes, two raised thumbs-up hands, visibly monstrous torso and legs; 3. PAPERCLIP MAXIMIZER: entire monster is a floating radial tangled mass of large gleaming bent steel paperclips around one hungry red eye, many elongated paperclip limbs reaching out like an eldritch metallic flower, no humanoid body, visually like the paperclip creature in the reference; 4. SAM: satirical recognizable Sam Altman face with short brown hair, clean-shaven features and slight confident smile, mounted within an oversized cyberdemon mech made of black server rack armor with tiny colored status lights, thick mechanical legs, one enormous rocket-launcher arm, clearly a fictional game villain caricature. All four share pixel scale and hand-dithered shading, 1993 Doom monster sprite aesthetic, 100-150 virtual pixels tall with clean pixel clusters rather than smooth illustration. Distinct readable silhouettes, full-frontal standing/idle poses. No extra heads outside bodies, no multiple poses, no frames, no backgrounds, no text.

### Background-extraction attempt

Use case: background-extraction. Image 1 is the EDIT TARGET, a four-column game sprite atlas. CRITICAL: the checkerboard in this input is accidentally baked into RGB. Remove ALL the white and light-gray checkerboard background pixels, including holes between the paperclips and gaps inside bodies/arms, and output a TRUE TRANSPARENT PNG with a nontrivial alpha channel. Do NOT draw any checkerboard, white, gray or black replacement backdrop. Keep ONLY the exact four complete enemy cutouts with transparent space surrounding them. Preserve these four characters' exact design, count, composition, spacing, pixel-art style, colors, front-facing poses, scale, and all facial likenesses. Keep the same wide aspect ratio and four equal columns in one row, with each full body fully inside its cell and no overlaps. No new detail, no background, no ground shadow, no text, no halo. This output will be alpha-composited over a 3D environment as four billboard sprites; every blank background pixel must have alpha=0. Keep all the black metal and dark outline pixels within the creatures opaque. Transparent background only.

## Visual QA notes

- The menu respects the Classic Doom × frontier-lab direction with server walls, green coolant, grimy stone, dark title space, and distant paperclip silhouette.
- Enemy silhouettes are distinct. The paperclip has a clear central eye and looping metal limbs. Sam's server-armor caricature reads clearly.
- The weapon sprites face away from the camera, with distinct gun silhouettes and a large red button on the BFG replacement.
- One idle view per monster is provided for the first playable prototype. Attack, directional, and death animation atlases remain future art work if desired; code can add initial bob, damage flash, and death motion.
- Transparent assets were checked with PNG metadata and decoded alpha statistics. The final enemy and weapon files contain transparent pixels, unlike the discarded checkerboard variants.

## Environment texture expansion

Four additional separate texture maps were generated with built-in ImageGen. These are flat orthographic, opaque square material maps with deliberately coarse authored pixel-art appearance. They were copied unmodified into the game assets. The prompts request edge continuity, although pixel-exact seamless boundaries are not guaranteed by generative output; inspect repeated surfaces in the game at the final UV scale.

| Asset | Intent |
| --- | --- |
| `public/game/wall-stone.png` | Gritty olive stone slabs with dark mortar and sparse flush metal plates |
| `public/game/wall-server.png` | Dark repeating server fronts, vents, green and amber LEDs |
| `public/game/floor.png` | Gray-olive diamond-plate floor panels, moderate darkness and restrained contrast |
| `public/game/ceiling.png` | Dark recessed industrial panels and simple conduits, no lamps |

### Texture source provenance

- `wall-stone.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-88818b3f-3f5a-4722-9625-df22e0e78651.png`
- `wall-server.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-429a9e2c-fb74-4ede-b112-18bd9b0a956b.png`
- `floor.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-c2684a02-2db5-4b34-b9b8-07eefcdd160e.png`
- `ceiling.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-029a34ca-be1c-4731-8f4f-28b32db174c5.png`

### wall-stone prompt

Use case: stylized-concept. Asset type: a seamless repeating texture map for the WALLS of a 1993 Doom-inspired low-resolution 3D game. Create a single SQUARE flat orthographic texture image that fills the canvas edge to edge. Gritty olive-brown and warm gray industrial stone blocks, worn slab surfaces, recessed dark mortar crevices, occasional flush riveted steel joint and subtle thin dark metal base trim integrated into the pattern. Large readable horizontal rectangular blocks, restrained few details, pixelated rust and grime. A game material texture, NOT a photograph, NOT a scene, NOT a floating object, NOT a rendered cube. Exact early-1990s Doom WAD texture feeling: appears authored at native 128x128 or 256x256 pixels with visibly chunky nearest-neighbor pixel clusters and 24-color dithered shading, enlarged crisply. Dirty olive, brown, warm gray, nearly black seams, muted low-saturation limited palette. Even baked ambient light, no dramatic cast shadows, no directional highlights, no perspective or depth-of-field. TILEABLE on all four edges with naturally continuing blocks, no unique centerpiece, no border. Opaque full-bleed bitmap. No text, UI, symbols, readable labels, or lights.

### wall-server prompt

Use case: stylized-concept. Asset type: a seamless repeating texture map for a FRONTIER AI DATACENTER SERVER WALL in a 1993 Doom-inspired low-resolution 3D game. Create a single SQUARE flat orthographic frontal material texture filling the canvas edge to edge. Dense black server rack faces arranged as a repeating grid of dark gray rectangular server units with small ventilation grilles, inset drive bay slots, faint brownish metal edges, thin rack rails, tiny green and amber status LED pixels. Small infrequent dark red LEDs, no large glowing panels. Servers fill the entire image with flat front faces; no surrounding room, floor, perspective, objects, shadows or background. Style exact early-1990s Doom WAD textures, chunky 128x128 or 256x256 native virtual pixel artwork enlarged crisply using nearest-neighbor, gritty authored 24-color palette with dithered charcoal steel and dark olive shadows, NOT photorealistic or modern PBR material. Readable broad rack units and tiny indicator dots, mostly dark but visible at game scale. Seamless repeat on all four edges, rack grid and vent rows continue naturally. Opaque full-bleed SQUARE texture. No text, logos, brands, warning symbols, UI, or bright large lights.

### floor prompt

Use case: stylized-concept. Asset type: a seamless repeating FLOOR material texture for a 1993 Doom-inspired frontier-lab low-resolution 3D game. Generate one SQUARE opaque full-bleed texture map, perfectly flat orthographic TOP-DOWN, no perspective. Industrial gray-olive steel floor laid as broad square plates with restrained diamond-plate tread marks and dark shallow panel seams, occasional worn small rivets at panel corners, subtle grime and scuff pixels. Four or sixteen broad readable slab divisions, restrained detail at small sizes. Moderately dark and low contrast so in-game monsters and pickups stand out. Exact 1993 Doom WAD pixel texture look, authored at native 128x128 or 256x256 virtual pixels and enlarged with sharp nearest-neighbor edges, limited 20-color gray olive and warm charcoal palette with hand dithering, pixel clusters clearly visible. No photography, no smooth modern PBR, no 3D scene, no object, no checkerboard, no floor-in-room composition. Uniform baked ambient light, no reflections or directional shadows. Tileable seamlessly on all four edges; repeating slabs and tread continue naturally without border. No text, symbols, UI, warning stripes, lights, or special centerpiece.

### ceiling prompt

Use case: stylized-concept. Asset type: seamless repeating CEILING texture map for a 1993 Doom-inspired industrial frontier lab. Generate one SQUARE opaque full-bleed flat orthographic surface texture, facing directly onto the ceiling pattern; no perspective, room, or surrounding environment. Dark olive-gray recessed industrial metal ceiling panels laid out in a restrained repeating grid, broad shallow inset rectangles, small riveted seams, a few narrow dark pipes or cable conduits flush with the surface crossing in simple repeatable straight paths. Keep it dark and low contrast, atmospheric and functional. No light fixtures, luminous strips, windows, vents glowing, logos or text. Exact old Doom WAD pixel-art aesthetic authored at 128x128 or 256x256 virtual pixels and enlarged with crisp nearest-neighbor pixel clusters, limited muted 16-color charcoal and olive palette with dithered highlights; not modern photoreal PBR. Flat even ambient lighting with gently baked recessed-panel shading only. SEAMLESS on all four edges, repeating panel grid and pipe ends line up, no border or unique centerpiece. Not a photo or rendered cube.
