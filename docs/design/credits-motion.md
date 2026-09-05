# Credits roll

The user explicitly requested a bottom-to-top credit sequence, then asked for substantially faster playback. This occasional cinematic screen uses a brisk, continuous roll; the menus remain instant.

- `requestAnimationFrame` advances native `scrollTop` linearly at 75 CSS pixels per second (2.5 times the original speed). Native scrolling lets the same area support a real scrollbar. The first title is visible at the bottom immediately; the last credit holds for three seconds before looping.
- A `ResizeObserver` sizes the opening space from the viewport. Fractional progress and the browser's last written scroll position stay in refs, so frames do not rerender React. The animation stops while paused or under reduced motion, and elapsed time is capped to avoid a jump after a hidden tab.
- Space toggles Pause/Resume once per press, even on a focused footer button. Wheel, scrollbar, and scrolling-key input interrupt playback immediately. Resuming continues from the current reading position. Native scroll changes are compared with the last programmatic write before advancing, so a manual scroll is never overwritten.
- Hovering or focusing the reading area does not interrupt playback. Separate Pause/Resume, Replay, Source and Return controls stay still below the roll. Replay resets to the beginning without disturbing the pause state.
- Travis Fischer's name and its 16px vertical / 28px horizontal padding link to `https://x.com/transitive_bs` in a new tab. Keyboard focus reveals and pauses the credit for activation; hovering alone continues the roll.
- Reduced motion uses a static, keyboard-scrollable credit list. The native dialog supports Escape and returns focus to its opener.
- All lettering uses the same Console Display font and rasterized ember headings as the game HUD/menu.

Feel-check the opening title visibility, reading speed, and fixed controls at both desktop viewport sizes. Browser tests measure movement while hovering, Space repeat suppression, wheel and actual scrollbar interruption, resuming in place, padded-link navigation, replay, focus restoration, layout bounds, and reduced-motion scrolling without matching editorial prose. Scrollbar tests disable Headless Chrome's default `--hide-scrollbars` argument.
