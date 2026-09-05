# Training audio

The score, menu mechanisms, and most combat effects use original Web Audio synthesis. System Prompt uses a short recorded report; RLHF uses a recorded shotgun blast and pump. Player injury/death and the boss death cry use recorded human vocals. The three other monster deaths use original Doom recordings, with coarse, filtered organic and industrial textures for awareness and attack. The score remains original; no Doom or Doom 64 music is bundled.

## Sam boss death replacement

The former Baron WAV decoded correctly and exactly matched the original shareware recording, but its processed 8-bit sound was too abrasive. `doom-baron-death.wav` now contains a separate HaelDB vocal take, trimmed to its sustained yell and natural tail, lowered to 0.82× pitch, and rendered as 44.1 kHz mono 16-bit PCM. Moderate filtering, EQ, compression, limiting, and fades retain vocal texture without bitcrushing, extra distortion, or synthetic layering. Its 1.78-second cry plays completely through the existing Sam gain and room routing. The other eight WAV assets are unchanged. [Source and reproducible recipe](../../public/game/audio/README.md#sam-boss-death-recording).

## Plasma, shutdown, and pickup refinement

Mechanistic Interpretability now has an immediate electrical crack, a saturated midrange body held for 32 ms, a coarse electrical resonance, a low punch, and a brief delayed arc. The five source layers finish within 100 ms, before the weapon's next 110 ms shot. The small room sends preserve space without extending the dry pulse into a continuous drone. The firing cadence, projectile, ammunition consumption, and shared mix remain unchanged.

The Big Fuckin' Shutdown Button retains its 720 ms windup. Its charging motor and filtered current rise in pitch and level, then hold near peak until 705 ms, with three increasingly strong arcs across the buildup. Release delivers an immediate crack, a blast body held for 260 ms and decaying over 1.2 seconds, descending sub-impact, coarse reactor resonance, and electrical aftershocks. The longest dry layer clears before the next permitted 1.65-second shot. This changes presentation only; charge timing, projectile, ammunition cost, and damage are unchanged.

The discharge also layers the existing `system-prompt-pistol.wav` at **0.58× playback rate**, with a 3.2 kHz low-pass, gain 1.2, and room send 0.28. Its source remains the same CC0 michorvath recording documented in [the pistol provenance](../../public/game/audio/README.md#system-prompt-pistol-report). The slowed impulse is a runtime treatment of an already loaded buffer; no separate file, download, or Doom recording was added. The normal System Prompt shot still plays its unchanged buffer at native rate. If that optional buffer is missing, the synthetic shutdown layers still play.

Touch Grass now uses a firm medical pressure seal, a descending pressure hiss, a steady low hum, and a final seated latch. Relief comes from the settled hum and pressure release, without a playful rising tune. Training Data uses a cartridge slam, coarse receiver resonance, a separate ratchet, and locking impact. The three ammunition pools vary the resonance register. Guardrails and weapon acquisition retain their existing cues. All layers use the existing compressor, room routing, 64-voice limit, mute/pause behavior, and complete node cleanup.

### Current render verification

Chrome `OfflineAudioContext` produced **34 before/after renders at 48 kHz stereo**: single and sustained plasma; shutdown charge, discharge, and full cycle; health and all three ammunition pools; armor; a dense combat mix; and preservation references for pistol, shotgun, player pain/death, all four monster deaths, and music. The renderer consumes a sorted event queue and checks actual dispatch count against the intended schedule, avoiding repeated events at floating-point time boundaries. Sustained plasma dispatches exactly 34 shots at 110 ms intervals. The 16-second combat mix dispatches 186 events, including 108 plasma shots, simultaneous enemy lifecycles, shutdown charges and blasts, explosions, pickups, doors, player vocals, and score.

| Measurement | Before | After |
| --- | --: | --: |
| Isolated plasma peak | 0.147036 | 0.489854 |
| Plasma attack RMS, first 15 ms | 0.022460 | 0.124132 |
| Plasma body RMS, 15–60 ms | 0.018579 | 0.078532 |
| Sustained plasma peak | 0.197235 | 0.582316 |
| Late charge RMS, 500–680 ms into windup | 0.000151 | 0.145761 |
| Isolated shutdown discharge peak | 0.567481 | 0.756736 |
| Shutdown sustained RMS, 100–350 ms after release | 0.104166 | 0.216421 |
| Full charge/discharge peak | 0.651651 | 0.734195 |
| Health pickup peak | 0.114430 | 0.185285 |
| Ammunition pickup peaks, three pools | 0.107430–0.143782 | 0.193350–0.305363 |
| Dense combat peak | 0.762218 | 0.849368 |
| Dense combat headroom | 2.36 dB | 1.42 dB |

Plasma attack energy increases 14.85 dB and body energy 12.52 dB. Its sustained-fire render retains 4.70 dB peak headroom. Shutdown now remains audible through the end of its windup, and its discharge has 6.35 dB more sustained energy over 100–350 ms. All renders contain finite samples, no clipping, and no browser audio errors. Every dispatch count matches the intended event count.

All nine recorded WAV hashes remain unchanged. Isolated pistol and monster-death PCM output is identical before/after. Shotgun, player vocals, armor, and music differ by at most one 16-bit PCM step in a small number of rendered samples, consistent with browser numerical rounding. These are signal and scheduling checks, not a perceptual listening assessment.

The combined suite has **85 passing unit tests**, with TypeScript, focused audio lint, and test formatting also passing. Two new plasma cases cover held body, delayed arc, cadence cleanup, compressed routing, pathological overlap limits, mute, pause/resume, and disposal. Existing shutdown checks now also require charge level to persist through the windup and verify the slowed impulse's full pitch-adjusted duration. Evidence: `/private/tmp/pdoom-plasma-pulse-audition/measurements.json`, adjacent before/after WAVs and source snapshots, and `/private/tmp/pdoom-render-plasma-pulse.mjs`.

## Recorded System Prompt

System Prompt now plays `system-prompt-pistol.wav`, a 310 ms, mono, 44.1 kHz, 16-bit PCM report adapted directly from the preserved CC0 michorvath 20-gauge recording. This is a fictional pistol sound-design adaptation of a shotgun impulse, not a real pistol recording. It uses none of the existing RLHF sample or its pump. An 8% pitch rise, body/presence EQ, compression, mild soft saturation, and a short fade give the opening crack a sustained body. [Provenance, hashes, signal measurements, and the reproducible processing recipe](../../public/game/audio/README.md#system-prompt-pistol-report).

The runtime plays one buffer at native rate, with gain 1.05 and room send 0.11 through the existing compressor. At the pistol's 280 ms firing interval, only the final 30 ms of a report overlaps the next; that portion of the asset is −33.21 dBFS RMS. The first shot uses the silently preloaded buffer. A missing recording uses a heavier, locally saturated noise report, low impact, and delayed mechanical tick without affecting the other prepared assets. Natural completion, voice stealing, pause/mute, and disposal use the same lifecycle as the shotgun.

### Preceding pistol/shutdown pass measurements

The preceding pass added the recorded pistol and an earlier shutdown discharge with a 140 ms held body and 880 ms longest layer. The current charge/discharge design and 1.2-second tail are documented above. Both passes kept the existing ammunition cost, projectile, damage, shared gain, player vocals, shotgun, and music settings.

Chrome `OfflineAudioContext` rendered 18 before/after comparisons at 48 kHz stereo, covering the pistol recording and fallback, shutdown, rapid pistol fire, dense combat, isolated shotgun, player pain/death, and music. Attack RMS measures the first 40 ms; body RMS measures 40–150 ms; sustained RMS measures 100–350 ms after discharge.

| Measurement              |   Before |    After |
| ------------------------ | -------: | -------: |
| Isolated pistol peak     | 0.215939 | 0.428943 |
| Pistol attack RMS        | 0.051791 | 0.133919 |
| Pistol body RMS          | 0.006746 | 0.173268 |
| Rapid pistol render peak | 0.278759 | 0.599617 |
| Shutdown peak            | 0.395239 | 0.567481 |
| Shutdown body RMS        | 0.068832 | 0.180179 |
| Shutdown sustained RMS   | 0.022141 | 0.104166 |
| Dense combat peak        | 0.700298 | 0.786878 |
| Dense combat headroom    |  3.09 dB |  2.08 dB |

The recorded pistol attack gains 8.25 dB and its body gains 28.19 dB over the former short synthesized cue. Shutdown body gains 8.36 dB, with 13.45 dB more sustained energy in the 100–350 ms window. All renders have finite output, no clipped samples, and no browser audio errors. Player pain/death render PCM is exactly unchanged; isolated shotgun and music retain identical peaks, with at most one 16-bit PCM step of browser rounding difference in 10 and 74 samples respectively. All eight pre-existing WAV hashes remain unchanged. These are waveform and scheduling checks, not a perceptual listening review.

Evidence: `/private/tmp/pdoom-heavy-weapons-audition/measurements.json`, before/after WAVs and bundled source in that directory, and renderer `/private/tmp/pdoom-render-heavy-weapons.mjs`. That temporary renderer could repeat some sustained-fire events at floating-point time boundaries; its overlap headroom checks are conservative, and isolated comparisons are unaffected. The current 34-render verification above corrects that scheduler and validates exact dispatch counts. Five additional audio tests covered first pistol playback, independent fallback, cadence overlap, mute/pause/resume, held shutdown body, delayed aftershocks, compressed reflections, voice bounds, and node cleanup. At that stage, 83 unit tests and TypeScript checks passed.

## Recorded RLHF shotgun

The firing sound combines [michorvath’s CC0 20-gauge shotgun recording](https://freesound.org/people/michorvath/sounds/427595/) with [SpringySpringo’s CC0 shotgun mechanism recording](https://opengameart.org/content/gun-reload-sounds). It has a dense, ragged report, a lowered pitch, and a prominent physical pump. The mechanical source is an airsoft recording, as identified by its creator. Source downloads, hashes, processing parameters, and license links are preserved in [the audio asset notes](../../public/game/audio/README.md). “Human feedback. At close range.” remains the weapon’s pickup line.

`public/game/audio/rlhf-shotgun.wav` is mono 44.1 kHz, 16-bit PCM, 76,812 bytes, and 0.87 seconds long. The blast is trimmed to its attack, lowered in pitch, equalized, and compressed. The pump begins 320 ms into the sample. The combined asset has a 0.9 peak ceiling; its runtime gain and short room reflection pass through the existing mix compressor. The weapon’s weight comes from sustained recorded energy, without changing the music or global output level.

`loadGameAudioAssets()` fetches and decodes with an `OfflineAudioContext`, concurrently with the texture preload during difficulty selection. It creates no live output graph or sound. `createGameRuntime()` receives the decoded buffers before allowing entry, so the first actual shot uses its recording immediately. A failed response, timeout, or unsupported/corrupt audio falls back to synthesis without failing the level load; a later run can retry. Each file fetch is bounded to 3.5 seconds. All nine files—the pistol, shotgun, three player vocals, and four Doom monster deaths—load independently in parallel, so a failure cannot discard the other recordings or multiply the loading delay.

Each shot owns one `AudioBufferSourceNode` and uses the existing bounded voice pool. Sample playback, its gain, panner, and room send disconnect together when the shot ends, is stolen by the voice limit, or the runtime is disposed. Pause suspends the audio clock, preserving the pump timing; resume does not repeat the attack. Mute continues to control the shared output. Returning to the menu discards the runtime’s sample reference along with the other game resources.

Audio unit tests cover silent preload, network/status/decode failure and successful retry, first-shot buffer use, distinct pickup and enemy cues, compressor routing, voice limits, pause, and full node cleanup. TypeScript, formatting, and lint pass.

Chrome `OfflineAudioContext` rendered eight-second 48 kHz stereo comparisons of the previous synthesis and the integrated recording, with identical score/ambience seeds and firing schedules. The crowded test adds a nearby explosion, Sam vocalization, and player impact simultaneously with the third shot.

| Measurement | Previous synthesis | Recorded shotgun |
| --- | --: | --: |
| Isolated peak amplitude | 0.555 | 0.468 |
| Attack RMS, first 60 ms | 0.145 | 0.205 |
| Body RMS, next 140 ms | 0.039 | 0.179 |
| Rack/body RMS, 300–530 ms | 0.016 | 0.101 |
| Peak with score and simultaneous combat effects | 0.603 | 0.644 |

The recorded version has about 4.6 times the prior body RMS and 6.5 times the rack/body-window RMS. Its crowded mix retains 3.8 dB peak headroom. All samples were finite, with zero clipped samples and no Web Audio errors. The music and ambience reference peak remained 0.095 in both versions. These waveform checks verify presence and headroom; they are not a perceptual listening review. Local audition files and JSON measurements are at `/private/tmp/pdoom-recorded-shotgun-audition/`, with the renderer at `/private/tmp/pdoom-render-recorded-shotgun.mjs`.

## Recorded player pain and death

Two pain grunts and a separate death yell come from [HaelDB’s CC0 Male Grunt/Yelling sounds](https://opengameart.org/content/male-gruntyelling-sounds). These are actual human recordings, played at their natural pitch. The originals, exact excerpts, processing recipe, licenses, and checksums are in [the audio asset notes](../../public/game/audio/README.md).

| Runtime buffer | File                | Duration | Playback gain |
| -------------- | ------------------- | -------: | ------------: |
| `playerPain1`  | `player-pain-1.wav` |  0.430 s |          0.95 |
| `playerPain2`  | `player-pain-2.wav` |  0.465 s |          0.95 |
| `playerDeath`  | `player-death.wav`  |  1.471 s |          1.10 |

All three use a 75 Hz high-pass, 5.2 kHz low-pass, centered dry voice, and a modest room send of 0.14 before the existing compressor. No pitch modulation or additional vocal distortion is applied at runtime. The first injury uses an already decoded recording. Surviving injuries alternate grunts, with a minimum 500 ms cooldown and at least 35 ms clearance after the previous buffer. A missing pain variant uses the other available variant; only when both are unavailable does the throat/breath synthesis fallback apply.

The model emits `hurt` only for surviving damage and one `player-death` event for fatal damage. Death stops any current grunt immediately, plays the longer recording once, and suppresses subsequent effects, including effects later in the same fatal event batch. `finish()` stops the score and ambient scheduling, fades the ambient bus, and keeps the context running until the last scheduled voice ends plus 250 ms for reflections. This allows the full scream to finish. Pause freezes the shared audio clock; mute applies to the same master; disposal stops and disconnects all voice nodes and closes the context. Failed vocal downloads or decoding do not block gameplay and have separate synthesis fallbacks.

Tests cover parallel recording preload, mixed network/status/decode failures in one batch, successful retry, first recorded injury, alternation, overlap cooldown, a death overriding pain, duplicate and late-effect suppression, tail completion, pause/mute, partial sample availability, fallback behavior, and full node cleanup.

## Pickup identities

Each successful pickup carries `pickupKind`, plus `weapon` and `ammoPool` where applicable, from `GameWorld.collect()` through the runtime event relay. The category remains separate from enemy `kind`. Rejected or already-collected resources produce no pickup event or sound.

| Item | Audible identity |
| --- | --- |
| Touch Grass | Firm medical pressure seal, descending relief hiss, steady low hum, and seated latch |
| Guardrails | Heavy plate seating followed by a separate steel locking latch |
| Training Data | Data-cartridge slam, coarse receiver resonance, ratchet, and lock; ammunition pool changes the resonance register |
| Weapon | A heavy mechanism seating and energizing; shutdown uses a longer, deeper motor and contactor |

The earlier pure-tone swells, digital chirps, and broad musical pitch slides are removed. Filtered noise and locally saturated, band-limited sawtooth excitation provide the material texture. Health combines a firm engagement with a steady 94 Hz restorative hum; armor has a spaced double strike; data separates its initial slam from the ratchet and lock; weapon acquisition carries more weight and a longer tail. Tests verify four distinct profiles, ammunition-pool variation, the heavier shutdown acquisition cue, compressor routing, pause/mute, bounded voices, and cleanup.

## Enemy voices

Each enemy retains three distinct cues: first awareness (`enemy-alert`), attack release (`enemy`), and death (`kill`). All twelve use the enemy `kind` and the event’s position-derived stereo pan and distance attenuation.

| Enemy | Awareness | Attack release | Death |
| --- | --- | --- | --- |
| Deceptive Alignment | Dry sub-vocal growl with leaking, filtered breath | Short throat attack and a ragged exhalation | Original Doom imp death (`DSBGDTH1`) |
| Sycophancy | Two strangled, wet approvals in a higher throat register | Clipped nasal snarl and fleshy impact | Original Doom zombie death (`DSPODTH1`) |
| Paperclip Maximizer | Tensioned wire scraping steel, then irregular rattles | Three rapid metal strikes and a grinding scrape | Original Doom demon death (`DSSGTDTH`) |
| Sam | Loaded server motor and two heavy contactors | A bass-heavy servo strike with a mechanical follow-through | Lowered recorded death yell (HaelDB `3yell9`) |

The imp, zombie, and demon recordings preserve their original 11,025 Hz, 8-bit mono PCM after removing DMX format padding. The boss uses the separately prepared vocal described above. Each successful death cue starts one buffer at its authored rate, with positional attenuation/panning and a 0.18 room send through the existing compressor. Playback gain is 1.0 (1.1 for Sam) before attenuation. If a recording fails to load, only that enemy uses its previous synthesized death profile; a loaded sample replaces the synthesized cue completely. The three player vocal files, `playerVoice()` method, shotgun file, and both shotgun methods remain byte-for-byte unchanged. [Sources and extraction details](../../public/game/audio/README.md) describe the recordings and rights attribution.

For awareness, attacks, and missing-recording fallbacks, organic voices use filtered throat excitation; paperclips use brighter but band-limited coarse wire and noise; Sam has lower motor resonances and longer envelopes. Pitch travel is restrained, with texture and rhythm carrying the identity. All layers share the existing compressor and bounded 64-voice pool. Local distortion nodes and filters disconnect with ended, stolen, or disposed sources. The tests require twelve unique profiles, filtered coarse oscillator routing, restrained pitch movement, distinct rhythmic structure, spatial scaling, pause/mute, voice limits, and full cleanup under 180 overlapping lifecycle events.

System Prompt uses the recorded report described above, with a coarse report and mechanical casing tick only as its missing-file fallback. Mechanistic Interpretability uses short electrical crack and rasp layers in place of broad high-pitched sweeps. Shutdown's charge uses an increasingly strained motor and filtered current; its heavier launch combines a held blast, low impact, and electrical aftershocks. Walls, flesh, doors, and the final shutdown receive matching material textures. The RLHF shotgun, its fallback, score, and shared output graph are unchanged.

## Pressure-seal lab doors

Regular lab doors toggle open/closed with E. Opening releases the bolts, vents compressed air with a sustained, descending filtered hiss, and drives the panel upward with a low mechanical motor. Closing draws air inward with a rising vacuum hiss and a heavier return motor. A separate impact, locking clunk, and short air chuff play only when the model reaches the fully closed position. The seal sound is an actual `doorAction: 'sealed'` event, so pausing or reversing a closing door cannot produce a premature latch.

The existing positional event relay carries `doorAction: 'open' | 'close' | 'sealed'` to `GameAudio`. Air layers hold their level briefly before decaying; bolts and motor layers retain the game's coarse mechanical texture. All layers share distance attenuation, stereo panning, room reflections, the mix compressor, pause/mute, and bounded voice cleanup. These sounds are original Web Audio synthesis and require no additional downloads. Player vocals, shotgun recordings, and original Doom monster death recordings are unchanged.

Doors use the existing 1.6-per-second travel rate in both directions. They close only on explicit interaction, remain passable according to their actual aperture, and reopen if a player or living enemy overlaps the doorway while closing. An occupied doorway refuses a close request. Secret panels remain open after discovery.

## Before/after render verification (preceding grit pass)

Chrome `OfflineAudioContext` rendered the previous and current implementation at 48 kHz stereo using the same seeds and schedules. The 35-second isolated reel includes all twelve enemy cues, five pickup variants, non-shotgun weapons, both pain variants, and player death. The prior fatal cue is represented by its former generic injury effect. The 22-second combat mix adds repeated four-enemy volleys, recorded shotgun fire every 0.8 seconds, pickups, player injuries, and a deliberately dense overlap of all twelve enemy profiles with a shotgun blast and nearby explosion.

| Measurement                   |   Before |  Current |
| ----------------------------- | -------: | -------: |
| Isolated reel peak            |    0.377 |    0.473 |
| Crowded mix peak              |    0.756 |    0.733 |
| Crowded mix headroom          |  2.43 dB |  2.70 dB |
| First player-pain peak        |    0.073 |    0.403 |
| Second player-pain peak       |    0.072 |    0.373 |
| Player-death peak             |    0.081 |    0.473 |
| Isolated shotgun peak         | 0.468404 | 0.468404 |
| Music/ambience reference peak | 0.095321 | 0.095321 |

All renders contain finite samples, zero clipped samples, and no Web Audio errors. The prerecorded player vocals have much more sustained body than the former short oscillator/noise cue. Both `recordedShotgun()` and `shotgunBlast()` remain byte-for-byte identical to the version before this pass; the shotgun WAV retains SHA-256 `a8300332e52fa8bc0b59b1aac3287d57075c8aaeca2f5e65ef9e348f72587602`. The isolated shotgun and music render checks confirm their unchanged output peaks. These are waveform and scheduling checks, not a perceptual listening review.

Local comparison files and per-cue measurements are in `/private/tmp/pdoom-grit-audition/`: `before-reel.wav`, `after-reel.wav`, `before-combat.wav`, `after-combat.wav`, and `measurements.json`. Isolated shotgun and music comparisons are included in the same directory. The renderer is `/private/tmp/pdoom-render-grit.mjs`.

## Menu and music

Menu navigation layers a filtered noise strike, falling low thump, inharmonic steel resonances, and delayed latch. Confirmation adds weight and a second impact; backing out uses a lower mechanical pitch. Rapid focus movement is rate limited, and the effect pool is bounded. The menu has its own muted master and compressor.

The shared `TrainingScore` plays an original pedal-tone motif with flattened-second and tritone movement, slowly changing dissonant pads, sparse industrial percussion, and short stereo reflections. The title version is slower and more spacious; gameplay adds pulses and occasional upper-register responses. Weapon transients sit above the score, with environmental machinery quieter below it. Positional effects and sector ambience are retained.

`MenuAudio` is owned once by the shell. `cue('move' | 'confirm' | 'back')` initializes and unlocks it from a user gesture. `setMuted`, `setActive`, and `dispose` control both music and effects. Construction or activation cannot autoplay audio before a gesture. The shell deactivates menu audio during gameplay. Hidden documents suspend the menu context; returning restores only the active menu. Old menu impacts are discarded when leaving. Gameplay pause suspends its context, and a terminal result fades its score while the final effect decays. Both graphs disconnect and close on disposal.
