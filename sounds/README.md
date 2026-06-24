# Phoneme audio clips

Recorded phoneme clips for clean phonics. When a clip exists here, the games
play it instead of the device's text-to-speech (which can't make truly pure
isolated sounds). WAV is used so it plays everywhere, including iOS Safari — no
audio-conversion tooling needed.

## How it works

`Pop.sound("<key>")` (in `shared/pop.js`) plays the clip named in
`manifest.json` for that key (a respelling like `buh`, `shh`, `bluh`, `at`),
falling back to TTS when there's no clip. So this is dormant until clips are
added — nothing breaks meanwhile.

`manifest.json` maps key → filename, e.g. `{ "buh": "buh.wav", "shh": "shh.wav" }`.

## Adding clips (the easy way)

1. Read **[RECORDING.md](RECORDING.md)** — record the 51 sounds in one take.
2. Run `deno task split your-recording.wav`. It writes `sounds/<key>.wav`,
   updates `manifest.json`, and prints the `PRECACHE` lines to paste into
   `service-worker.js`.
3. Add those lines to `PRECACHE`, then `deno task stamp` and `deno task validate`.

## Adding clips by hand

Drop `key.wav` files here (key = the respelling the games pass to `Pop.sound`),
list them in `manifest.json`, add each to `PRECACHE`, then `deno task stamp`.
Keep clips short (~0.4–0.8s), trimmed, normalised, mono.
