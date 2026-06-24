// Split one long phoneme recording into the named clips the games expect.
// Record the sounds in the order below (see sounds/RECORDING.md), with a clear
// ~1s gap between each, as a 16-bit PCM WAV. Then:
//   deno task split path/to/recording.wav
// It detects the gaps, trims + normalises each sound, writes sounds/<key>.wav,
// updates sounds/manifest.json, and prints a per-segment report so you can spot
// a missed/merged sound. If the count is off it auto-tunes the thresholds to
// hit the expected 51; you can also force them, e.g.
//   deno task split rec.wav --min-silence=180 --min-clip=70 --rel-thresh=0.04
import path from "node:path";
import { fileURLToPath } from "node:url";

// The 51 sounds, in recording order. The key is the clip filename + the exact
// respelling the games pass to Pop.sound(...). Keep in sync with sounds/RECORDING.md.
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

interface Opts {
  windowMs: number;
  minSilenceMs: number;
  minClipMs: number;
  relThresh: number;
  absThresh: number;
  normalize: boolean;
  padMs: number;
}
const BASE: Opts = {
  windowMs: 20,
  minSilenceMs: 250, // a gap this long separates two sounds
  minClipMs: 90, // ignore blips shorter than this
  relThresh: 0.06, // "loud" if window RMS > 6% of the peak…
  absThresh: 0.01, // …or above this absolute floor
  normalize: true,
  padMs: 12,
};

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOUNDS = path.join(ROOT, "sounds");

function ascii(bytes: Uint8Array, off: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[off + i]);
  return s;
}

function parseWav(bytes: Uint8Array) {
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

function toMono({ fmt, dataOff, dataLen, dv }: ReturnType<typeof parseWav>): Float32Array {
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

function findSegments(samples: Float32Array, sampleRate: number, opts: Opts): number[][] {
  const win = Math.max(1, Math.floor(sampleRate * opts.windowMs / 1000));
  const minSilence = Math.ceil(opts.minSilenceMs / opts.windowMs);
  const minClip = Math.ceil(opts.minClipMs / opts.windowMs);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  const thresh = Math.max(opts.absThresh, peak * opts.relThresh);
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

// Try to hit the expected segment count by sweeping the thresholds. Prefers
// small deviations from BASE. Returns the opts that landed exactly on target.
function autoTune(samples: Float32Array, rate: number, base: Opts, target: number): Opts | null {
  const silences = [250, 220, 200, 180, 160, 140, 120, 100, 80, 300, 350];
  const thresholds = [0.06, 0.045, 0.08, 0.035, 0.1, 0.025, 0.02];
  const clips = [90, 70, 120, 55, 150, 40];
  for (const minClipMs of clips) {
    for (const relThresh of thresholds) {
      for (const minSilenceMs of silences) {
        const opts = { ...base, minSilenceMs, relThresh, minClipMs };
        if (findSegments(samples, rate, opts).length === target) return opts;
      }
    }
  }
  return null;
}

function clip(samples: Float32Array, [s, e]: number[], opts: Opts, sampleRate: number): Int16Array {
  let peak = 0;
  for (let i = s; i < e; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  const tt = peak * 0.05;
  let a = s, b = e;
  while (a < e && Math.abs(samples[a]) < tt) a++;
  while (b > a && Math.abs(samples[b - 1]) < tt) b--;
  const pad = Math.floor(sampleRate * opts.padMs / 1000);
  a = Math.max(s, a - pad);
  b = Math.min(e, b + pad);
  const gain = opts.normalize && peak > 0 ? Math.min(4, 0.92 / peak) : 1;
  const out = new Int16Array(b - a);
  for (let i = 0; i < out.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[a + i] * gain));
    out[i] = Math.round(v * 32767);
  }
  return out;
}

function encodeWav(int16: Int16Array, sampleRate: number): Uint8Array {
  const dataSize = int16.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(buf);
  const w = (str: string, o: number) => {
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

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

// ---- args ----
function parseArgs(argv: string[]) {
  let input = "";
  const overrides: Partial<Opts> = {};
  for (const a of argv) {
    if (!a.startsWith("--")) {
      input = a;
      continue;
    }
    const [k, v] = a.slice(2).split("=");
    if (k === "min-silence") overrides.minSilenceMs = Number(v);
    else if (k === "min-clip") overrides.minClipMs = Number(v);
    else if (k === "rel-thresh") overrides.relThresh = Number(v);
    else if (k === "pad") overrides.padMs = Number(v);
    else if (k === "no-normalize") overrides.normalize = false;
  }
  return { input, overrides };
}

// ---- main ----
const { input, overrides } = parseArgs(Deno.args);
if (!input) {
  console.error(
    "usage: deno task split <recording.wav> [--min-silence=200] [--min-clip=70] [--rel-thresh=0.04] [--pad=12] [--no-normalize]",
  );
  Deno.exit(1);
}

const parsed = parseWav(Deno.readFileSync(input));
const samples = toMono(parsed);
const rate = parsed.fmt.sampleRate;
const forced = Object.keys(overrides).length > 0;
let opts: Opts = { ...BASE, ...overrides };
let segs = findSegments(samples, rate, opts);

if (segs.length !== KEY_ORDER.length && !forced) {
  const tuned = autoTune(samples, rate, opts, KEY_ORDER.length);
  if (tuned) {
    opts = tuned;
    segs = findSegments(samples, rate, opts);
    console.log(
      `Auto-tuned to ${segs.length} segments (min-silence=${opts.minSilenceMs}ms, ` +
        `rel-thresh=${opts.relThresh}, min-clip=${opts.minClipMs}ms).`,
    );
  }
}

console.log(`Found ${segs.length} segments; expected ${KEY_ORDER.length}.\n`);

// per-segment report so a misaligned/merged sound is obvious
const durs = segs.map(([s, e]) => (e - s) / rate * 1000);
const sorted = [...durs].sort((a, b) => a - b);
const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
console.log("seg | time   | dur    | → clip");
segs.forEach(([s, e], i) => {
  const dur = (e - s) / rate * 1000;
  const key = i < KEY_ORDER.length ? KEY_ORDER[i] : "(extra)";
  let flag = "";
  if (median && dur > median * 1.7) flag = "  ⚠ long — two sounds merged?";
  else if (median && dur < median * 0.45) flag = "  ⚠ short — a blip/noise?";
  console.log(
    `${String(i + 1).padStart(3)} | ${fmtTime(s / rate).padStart(6)} | ${
      String(Math.round(dur)).padStart(4)
    }ms | ${key}${flag}`,
  );
});

if (segs.length !== KEY_ORDER.length) {
  console.log(
    `\n✗ Count is off by ${
      segs.length - KEY_ORDER.length
    }. Nothing written — fix this first so the labels line up:`,
  );
  if (segs.length < KEY_ORDER.length) {
    console.log(
      "  • Two sounds likely merged (see any ⚠ long row): re-record that gap longer, or try --min-silence=160.",
    );
    console.log("  • Or one was too quiet to detect: try --rel-thresh=0.035.");
  } else {
    console.log(
      "  • An extra blip/breath got counted (see any ⚠ short row): try --min-clip=130 or --rel-thresh=0.08.",
    );
  }
  console.log("  Re-run and check the report lines up (seg 1 = ah, 2 = buh, …) before it writes.");
  Deno.exit(1);
}

// count matches — clean out old clips, then write fresh
for (const f of Deno.readDirSync(SOUNDS)) {
  if (f.name.endsWith(".wav")) Deno.removeSync(path.join(SOUNDS, f.name));
}
const manifest: Record<string, string> = {};
segs.forEach((range, i) => {
  const key = KEY_ORDER[i];
  Deno.writeFileSync(path.join(SOUNDS, key + ".wav"), encodeWav(clip(samples, range, opts, rate), rate));
  manifest[key] = key + ".wav";
});
Deno.writeFileSync(
  path.join(SOUNDS, "manifest.json"),
  new TextEncoder().encode(JSON.stringify(manifest) + "\n"),
);

console.log(`\n✓ Wrote ${segs.length} clips + manifest.json (old clips cleared).`);
console.log(
  "Listen to a few, then add these to PRECACHE in service-worker.js and run `deno task stamp && deno task validate`:",
);
for (const key of KEY_ORDER) console.log(`  "sounds/${key}.wav",`);
