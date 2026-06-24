// Parse every inline <script> in every HTML page (and the shared JS files) so a
// syntax error can never reach the browser. Run: deno run --allow-read tests/syntax-check.js
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.ts";

const htmlFiles: string[] = [];
for (const dir of ["apps", "."]) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (f.endsWith(".html")) htmlFiles.push(path.join(dir, f));
  }
}

let bad = 0, scripts = 0;
const compile = (code, where) => {
  scripts++;
  try {
    new Function(code); // compiles the body; throws on a syntax error
  } catch (e) {
    console.error(`✗ ${where}: ${(e as Error).message}`);
    bad++;
  }
};

for (const rel of htmlFiles.sort()) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) compile(m[1], rel);
}
for (const f of fs.readdirSync(path.join(ROOT, "shared"))) {
  if (f.endsWith(".js")) compile(fs.readFileSync(path.join(ROOT, "shared", f), "utf8"), "shared/" + f);
}

if (bad) {
  console.error(`\n✗ syntax-check: ${bad} file(s) with errors`);
  Deno.exit(1);
}
console.log(`✓ syntax-check: ${scripts} scripts across ${htmlFiles.length} pages + shared parse clean`);
