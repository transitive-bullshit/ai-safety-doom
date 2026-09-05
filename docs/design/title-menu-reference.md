# Title and menu reference

The title redesign follows the sparse presentation of the original Nintendo 64 game, while retaining P(DOOM)'s own logo, writing and desktop controls. The selected treatment uses a centered stone logo, a dark smoky background, bare ember-red option rows and a skull cursor. It replaces the previous left-aligned logo, story paragraphs, captions and bordered primary action.

## Original game evidence

- The original instruction booklet's **printed page 8** shows a dark main-menu scene with two compact choices, New Game and Options, red/orange lettering and a skull beside the selected choice. Its instructions describe opening the menu from the title or demo with Start, moving the skull with up/down, and selecting with A. The preceding printed page 7 contains the story separately. [Original Midway instruction booklet, PDF page 5](https://www.retrogames.cz/manualy/N64/Doom_64_-_Nintendo_64_-_Manual.pdf#page=5).
- **Printed pages 9–10** show similarly compact options and pause menus. The pause illustration retains the game scene behind the lettering and a short resume instruction. [Original booklet, PDF page 6](https://www.retrogames.cz/manualy/N64/Doom_64_-_Nintendo_64_-_Manual.pdf#page=6).
- The booklet cover uses the blue/gold packaging logo. It should not be confused with evidence about the in-game title presentation. [Original booklet cover](https://www.retrogames.cz/manualy/N64/Doom_64_-_Nintendo_64_-_Manual.pdf#page=1).

The booklet illustrations were inspected directly. An additional [Nintendo 64 title-screen record at MobyGames](https://www.mobygames.com/game/5195/doom-64/screenshots/n64/177388/) identifies a 640 × 480 capture contributed in 2006, but its full-resolution image was unavailable during this review; no palette or material claims above rely on it. The gray-stone P(DOOM) logo is the selected parody art direction, not a claim that the booklet uses that logo. See [title-art.md](./title-art.md) for the generated logo and skull provenance.

## Selected implementation direction

- Keep a centered 4:3 safe region within the desktop viewport. Place the monumental logo in a fixed header and the input hints in a fixed footer; vertically center each menu stack in the remaining space. The difficulty stack includes its choices, description, and Start action. Leave substantial empty darkness around the content.
- Rasterize Goldman Bold menu labels at 22 px with code-authored bevel and noise, then display at approximately 2× with pixelated scaling. Preserve semantic button text and accessible names beneath the visual layer.
- Use the skull as the persistent selection marker. Arrow keys change selection, Enter activates and Escape returns; mouse selection remains available. These desktop mappings adapt the booklet's controller menu behavior.
- Keep long premise text in the briefing and control explanations in their own screen. The title needs the logo, options and one quiet input hint.
- Suggested colors are design choices, not samples from the original game: near-black `#070708`, charcoal `#383b3b`, stone highlight `#a4a7a0`, ember text `#8b3026`, selected ember `#c45d43`, and bone `#b9aa83`.

Goldman's broad angular forms provide the letter skeleton. The bitmap surface treatment supplies the coarse carved appearance. Goldman is a contemporary substitute, not Doom 64's original font. A separately authored uppercase glyph atlas remains an option if later menus require stronger pixel-level consistency.

## Font provenance and license

- **Bundled file:** `public/fonts/goldman-bold.ttf`.
- **Local source:** `/Library/Fonts/Goldman-Bold.ttf`, copied without modifying or subsetting the font on 2026-09-05.
- **Embedded metadata:** family Goldman, style Bold, designer Jaikishan Patel, version `1.000; ttfautohint (v1.8.3)`.
- **Copyright:** Copyright 2018 The Goldman Project Authors (`https://github.com/magictype/goldman`).
- **License:** SIL Open Font License 1.1. The complete upstream license and copyright notice are bundled unmodified as `public/fonts/OFL-Goldman.txt`.

The [official Google Fonts Goldman directory](https://github.com/google/fonts/tree/main/ofl/goldman) contains the Bold font and its license. Its [family metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/goldman/METADATA.pb) confirms the designer, Bold weight 700, copyright and OFL license; these agree with the installed font's name-table metadata. The bundled license was retrieved directly from [Google Fonts' OFL.txt](https://raw.githubusercontent.com/google/fonts/main/ofl/goldman/OFL.txt) on 2026-09-05. The original project is [magictype/goldman](https://github.com/magictype/goldman).

SHA-256 of the copied font:

```text
3d875bc02d79dff86369ada5b4c4d8c1b7b184bc70a322b651aa5c39693631e3
```

SHA-256 of the bundled upstream license:

```text
bb7828b16438c97ca84b53e2fbd2c3bd9dcf2a86ccda6806ec9ae955a1814d29
```
