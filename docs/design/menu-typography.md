# Menu typography and first paint

The original title showed ordinary fallback text before replacing it with a differently sized bitmap after the font loaded and React hydrated. The cold-load reproduction measured the Start label changing from 475.84 × 51 to 518.83 × 58.66 CSS pixels. A failed font request also produced a permanently incorrect raster.

The title's three initial labels now arrive as embedded PNGs in `components/game/title-bitmaps.json`. They were captured from the existing, unchanged `ConsoleText` canvas painter in Chrome 152: Goldman Bold at 22px, a 32px-high bitmap, and width equal to the rounded text advance plus 8px. Their original dimensions and pixels are preserved. Other labels still use that painter after a successful font load; failed or empty loads retain readable text.

`app/console-font.css` embeds `public/fonts/goldman-bold.ttf` byte for byte as a base64 data URL. This moves the existing font into the initial stylesheet and removes a separate font request. There is no font conversion or new typeface. The original SIL Open Font License remains at `public/fonts/OFL-Goldman.txt`.

## Regenerating the assets

If the font, painter, or initial menu copy changes, regenerate the initial label map from the current renderer. In a local working copy, temporarily replace `title-bitmaps.json` with `{}` so the title uses its canvas path, run `pnpm dev`, and open the main menu. After the font has loaded, evaluate the following in the browser console and save the returned JSON to `title-bitmaps.json`:

```js
JSON.stringify(
  Object.fromEntries(
    [...document.querySelectorAll('.console-menu .console-item')].map(
      (item) => {
        const canvas = item.querySelector('canvas')
        return [
          item.querySelector('.sr-only').textContent,
          {
            width: canvas.width,
            height: canvas.height,
            uri: canvas.toDataURL()
          }
        ]
      }
    )
  ),
  null,
  2
)
```

Restore the generated map before building or committing. If the source TTF changed, replace only the base64 payload in `app/console-font.css` with `readFileSync('public/fonts/goldman-bold.ttf').toString('base64')`, retaining its font-face declarations and license comment.

Run `pnpm e2e tests/menu-font.spec.ts tests/title.spec.ts`. The focused regression holds hydration scripts, delays font traffic, rejects font promises, and verifies that the console greeting runs once per document. It tests first-paint geometry and readable fallback behavior without baking menu copy into expectations.
