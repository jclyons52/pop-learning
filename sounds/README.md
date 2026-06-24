# Phoneme audio clips

Recorded phoneme clips for clean phonics. When a clip exists here, the games
play it instead of the device's text-to-speech (which can't make truly pure
isolated sounds).

## How it works

`Pop.sound("<key>")` (in `shared/pop.js`) plays `sounds/<key>.mp3` **if** the
key is listed in `manifest.json`; otherwise it falls back to TTS reading the
respelling. So this is dormant until clips are added — nothing breaks in the
meantime.

## Adding clips

1. Drop `key.mp3` files in this folder. The **key is the respelling** the games
   already pass to `Pop.sound(...)` — e.g. the letter sounds in
   `shared/data.js` `sounds` (`buh`, `kuh`, `sss`, …), the digraph/blend sounds
   in slot 3 (`shh`, `chuh`, `bluh`, …).
2. List every added key in `manifest.json` (e.g. `["buh", "kuh", "shh"]`).
3. Add each `sounds/*.mp3` to `PRECACHE` in `service-worker.js`, then run
   `deno task stamp` and `deno task validate`.

Keep clips short (~0.4–0.8s), trimmed, normalised, mono. mp3 is widely
supported; the player expects `.mp3`.
