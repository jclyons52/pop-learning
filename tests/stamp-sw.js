// Recompute the digest of all precached files and write it into
// service-worker.js (ASSETS_HASH), so the offline cache name changes whenever
// any asset changes. Run after editing a precached file:
//   deno task stamp     (then bump VERSION if it's a meaningful release)
import fs from "node:fs";
import path from "node:path";
import { computeAssetsHash, readAssetsHash, ROOT } from "./lib.js";

const hash = computeAssetsHash();
const before = readAssetsHash();
const swPath = path.join(ROOT, "service-worker.js");
const sw = fs.readFileSync(swPath, "utf8");

if (!/var ASSETS_HASH = "[0-9a-f]*";/.test(sw)) {
  console.error("✗ stamp: could not find ASSETS_HASH in service-worker.js");
  Deno.exit(1);
}
fs.writeFileSync(swPath, sw.replace(/var ASSETS_HASH = "[0-9a-f]*";/, `var ASSETS_HASH = "${hash}";`));
console.log(
  before === hash ? `= ASSETS_HASH already current (${hash})` : `✓ stamped ASSETS_HASH ${before} -> ${hash}`,
);
