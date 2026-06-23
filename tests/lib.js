"use strict";
/* Shared helpers for the validator + the SW stamper. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

/** Parse the PRECACHE list out of service-worker.js. */
function parsePrecache() {
  const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const m = sw.match(/var PRECACHE = \[([\s\S]*?)\];/);
  if (!m) throw new Error("Could not find PRECACHE array in service-worker.js");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** Read the stamped ASSETS_HASH from service-worker.js. */
function readAssetsHash() {
  const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const m = sw.match(/var ASSETS_HASH = "([0-9a-f]+)"/);
  return m ? m[1] : null;
}

/** Digest of every precached file's contents (service-worker.js is not precached,
    so there's no chicken-and-egg). Throws if a precached file is missing. */
function computeAssetsHash() {
  const files = parsePrecache().filter((p) => p !== "./").sort();
  const h = crypto.createHash("sha256");
  for (const f of files) {
    h.update(f + "\0");
    h.update(fs.readFileSync(path.join(ROOT, f)));
  }
  return h.digest("hex").slice(0, 10);
}

/** Load shared/data.js in a sandbox and return Pop.data. */
function loadData() {
  const src = fs.readFileSync(path.join(ROOT, "shared/data.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.Pop.data;
}

/** List of game slugs from apps/*.html */
function appSlugs() {
  return fs.readdirSync(path.join(ROOT, "apps"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\.html$/, ""));
}

module.exports = { ROOT, parsePrecache, readAssetsHash, computeAssetsHash, loadData, appSlugs };
