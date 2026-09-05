# Doom 64: Staging Area reference notes

Research and asset production for the user-approved shift toward the opening level of Doom 64 on Nintendo 64. The AI-safety parody, four weapons, researcher portrait, and boss remain the project's content direction.

## Evidence inspected

- [Original-console Staging Area first-person start capture](https://classicdoom.com/d64maps/01-f.jpg), inspected visually at full resolution.
- [Staging Area full automap artifact](https://classicdoom.com/d64maps/01-m1.gif), inspected visually. The [archive's method notes](https://classicdoom.com/d64maps.htm) explain that the green arrow marks player start/heading and that changing geometry is generally shown at its first encounter.
- [Original Doom 64 instruction booklet scan](https://www.retrogames.cz/manualy/N64/Doom_64_-_Nintendo_64_-_Manual.pdf), printed pages 5–8 inspected from PDF image renders.
- [First-hand 2003 interview with original level designers Timothy Heydelaar and Randy Estrella](https://www.firebrandx.com/doom64interview.html).
- [Composer Aubrey Hodges's official Doom 64 soundtrack release](https://aubreyhodges.bandcamp.com/album/doom-64-official-soundtrack).

The game capture and map are original-game visual artifacts hosted by an archive; the archive is not the developer. Designer recollections and the composer's release are first-hand sources. Secondary walkthroughs were useful search leads but are not the foundation of the design claims below.

## Opening composition

The start capture shows a broad elevated floor lip looking into an enclosed, double-height rectangular chamber. Tall brown wall panels have dark vertical supports and a horizontal structural band. The center of the far wall contains a recessed hatch-like feature. The roof has a jagged rectangular opening: cool gray concrete borders a small dark blue/violet sky patch, with additional concrete crosspieces lower in the view. The foreground floor uses diagonally arranged, riveted brown-gray plates. The opening is predominantly enclosed architecture, not a fully open courtyard. These are visual observations, not measurements from original map data. [Start capture](https://classicdoom.com/d64maps/01-f.jpg)

The image is very dark, but the player can read the floor lip, far wall, and skylight. Brown/rust occupies most of the view; cool gray and tiny dark blue accents establish depth. Stronger black ceiling recesses make the room feel tall. An adaptation should preserve those contrast relationships while raising visibility enough for browser play. This last sentence is a design recommendation. [Start capture](https://classicdoom.com/d64maps/01-f.jpg)

## Plan geometry and navigation

The automap places the start near the south end, facing north. The spawn platform is a wide shallow rectangle; a narrower room lies immediately north. Behind spawn, a small southern space narrows through a neck into another compartment. West of the initial chamber is an offset horizontal corridor feeding a northward route. The central-west portion is an irregular hub with branches. A tight, rectilinear maze occupies the northwest. A large southeastern room has clipped corners and an eastern exit-like annex. There are curved or octagonal connector outlines and a distinct polygonal space in the northeast. [Automap artifact](https://classicdoom.com/d64maps/01-m1.gif)

These outlines establish plan shape, not floor heights. Small nested squares near the starting chamber must not automatically become floor pillars: they may describe ceiling/sector detail. Door timing, lifts, and changing walls cannot be fully recovered from this still. The archive explicitly warns that some geometry changes with player actions. [Archive method notes](https://classicdoom.com/d64maps.htm)

### Recommended adaptation

This is a proposed layout for the parody, not an exact transcription:

1. Start on a broad raised platform under a low dark ceiling lip.
2. Show the lower chamber, framed roof aperture, and far-wall hatch immediately.
3. Put the first weapon and one readable risk creature below, so stepping off the platform commits the player to the encounter.
4. Turn the route west into a bent corridor. Introduce the first door as a substantial inset threshold.
5. Reconnect a side gallery to an earlier sightline, creating a recognizable landmark instead of a chain of isolated square rooms.
6. Use a tighter northern service wing for optional discoveries.
7. Place the required Sam encounter in a wider room with clipped corners and a small shutdown annex beyond it.

Keep a visible route between elevations and place the floor transition in the initial field of view. Use low walls, ledges, short stairs, and raised galleries only where their geometry is navigable by the implemented collision model.

## Lighting, materials, and HUD implications

The original designers describe separate floor and ceiling color values producing gradients, with possible additional wall control. They also describe custom trigger scripting that could combine multiple actions. This supports treating color and moving architecture as part of level identity, rather than adding illumination only through isolated neon props. [Designer interview, questions 17 and 19](https://www.firebrandx.com/doom64interview.html)

Recommended browser translation: brown and dark rusty utility panels, cool desaturated roof edges, local muted red or blue areas, restrained emissive signage, and a darker ceiling than floor. Keep AI lab server details in selected surfaces so the parody remains legible without making every room luminous.

The original booklet shows explicit strafe, run, use, map, pause/menu, and weapon-change controls. It says use activates switches and doors; its main-menu illustration has a skull selection marker. Preserve the project's desktop bindings while retaining these action concepts. [Instruction booklet, printed pages 5–8](https://www.retrogames.cz/manualy/N64/Doom_64_-_Nintendo_64_-_Manual.pdf)

The researcher portrait is an intentional parody element inherited from this project's accepted design. It need not claim to duplicate Doom 64's interface.

## Sound mood

Hodges's official release names Staging Area's piece “The Madness (Level - Staging Area).” He describes the N64 score as an opportunity for longer, more complex tracks using combinations of sample textures; the release is tagged ambient, dark ambient, and horror. [Composer's official soundtrack](https://aubreyhodges.bandcamp.com/album/doom-64-official-soundtrack)

Recommended original sound design: slow low drones, filtered air, widely spaced metallic/industrial events, and distant unsettling textures beneath weapon and enemy cues. Avoid a continuous energetic riff for this direction. These are production interpretations of the stated mood, not a transcription or a claim that the full track was auditioned during this research.

## New production assets

Generated with built-in ImageGen and copied into the project without altering pixels. All earlier assets are preserved.

| Asset | Dimensions | Intended use |
| --- | --- | --- |
| `public/game/d64-sky.png` | 1774 × 887 | Very dark violet/black cloud panorama visible through openings |
| `public/game/d64-wall.png` | 1254 × 1254 | Broad battered brown-gray concrete panels with restrained metal seams |
| `public/game/d64-trim.png` | 1254 × 1254 | Dark rust utility panels, recessed circuit grooves, heavy structural trim |

The sky prompt requested 3:1; the generator returned 2:1. It remains suitable for a horizontally wrapped backdrop. Both wall textures use broad readable panel divisions and subdued values. Seamlessness was requested, but exact opposite-edge pixel equality is not guaranteed; inspect repetition at the renderer's final UV scale.

These are newly generated interpretations of the observed material family, not ripped Doom 64 textures. The sky's cloud composition is an art direction choice, not evidence that the original sky used this exact pattern.

### Original generated file provenance

- `d64-sky.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-db22141a-3d15-431c-8f66-ac27c3cacb02.png`
- `d64-wall.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-a5b10d55-b013-4511-9032-f92fd34d58a3.png`
- `d64-trim.png`: `/Users/tfischer/.codex/generated_images/01a06ef7-2737-7393-9db5-7f1dd6e4b935/exec-ab7edc7d-8e4a-407e-a32c-f17ff3c839d6.png`

## Image-generation prompts

### d64-sky

Use case: stylized-concept. Asset type: a horizontally wrapping sky texture for a Doom 64 (Nintendo 64, 1997)-inspired first-person game. Generate a wide 3:1 panorama, filled ONLY with very dark turbulent alien night-cloud atmosphere. Dense nearly black cloud masses and restrained deep dusty violet/indigo cloud edges, a subtle few tiny dull blue-violet star-like flecks in the darkest openings. Claustrophobic and ominous, no clear bright horizon, no brightly lit nebula or saturated neon. Texture aesthetic: the softly pixelated, grainy, pre-rendered 1997 Nintendo 64 dark-horror sky material, as though a 256x128 source bitmap had been enlarged; broad cloudy shapes with fine retro dithering, no hard geometric pixel mosaic, no smooth modern digital painting. Cloud motion should feel lateral and slow. LEFT AND RIGHT EDGES MUST JOIN to form a seamless horizontal repeat; match brightness and cloud continuity across those edges. No ground, buildings, cliffs, moon, planets, lightning, sun, words, borders, UI, or weapons. Flat full-bleed opaque texture. Most image values are very dark; violet is an accent in the clouds, never bright magenta.

### d64-wall

Use case: stylized-concept. Asset type: flat wall texture for a Doom 64 (Nintendo 64, 1997)-inspired industrial military base. Generate a SQUARE full-bleed opaque texture map, viewed perfectly orthographically head-on. Battered warm gray-brown concrete-faced industrial wall panels with dark rust metal support seams: four broad rectangular concrete panels separated by restrained thin horizontal and vertical dark structural bands. Subtle grime, scuffed edges, small pits, brown stains, fine low-resolution mottling. The panels are broad and heavy, not small masonry bricks, cobbles or medieval stone. Overall muddy brown/taupe/dark gray, low saturation, no green neon, no luminous elements. Exact late-1990s N64 Doom64 material mood: grainy softly pixelated pre-rendered 64x64 or 128x128 texture appearance enlarged; broad murky forms and small dithered detail, not modern photographic PBR and not a crisp colorful cartoon. Flat ambient light, no dramatic directional shadows. Repeating seam grid designed to connect at all four edges, no decorative frame. This is ONLY a flat tileable surface texture, not a wall in a room, no perspective, floor, ceiling, object, text, labels, logos, UI, symbols or lights.

### d64-trim

Use case: stylized-concept. Asset type: square flat repeatable utility-panel/trim texture for a Doom 64 Nintendo 64 1997-style military techbase. Generate a SQUARE full-bleed opaque flat material texture, viewed perfectly orthographically front-on. Dark rust-brown iron paneling with broad recessed rectangular panels, worn heavy vertical framing bars, riveted horizontal cross-band, narrow shadowed cable conduits and restrained intricate circuit utility grooves inside one or two recessed strips. Everything is flush to the surface. Mostly blackened brown metal, near-black recesses, muted gray worn edges, very dark brick-red rusty stains, no glowing LEDs and no modern logos. Four broad readable panel sections with strong simple frame geometry, sparse secondary mechanical detail. Late-1990s Doom64 pre-rendered grainy low-resolution material feeling, slightly soft pixel texture as if a 128x128 N64 bitmap were enlarged; no photograph, no modern PBR sheen, no cartoon. Even dim ambient light, no perspective, no room or freestanding object. A seamless repeating panel grid whose four image edges can tile; no unique centerpiece, no text, symbols, labels, UI or border.

## Verification limits

The reference checks cover an original-game start screenshot, a full static automap, selected relevant manual pages, first-hand designer comments, and the composer's release description. This is enough to specify a closer opening composition, palette, and mood. It does not establish original sector dimensions, step heights, movement constants, exact triggers, or a full playable reconstruction. Those must remain explicit design choices unless original map data or a complete verified playthrough is examined later.
