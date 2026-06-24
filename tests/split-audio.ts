// Split one long phoneme recording into the named clips the games expect.
// Record the sounds in the order below (see sounds/RECORDING.md), with a clear
// ~1s gap between each, as a 16-bit PCM WAV. Then:
//   deno task split path/to/recording.wav
// It detects the gaps, trims + normalises each sound, writes sounds/<key>.wav,
// and updates sounds/manifest.json. Tweak the THRESHOLDS if the segment count
// doesn't match (it tells you what it found).
import path from "node:path";
import { fileURLToPath } from "node:url";

// The 51 sounds, in recording order. The key is the clip filename + the exact
// respelling the games pass to Pop.sound(...). Keep this in sync with sounds/RECORDING.md.
const KEY_ORDER = [
  // single letter-sounds
  "ah",
  "buh",
  "kuh",
  "duh",
  "eh",
  "ff",
  "guh",
  "huh",
  "ih",
  "juh",
  "ll",
  "mm",
  "nn",
  "o",
  "puh",
  "kwuh",
  "rr",
  "sss",
  "tuh",
  "uh",
  "vv",
  "wuh",
  "ks",
  "yuh",
  "zz",
  // digraphs
  "shh",
  "chuh",
  "thh",
  "ng",
  // blends
  "bluh",
  "cluh",
  "fluh",
  "gluh",
  "pluh",
  "sluh",
  "bruh",
  "cruh",
  "druh",
  "fruh",
  "gruh",
  "truh",
  "snuh",
  "spuh",
  "stuh",
  "swuh",
  // rimes (word-family endings)
  "at",
  "an",
  "ig",
  "og",
  "en",
  "un",
];

const THRESHOLDS = {
  windowMs: 20, // analysis window
  minSilenceMs: 250, // gap this long separates two sounds
  minClipMs: 90, // ignore blips shorter than this
  relThresh: 0.06, // "loud" if window RMS > 6% of the peak…
  absThresh: 0.01, // …or above this absolute floor
  normalize: true, // scale each clip up toward full volume
  padMs: 12, // keep a little air around each clip
};

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOUNDS = path.join(ROOT, "sounds");

function ascii(bytes, off, len) {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[off + i]);
  return s;
}

function parseWav(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") {
    throw new Error("Not a WAV file (expected RIFF/WAVE). Export as 16-bit PCM WAV.");
  }
  let off = 12, fmt: any = null, dataOff = -1, dataLen = 0;
  while (off + 8 <= bytes.length) {
    const id = ascii(bytes, off, 4);
    const size = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (id === "fmt ") {
      fmt = {
        audioFormat: dv.getUint16(body, true),
        channels: dv.getUint16(body + 2, true),
        sampleRate: dv.getUint32(body + 4, true),
        bitsPerSample: dv.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      dataOff = body;
      dataLen = Math.min(size, bytes.length - body);
    }
    off = body + size + (size % 2);
  }
  if (!fmt) throw new Error("No fmt chunk found.");
  if (dataOff < 0) throw new Error("No data chunk found.");
  if (fmt.audioFormat !== 1) throw new Error("Only PCM WAV is supported — export uncompressed 16-bit PCM.");
  if (fmt.bitsPerSample !== 16) throw new Error(`Only 16-bit WAV supported (got ${fmt.bitsPerSample}-bit).`);
  return { fmt, dataOff, dataLen, dv };
}

function toMono({ fmt, dataOff, dataLen, dv }) {
  const ch = fmt.channels, frames = Math.floor(dataLen / (2 * ch));
  const out = new Float32Array(frames);
  let p = dataOff;
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < ch; c++) {
      sum += dv.getInt16(p, true) / 32768;
      p += 2;
    }
    out[i] = sum / ch;
  }
  return out;
}

function findSegments(samples, sampleRate) {
  const win = Math.max(1, Math.floor(sampleRate * THRESHOLDS.windowMs / 1000));
  const minSilence = Math.ceil(THRESHOLDS.minSilenceMs / THRESHOLDS.windowMs);
  const minClip = Math.ceil(THRESHOLDS.minClipMs / THRESHOLDS.windowMs);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  const thresh = Math.max(THRESHOLDS.absThresh, peak * THRESHOLDS.relThresh);
  const nWins = Math.floor(samples.length / win);
  const loud = new Array(nWins);
  for (let w = 0; w < nWins; w++) {
    let s = 0;
    const base = w * win;
    for (let i = 0; i < win; i++) {
      const v = samples[base + i];
      s += v * v;
    }
    loud[w] = Math.sqrt(s / win) > thresh;
  }
  const segs: number[][] = [];
  let w = 0;
  while (w < nWins) {
    if (!loud[w]) {
      w++;
      continue;
    }
    const start = w;
    let lastLoud = w, silence = 0;
    w++;
    while (w < nWins) {
      if (loud[w]) {
        lastLoud = w;
        silence = 0;
      } else if (++silence >= minSilence) break;
      w++;
    }
    if (lastLoud - start + 1 >= minClip) segs.push([start * win, (lastLoud + 1) * win]);
  }
  return segs;
}

function clip(samples, [s, e]: number[], sampleRate) {
  let peak = 0;
  for (let i = s; i < e; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  const tt = peak * 0.05;
  let a = s, b = e;
  while (a < e && Math.abs(samples[a]) < tt) a++;
  while (b > a && Math.abs(samples[b - 1]) < tt) b--;
  const pad = Math.floor(sampleRate * THRESHOLDS.padMs / 1000);
  a = Math.max(s, a - pad);
  b = Math.min(e, b + pad);
  const gain = THRESHOLDS.normalize && peak > 0 ? Math.min(4, 0.92 / peak) : 1;
  const out = new Int16Array(b - a);
  for (let i = 0; i < out.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[a + i] * gain));
    out[i] = Math.round(v * 32767);
  }
  return out;
}

function encodeWav(int16, sampleRate) {
  const dataSize = int16.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(buf);
  const w = (str, o) => {
    for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i));
  };
  w("RIFF", 0);
  dv.setUint32(4, 36 + dataSize, true);
  w("WAVE", 8);
  w("fmt ", 12);
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  w("data", 36);
  dv.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < int16.length; i++) {
    dv.setInt16(o, int16[i], true);
    o += 2;
  }
  return new Uint8Array(buf);
}

// ---- main ----
const input = Deno.args[0];
if (!input) {
  console.error("usage: deno task split <recording.wav>");
  Deno.exit(1);
}
const parsed = parseWav(Deno.readFileSync(input));
const samples = toMono(parsed);
const rate = parsed.fmt.sampleRate;
const segs = findSegments(samples, rate);

console.log(`Found ${segs.length} sound segments; expected ${KEY_ORDER.length}.`);
if (segs.length !== KEY_ORDER.length) {
  console.log("⚠ Count mismatch. Re-record with clearer ~1s gaps, or tweak THRESHOLDS in this file.");
  console.log(
    "  Writing the first " + Math.min(segs.length, KEY_ORDER.length) +
      " in order — check the mapping before committing.",
  );
}

const n = Math.min(segs.length, KEY_ORDER.length);
const manifest = {};
for (let i = 0; i < n; i++) {
  const key = KEY_ORDER[i];
  Deno.writeFileSync(path.join(SOUNDS, key + ".wav"), encodeWav(clip(samples, segs[i], rate), rate));
  manifest[key] = key + ".wav";
}
Deno.writeFileSync(
  path.join(SOUNDS, "manifest.json"),
  new TextEncoder().encode(JSON.stringify(manifest) + "\n"),
);

console.log(`\n✓ Wrote ${n} clips + manifest.json.`);
console.log(
  "Next: add these to PRECACHE in service-worker.js, then `deno task stamp` and `deno task validate`:",
);
for (let i = 0; i < n; i++) console.log(`  "sounds/${KEY_ORDER[i]}.wav",`);
