# Recorded game audio

## Original Doom monster death recordings

The imp, zombie, and demon `doom-*-death.wav` files contain original **Doom** monster death audio from id Software's shareware 1.9 `DOOM1.WAD`. This is the original Doom option requested for enemy deaths, not an approximation or Doom 64 recording. The boss asset retains its `doom-baron-death.wav` filename but now uses the separate recorded vocal described below. The player pain/death recordings and RLHF shotgun file are unchanged.

The source WAD was already inspected during the engine research and retained locally. Its source is the [tagged wasmdoom v0.0.2 data file](https://github.com/theMagicalKarp/wasmdoom/blob/v0.0.2/wads/doom1.wad), available as a [raw download](https://raw.githubusercontent.com/theMagicalKarp/wasmdoom/v0.0.2/wads/doom1.wad). It is 4,196,020 bytes with 1,264 lumps. Only the three sounds below are included in this project; the WAD itself is not bundled.

| Game asset | Parody enemy | Original monster | WAD lump | PCM frames | Duration | WAV bytes |
| --- | --- | --- | --- | --- | --- | --- |
| `doom-imp-death.wav` | Deceptive Alignment | Imp | `DSBGDTH1` | 7,089 | 0.642993 s | 7,134 |
| `doom-zombie-death.wav` | Sycophancy | Possessed zombie | `DSPODTH1` | 12,931 | 1.172880 s | 12,976 |
| `doom-demon-death.wav` | Paperclip Maximizer | Demon / Pinky | `DSSGTDTH` | 12,219 | 1.108299 s | 12,264 |

All three retain the native **11,025 Hz, mono, unsigned 8-bit PCM**. No resampling, pitch shifting, equalization, normalization, fades, or synthesis is baked into these files. The extraction removes the eight-byte DMX header and the 16 sample bytes at each end that the original DMX playback skips, then wraps the remaining PCM in a standard WAV container. A RIFF alignment byte is outside the audio data. Every exported PCM sample was verified byte-for-byte against its source lump. Some original samples reach full scale; playback gain supplies mix headroom.

The monster assignments are verified against id Software's [original object definitions](https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/info.c): `MT_TROOP`, `MT_POSSESSED`, `MT_SERGEANT`, and `MT_BRUISER` select these death-sound families. Doom's [`A_Scream`](https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/p_enemy.c) chooses among two imp and three zombie variants; this demo uses the first variant of each family. The [`sounds.c` table](https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/sounds.c) supplies their names. The 16-byte edge skip follows Chocolate Doom's documented DMX-compatible [`CacheSFX` implementation](https://github.com/chocolate-doom/chocolate-doom/blob/master/src/i_sdlsound.c). Sources checked September 5, 2026.

These are copyrighted game recordings distributed with id Software's shareware, **not CC0 assets**. They remain the property of their respective rights holders. Neither this repository's MIT license nor the Doom engine source-code license licenses these game recordings. See [NOTICES.md](../../../NOTICES.md).

SHA-256:

```text
1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771  source DOOM1.WAD
322ffe6b6c03e4330cc0e5f84bd81ab4164be441e5698edc1ae41219f99be15f  source DSBGDTH1 lump
4bb739608e4a99525bf264668b6c215236db9c723f6da7b79652beef9ca55488  source DSPODTH1 lump
2820ef3bb16ac1b8d0b430d712c3f693e467ecacbba5f0c703635d5f84892f13  source DSSGTDTH lump
28cd8003e02355b319acd9e4adb72fa244639779cccf7abb00032872648028d4  doom-imp-death.wav
1dbf8af67328d943f6e0e38e234c9a10a3638ab5931af96825740859217ea4ca  doom-zombie-death.wav
df0c2e8fcca84d4996801ea7f97e15a1949dad6469cfc1b7705eb05db5b4af55  doom-demon-death.wav
```

To reproduce these WAV containers, run this Python from the repository root with the source WAD path as its argument:

```python
import hashlib
from pathlib import Path
import struct
import sys

wad = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(wad).hexdigest() == "1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771"
magic, count, directory = struct.unpack_from("<4sII", wad)
assert magic == b"IWAD"
lumps = {}
for index in range(count):
    offset, size, name = struct.unpack_from("<II8s", wad, directory + index * 16)
    lumps[name.rstrip(b"\0").decode("ascii")] = wad[offset:offset + size]

for monster, name in [
    ("imp", "DSBGDTH1"), ("zombie", "DSPODTH1"),
    ("demon", "DSSGTDTH"),
]:
    lump = lumps[name]
    encoding, rate, length = struct.unpack_from("<HHI", lump)
    assert encoding == 3 and rate == 11025 and length == len(lump) - 8
    pcm = lump[24:8 + length - 16]
    padding = b"\0" * (len(pcm) % 2)
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm) + len(padding))
    header += b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate, 1, 8)
    header += b"data" + struct.pack("<I", len(pcm))
    Path(f"public/game/audio/doom-{monster}-death.wav").write_bytes(header + pcm + padding)
```

## Sam boss death recording

`doom-baron-death.wav` now uses **HaelDB's `3yell9.wav`**, a different take from the approved player death voice, from [Male Grunt/Yelling sounds](https://opengameart.org/content/male-gruntyelling-sounds) under the creator's offered [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) option. The original archive and license provenance are documented in the player-vocal section below. The original file is preserved byte-for-byte as `sources/haeldb-3yell9.wav` and matches archive entry `yelling sounds/3yell9.wav`.

The 0.36–1.82-second excerpt is lowered to 0.82× pitch, filtered, equalized, moderately compressed, limited, and faded. It retains a sustained vocal body and natural tail without added bitcrushing, soft clipping, synthetic layers, or baked-in reverb. The result is **1.78 seconds**, 78,498 frames, mono 44.1 kHz 16-bit PCM, 157,074 bytes. Peak is −1.51 dBFS and RMS is −9.59 dBFS, with no full-scale clipped samples. The existing runtime plays it at rate 1 with its full duration, Sam's 1.1 gain, positional attenuation, and room reflections. Source selection and validation used recording provenance and signal measurements; perceptual judgment remains with the listener.

The filename is retained for asset compatibility; this is **no longer the Doom Baron recording**. The previous WAV was valid and matched `DSBRSDTH` exactly, but its processed 8-bit character was replaced in response to playback feedback. No other weapon, player, or enemy WAV changed.

SHA-256:

```text
f9c63c26c2dafb9c0dd0859c56c79c9012faf32bf2defdc8b53b19ed23ad0704  sources/haeldb-3yell9.wav
47f87b055f6a8cafe269c4a8f28be07c572edc83b0958ef254da02c4a10bcb4d  doom-baron-death.wav
```

Recreate from this directory using FFmpeg:

```sh
ffmpeg -i sources/haeldb-3yell9.wav \
  -af 'aformat=channel_layouts=mono,atrim=start=0.36:end=1.82,asetpts=PTS-STARTPTS,asetrate=36162,aresample=44100,highpass=f=65,lowpass=f=7200,equalizer=f=160:t=q:w=0.9:g=2.5,equalizer=f=1900:t=q:w=1:g=1,acompressor=threshold=0.28:ratio=2.5:attack=4:release=90:makeup=1.3,volume=1.8,alimiter=limit=0.84:level=0:latency=1,apad,atrim=duration=1.78,afade=t=in:d=0.004,afade=t=out:st=1.66:d=0.12' \
  -map_metadata -1 -ac 1 -ar 44100 -c:a pcm_s16le doom-baron-death.wav
```

## RLHF shotgun recordings

`rlhf-shotgun.wav` is the game's processed shotgun fire and pump sample: 0.87 seconds, mono, 44.1 kHz, 16-bit PCM, 76,812 bytes. It combines these two freely reusable recordings:

| Recording | Creator | Source page | Downloaded file | License |
| --- | --- | --- | --- | --- |
| 20 gauge shotgun gunshot | michorvath | [Freesound](https://freesound.org/people/michorvath/sounds/427595/) | [Public HQ MP3 preview](https://cdn.freesound.org/previews/427/427595_3094998-hq.mp3), preserved as `sources/michorvath-20-gauge.mp3` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| shotguncock.wav, from Gun reload sounds | SpringySpringo | [OpenGameArt](https://opengameart.org/content/gun-reload-sounds) | [Original WAV](https://opengameart.org/sites/default/files/shotguncock_0.wav), preserved as `sources/springyspringo-pump.wav` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Source pages and licenses verified on September 5, 2026. The Freesound source describes a 20-gauge shotgun firing; the OpenGameArt source identifies its mechanical sounds as recordings of airsoft guns. Attribution is included voluntarily. These are independent recordings, not sounds extracted from Doom or Doom 64.

The fire recording was trimmed to its attack, lowered in pitch, equalized for weight and presence, compressed, and faded. The mechanical recording was trimmed, slightly accelerated, equalized, and placed 320 milliseconds after the attack. Their combined output was peak-limited to 0.9. Music and other weapon volumes were not changed.

SHA-256:

```text
97a8f4893b910e3f43f3ccfcc5ea872af1da917937346f14b4114a74f1974c46  sources/michorvath-20-gauge.mp3
33e007321ba83301c861aef573f2c40b70bc62f8f24c0164877e6dd123e24371  sources/springyspringo-pump.wav
a8300332e52fa8bc0b59b1aac3287d57075c8aaeca2f5e65ef9e348f72587602  rlhf-shotgun.wav
```

Recreate the processed sample from this directory with FFmpeg:

```sh
ffmpeg -i sources/michorvath-20-gauge.mp3 -i sources/springyspringo-pump.wav \
  -filter_complex '[0:a]atrim=start=0.045:end=0.9,asetpts=PTS-STARTPTS,asetrate=39690,aresample=44100,highpass=f=45,equalizer=f=125:t=q:w=0.8:g=3,equalizer=f=2600:t=q:w=0.9:g=3,acompressor=threshold=0.5:ratio=2:attack=1:release=100:makeup=1,volume=1.1,afade=t=out:st=0.46:d=0.41[blast];[1:a]atrim=start=0.043:end=0.42,asetpts=PTS-STARTPTS,atempo=1.08,highpass=f=170,equalizer=f=2800:t=q:w=1:g=3,volume=0.42,adelay=320[pump];[blast][pump]amix=inputs=2:normalize=0,alimiter=limit=0.9:level=0:latency=1,atrim=end=0.87,afade=t=in:d=0.0004,afade=t=out:st=0.82:d=0.05[out]' \
  -map '[out]' -ac 1 -ar 44100 -c:a pcm_s16le rlhf-shotgun.wav
```

The processing used a 16-bit PCM decode of the MP3 before the filter chain. Decoding directly from MP3 can introduce tiny rounding differences from the saved checksum.

## System Prompt pistol report

`system-prompt-pistol.wav` is a short, processed report for the System Prompt pistol: **0.310 seconds**, 13,671 frames, mono, 44.1 kHz, 16-bit PCM, 27,420 bytes. It derives directly from michorvath's CC0 **20-gauge shotgun recording**, preserved as `sources/michorvath-20-gauge.mp3` and linked in the shotgun source table above. This is a sound-design adaptation for a fictional pistol, not a claim that the source captured a real pistol. It does not use the processed RLHF shotgun file or its pump recording.

The source attack is trimmed, raised 8% in pitch, filtered, and equalized for low-mid weight and upper-mid attack. Compression and light soft saturation sustain the initial report. A 160-millisecond fade produces a short tail, with no added reverb or mechanical pump. The 310-millisecond sample fits the pistol's 280-millisecond firing interval with only the faded tail overlapping the next shot. The existing shotgun, player vocals, and four Doom enemy death WAVs remain byte-for-byte unchanged.

PCM measurements: peak **−1.11 dBFS** (0.880005 after 16-bit rounding), full-file RMS **−11.66 dBFS**, attack RMS (0–40 ms) **−9.74 dBFS**, body RMS (40–150 ms) **−9.22 dBFS**, and tail RMS (150–310 ms) **−16.28 dBFS**. The signal passes −40 dBFS within 9.46 milliseconds of the start; there are no clipped PCM samples. These are signal measurements, not a perceptual listening assessment.

SHA-256:

```text
97a8f4893b910e3f43f3ccfcc5ea872af1da917937346f14b4114a74f1974c46  sources/michorvath-20-gauge.mp3
d676e46649920092e398f4b6dd0811cd65aff9c2fbac985137084fe691b312c5  system-prompt-pistol.wav
```

Recreate the processed sample from this directory using FFmpeg:

```sh
ffmpeg -i sources/michorvath-20-gauge.mp3 \
  -af 'atrim=start=0.045:end=0.405,asetpts=PTS-STARTPTS,asetrate=47628,aresample=44100,highpass=f=65,lowpass=f=9500,equalizer=f=140:t=q:w=0.85:g=3.5,equalizer=f=350:t=q:w=0.9:g=1.5,equalizer=f=2600:t=q:w=0.8:g=3,acompressor=threshold=0.24:ratio=3:attack=1:release=65:makeup=1.7,asoftclip=type=tanh:threshold=0.95:output=1.08:oversample=2,volume=1.8,alimiter=limit=0.88:level=0:latency=1,apad,atrim=duration=0.31,afade=t=in:d=0.0003,afade=t=out:st=0.15:d=0.16' \
  -map_metadata -1 -ac 1 -ar 44100 -c:a pcm_s16le system-prompt-pistol.wav
```

The saved file was produced by FFmpeg 9.0.1 (`Lavf63.1.101`) directly from the preserved MP3. Other versions may introduce small rounding or container-metadata differences.

## Player pain and death recordings

The player vocals derive from **HaelDB**, [Male Grunt/Yelling sounds](https://opengameart.org/content/male-gruntyelling-sounds), published April 12, 2012. The creator describes four male vocalists recorded with a Neumann microphone and Avalon 2022 preamp. The page offers both OGA-BY 3.0 and [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); this project uses the CC0 option. Source and license were checked September 5, 2026. Credit is included voluntarily.

The [original archive](https://opengameart.org/sites/default/files/yelling%20sounds.zip) contains separate takes. The three selected files from its performer-3 group are preserved byte-for-byte under `sources/`. They are human recordings, not TTS, cloned public-figure voices, or audio taken from Doom. No pitch shifting is applied. The death take is a longer yell rather than a repeated pain grunt.

| Game asset | Preserved original | Source excerpt | Duration | Peak dBFS | RMS dBFS | Bytes |
| --- | --- | --- | --- | --- | --- | --- |
| `player-pain-1.wav` | `sources/haeldb-3grunt1.wav` (`yelling sounds/3grunt1.wav`) | 0.51–0.94 s | 0.430 s | −1.51 | −10.65 | 38,004 |
| `player-pain-2.wav` | `sources/haeldb-3grunt3.wav` (`yelling sounds/3grunt3.wav`) | 0.005–0.47 s | 0.465 s | −1.91 | −13.98 | 41,092 |
| `player-death.wav` | `sources/haeldb-3yell1.wav` (`yelling sounds/3yell1.wav`) | 0.37–1.90 s, 1.04× tempo | 1.471 s | −1.31 | −9.52 | 129,820 |

The originals are 44.1 kHz stereo, 16-bit PCM. Game assets are 44.1 kHz mono, 16-bit PCM. Processing removes unused silence, folds stereo to mono, removes low rumble, adds mild body/presence EQ, compresses peaks, applies soft saturation, and limits the output below full scale. Three-millisecond attacks and 45-millisecond tail fades prevent hard cut clicks. There is no added reverb in the WAV files; the game owns the room reflections. Only the death take has a slight tempo change, with pitch preserved.

PCM checks confirm no clipped samples, peaks below the 0.86 ceiling, and a signal above −40 dBFS within 17 milliseconds of each file's start. The complete death recording lasts 64,871 frames and needs to finish before suspending the gameplay audio context. Source selection follows the creator's recording descriptions and signal measurements; a perceptual audio audition was unavailable in the authoring session.

SHA-256:

```text
e9100a4e3b9dcd146993089970dc6097dcf9935fa4683b196040012bad65d67a  original yelling sounds.zip
57b3a59c39ffe74a1706bcb85c451443c3b388d1f6423827b2af4af508c8416b  sources/haeldb-3grunt1.wav
6006516ae7979896a4053cfc88f26ef575a67133fa0c51de5d9a893498960cc9  sources/haeldb-3grunt3.wav
df151155a9c1a743de9d7c079a700896f37926d832305e07d2c7f2f0846c86b9  sources/haeldb-3yell1.wav
ad5664c670f9964a62c6b66a2f85bcf5a3b213b0b400236c9d5e2ab2f9ec8fef  player-pain-1.wav
9eab025da9cbcc0d902e23ee7e9870153a9cc5e48ed8388287472e5dcb316da5  player-pain-2.wav
179c9f3fa6f4316e883eedb8cdc6554956c077295ca9e0d85739d8fdd237d476  player-death.wav
```

Recreate the three game files from this directory using FFmpeg:

```sh
render_voice() {
  ffmpeg -y -i "sources/$1" \
    -af "aformat=channel_layouts=mono,atrim=start=$3:end=$4,asetpts=PTS-STARTPTS,atempo=$5,highpass=f=75,lowpass=f=8200,equalizer=f=180:t=q:w=0.9:g=2.5,equalizer=f=2300:t=q:w=1:g=1.5,volume=$7,acompressor=threshold=0.32:ratio=2:attack=3:release=80:makeup=1.35,asoftclip=type=tanh:threshold=0.95:output=1.15:oversample=2,volume=2,alimiter=limit=0.86:level=0:latency=1,apad,atrim=duration=$6,afade=t=in:d=0.003,afade=t=out:st=$8:d=0.045" \
    -map_metadata -1 -ac 1 -ar 44100 -c:a pcm_s16le "$2"
}

render_voice haeldb-3grunt1.wav player-pain-1.wav 0.51 0.94 1 0.43 2.2 0.385
render_voice haeldb-3grunt3.wav player-pain-2.wav 0.005 0.47 1 0.465 2.5 0.420
render_voice haeldb-3yell1.wav player-death.wav 0.37 1.9 1.04 1.471 1.5 1.426
```

The saved files were produced by FFmpeg 9.0.1 (`Lavf63.1.101`). Different FFmpeg versions can produce small rounding or container-metadata differences.
