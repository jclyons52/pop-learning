"use strict";
/* Parse every inline <script> in every HTML page (and the shared JS files)
   so a syntax error can never reach the browser. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { ROOT } = require("./lib.js");

const htmlFiles = [];
for (const dir of ["apps", "."]) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (f.endsWith(".html")) htmlFiles.push(path.join(dir, f));
  }
}

let bad = 0, scripts = 0;
for (const rel of htmlFiles.sort()) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    scripts++;
    try { new vm.Script(m[1], { filename: rel }); }
    catch (e) { console.error(`✗ ${rel}: ${e.message}`); bad++; }
  }
}

// shared JS files compile as scripts too
for (const f of fs.readdirSync(path.join(ROOT, "shared"))) {
  if (!f.endsWith(".js")) continue;
  scripts++;
  try { new vm.Script(fs.readFileSync(path.join(ROOT, "shared", f), "utf8"), { filename: "shared/" + f }); }
  catch (e) { console.error(`✗ shared/${f}: ${e.message}`); bad++; }
}

if (bad) { console.error(`\n✗ syntax-check: ${bad} file(s) with errors`); process.exit(1); }
console.log(`✓ syntax-check: ${scripts} scripts across ${htmlFiles.length} pages + shared parse clean`);
