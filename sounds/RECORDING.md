# Recording the phoneme clips 🎙️

Record these 51 sounds once, in this order, and the splitter turns them into the
clips the games play. A warm, familiar voice beats any TTS — and the licence is
simply yours.

## How to record

1. **Use [Audacity](https://www.audacityteam.org)** (free, open-source) or any
   recorder that can **export 16-bit PCM WAV** (not mp3/m4a — the splitter needs
   WAV). Quiet room; phone/laptop mic is fine.
2. Record **one continuous take**. Say each sound **once, clearly**, then pause
   for **about 1 second** before the next. The gaps are how the splitter finds
   the boundaries — clear gaps = clean splits.
3. Say the **pure sound**, short and clean:
   - **Stretchy sounds** (f, l, m, n, r, s, v, z, sh) — you can hold them: _ffff_, _mmmm_, _ssss_.
   - **Stop sounds** (b, k, d, g, p, t and the blends) — keep the little “uh” as
     short as you can: a clipped _b·_, not “buh-uh”.
4. Export as **WAV** (e.g. `daughter-sounds.wav`), then run:

   ```bash
   deno task split daughter-sounds.wav
   ```

   It writes `sounds/<key>.wav` for each, updates `manifest.json`, and prints the
   lines to paste into `PRECACHE` in `service-worker.js`. Then
   `deno task stamp && deno task validate`, and the games use your voice.

   If it reports the wrong number of segments, re-record with clearer gaps (or
   nudge the `THRESHOLDS` in `tests/split-audio.js`). You can re-run it as often
   as you like.

## The 51 sounds, in order

**Single letter-sounds**

| #  | clip   | say the sound…          | as in    |
| -- | ------ | ----------------------- | -------- |
| 1  | `ah`   | short **a**             | apple    |
| 2  | `buh`  | **b**                   | ball     |
| 3  | `kuh`  | **k** (covers c, k, ck) | cat      |
| 4  | `duh`  | **d**                   | dog      |
| 5  | `eh`   | short **e**             | egg      |
| 6  | `ff`   | **f** (stretch it)      | fish     |
| 7  | `guh`  | hard **g**              | goat     |
| 8  | `huh`  | **h**                   | hat      |
| 9  | `ih`   | short **i**             | insect   |
| 10 | `juh`  | **j**                   | juice    |
| 11 | `ll`   | **l** (stretch)         | lion     |
| 12 | `mm`   | **m** (stretch)         | moon     |
| 13 | `nn`   | **n** (stretch)         | nest     |
| 14 | `o`    | short **o**             | orange   |
| 15 | `puh`  | **p**                   | pig      |
| 16 | `kwuh` | **qu**                  | queen    |
| 17 | `rr`   | **r**                   | rabbit   |
| 18 | `sss`  | **s** (stretch)         | snake    |
| 19 | `tuh`  | **t**                   | tree     |
| 20 | `uh`   | short **u**             | umbrella |
| 21 | `vv`   | **v** (stretch)         | van      |
| 22 | `wuh`  | **w**                   | web      |
| 23 | `ks`   | **x**                   | fox      |
| 24 | `yuh`  | **y**                   | yo-yo    |
| 25 | `zz`   | **z** (stretch)         | zebra    |

**Digraphs (two letters, one sound)**

| #  | clip   | say…   | as in             |
| -- | ------ | ------ | ----------------- |
| 26 | `shh`  | **sh** | ship              |
| 27 | `chuh` | **ch** | chair             |
| 28 | `thh`  | **th** | thumb             |
| 29 | `ng`   | **ng** | ring (the ending) |

**Blends (say the two sounds joined)**

| #  | clip   | say…   | as in  |
| -- | ------ | ------ | ------ |
| 30 | `bluh` | **bl** | block  |
| 31 | `cluh` | **cl** | clock  |
| 32 | `fluh` | **fl** | flag   |
| 33 | `gluh` | **gl** | glass  |
| 34 | `pluh` | **pl** | plane  |
| 35 | `sluh` | **sl** | slide  |
| 36 | `bruh` | **br** | bread  |
| 37 | `cruh` | **cr** | crab   |
| 38 | `druh` | **dr** | drum   |
| 39 | `fruh` | **fr** | frog   |
| 40 | `gruh` | **gr** | grapes |
| 41 | `truh` | **tr** | train  |
| 42 | `snuh` | **sn** | snail  |
| 43 | `spuh` | **sp** | spider |
| 44 | `stuh` | **st** | star   |
| 45 | `swuh` | **sw** | swan   |

**Rimes (word-family endings — say the blended ending)**

| #  | clip | say…   | as in |
| -- | ---- | ------ | ----- |
| 46 | `at` | **at** | cat   |
| 47 | `an` | **an** | pan   |
| 48 | `ig` | **ig** | pig   |
| 49 | `og` | **og** | dog   |
| 50 | `en` | **en** | hen   |
| 51 | `un` | **un** | sun   |
