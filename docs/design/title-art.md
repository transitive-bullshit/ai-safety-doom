# Nintendo 64-inspired P(DOOM) title art

The title-screen redesign uses a new raster logo with exact lettering **P(DOOM)**. Its carved angular stone faces, dark metal extrusion, coarse surface detail, and restrained rust accents follow the requested 1997 Doom 64 direction. This is newly generated parody lettering, not an extracted original game logo.

## Production asset

- Workspace file: `public/game/pdoom-logo-n64.png`
- Dimensions: **2172 × 724 pixels**, exactly **3:1**
- Format: 8-bit sRGB RGBA PNG with a genuine alpha channel
- File size: 2,551,507 bytes
- Generation: built-in ImageGen, one selected generation, no CLI fallback
- Original source: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-2ed51b5e-f32d-4da3-9dec-0e9bd78970a0.png`
- The selected source was copied unmodified into the project. No programmatic pixel editing, background removal, recoloring, or cropping was used.
- No reference bitmap was attached to the generation; the prompt describes the user-approved material and era.

## Visual and transparency verification

The seven required characters read **P(DOOM)** on a single line. Both parentheses are visible, the P uses the same material, and DOOM occupies most of the width. There is no 64 suffix, subtitle, extra icon, scene, or webpage mockup.

Decoded pixels have alpha values from 0 through 255. There are 486,929 fully transparent pixels, approximately 30.96% of the canvas. All four corner samples, exterior-gap samples, and samples inside P, D, and both O holes have alpha 0.

The principal artwork at alpha greater than 128 occupies inclusive bounds `x=17…2153, y=32…694`, or `[17, 32, 2137, 663]` as an x/y/width/height rectangle. This leaves small gutters around the visible logo. At alpha greater than 70, its bottom reaches y=695. Very faint edge/shadow pixels extend to the last image row; there is no opaque background rectangle.

The logo has dark extruded faces and lighter upper bevels for use against the dark title background. Preserve its alpha when displaying it and scale with its native aspect ratio. Runtime scaling and placement belong to the title-screen implementation.

## Final prompt

```text
Use case: logo-brand
Asset type: production transparent raster title logo for a late-1990s Nintendo 64 horror FPS title screen.
Primary request: create only one horizontal logo reading exactly "P(DOOM)" on a genuinely transparent background with a real alpha channel. This is a chiseled stone-and-tarnished-metal title emblem in the visual spirit of the 1997 Doom 64 title, with a gritty pre-rendered bitmap appearance.
Text (verbatim): "P(DOOM)" — seven characters: P, opening parenthesis, D, O, O, M, closing parenthesis. All seven characters must be clear, connected by one consistent monumental material style, on a single line. The DOOM word is dominant. The P and parentheses remain substantial and unmistakable, with the parentheses individually legible.
Composition/framing: very wide horizontal canvas approximately 3:1, logo fills nearly the full canvas, minimal even transparent gutters, complete letters and extrusion fully inside the image, straight-on typography with a slight visible downward extrusion. No scene or presentation mockup.
Style/medium: authentic 1997 prerendered game-title bitmap; huge angular block letterforms with thick carved bevels, chunky low-resolution surface detail, rough gray-brown stone faces, dark gunmetal extrusion, scars and tiny chips. O letters are squared-off angular holes, not rounded modern geometric font. Heavy dark bevels emphasize the letter forms. Light gray highlights along upper carved edges and a little oxidized rusty red confined to crevices. Muted charcoal, slate-gray stone, tarnished metal.
Lighting/mood: severe, ominous, dimly top-lit but readable against a dark game menu, no luminous bloom.
Constraints: preserve genuine transparent negative space outside letters AND inside letter holes. The background is alpha=0, not a checkerboard illustration. No baked rectangle, background gradient, floor, ambient shadow on a background, fog, smoke, scenery, creatures, extra ornament, emblem, "64", subtitle, slogan, watermark, border, or extra text. Not 1993 gold-and-blue Doom lettering; no neon, smooth vector outlines, modern chrome shine, glossy web branding or flat font. Output the isolated logo asset, not a screenshot of a page.
```

## Skull menu cursor

A matching front-facing skull was generated as a separate cursor asset. Broad bone features, deep sockets, small ember eyes, and coarse pixel clusters keep its silhouette readable in the small menu slot. The optional spectacles were omitted to preserve clarity. The title logo was not changed.

- Workspace file: `public/game/menu-skull-n64.png`
- Dimensions: **1254 × 1254 pixels**
- Format: 8-bit sRGB RGBA PNG, alpha 0–255
- File size: 842,636 bytes
- Fully transparent pixels: 873,390, or **55.54%**
- Main artwork bounds at alpha greater than 128: `[213, 72, 831, 1100]`
- At a 32 × 32px image box, those bounds occupy approximately 21 × 28px; use the original square aspect ratio.
- All four corners and four exterior-gap alpha samples were 0.
- Generated with built-in ImageGen, then copied unmodified; no programmatic pixel editing or CLI fallback.
- Original source: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-a085e2e3-8779-46b4-acd7-273cb500e724.png`

### Final skull prompt

```text
Use case: stylized-concept
Asset type: production raster skull cursor for a 1997 Nintendo 64-style horror FPS menu.
Primary request: a single front-facing skull, isolated on a genuinely transparent alpha background, designed to remain instantly legible at 32 pixels tall.
Subject: a squat, ominous carved-bone human skull, heavy brow, deep eye sockets with two tiny restrained ember-red eye points, clear broad nasal cavity and four or five chunky tooth shapes. No lower neck. Symmetrical frontal view.
Style/medium: dark Doom 64-era pre-rendered game sprite, rendered as deliberate coarse pixel clusters with roughly 32-to-48-pixel native visual detail enlarged without smoothing. Weathered gray ivory bone, warm charcoal shadows, restrained upper-left stone highlights. Strong solid silhouette, broad simple feature shapes. Serious ominous horror-game art, not a cartoon emoji.
Composition/framing: one skull centered in a square canvas, skull occupies about 70% of width and 76% of height, generous clear transparent margins on every side. Full skull must be inside frame, completely separated from canvas edges.
Constraints: true transparent background with alpha=0 outside the skull and inside open negative space. No illustrated checkerboard, backdrop, gradient, ground shadow, frame, logo, letters, text, extra objects, crossbones, horns, flames, smoke, jewelry, glasses, or multiple skulls. No shiny modern icon rendering, neon glow or soft photographic blur. This is the isolated game cursor asset, not a menu screenshot.
```
