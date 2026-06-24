// Shared helpers for the validator + the SW stamper. Deno-native (uses node:
// built-ins, which Deno provides without any install).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Parse the PRECACHE list out of service-worker.js. */
export function parsePrecache() {
  const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const m = sw.match(/var PRECACHE = \[([\s\S]*?)\];/);
  if (!m) throw new Error("Could not find PRECACHE array in service-worker.js");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** Read the stamped ASSETS_HASH from service-worker.js. */
export function readAssetsHash() {
  const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const m = sw.match(/var ASSETS_HASH = "([0-9a-f]+)"/);
  return m ? m[1] : null;
}

/** Digest of every precached file's contents (service-worker.js is not
    precached, so there's no chicken-and-egg). Throws if a file is missing. */
export function computeAssetsHash() {
  const files = parsePrecache().filter((p) => p !== "./").sort();
  const h = crypto.createHash("sha256");
  for (const f of files) {
    h.update(f + "\0");
    h.update(fs.readFileSync(path.join(ROOT, f)));
  }
  return h.digest("hex").slice(0, 10);
}

/** Load shared/data.js in a tiny sandbox and return Pop.data. data.js is an
    IIFE invoked with `window`, so we run it as a function body with a fake one. */
export function loadData() {
  const src = fs.readFileSync(path.join(ROOT, "shared/data.js"), "utf8");
  const win = {};
  new Function("window", src)(win);
  return win.Pop.data;
}

/** Game slugs from apps/*.html */
export function appSlugs() {
  return fs.readdirSync(path.join(ROOT, "apps"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\.html$/, ""));
}
