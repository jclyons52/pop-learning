// Content + contract validator. Catches the regressions unit tests can't:
// malformed game data, a game missing from the plan or the offline cache, and a
// stale service-worker hash (the stale-cache bug). Exits non-zero on failure.
// Run: deno run --allow-read tests/validate.js
import "../shared/plan-core.js"; // sets globalThis.PopPlanCore
import { appSlugs, computeAssetsHash, loadData, parsePrecache, readAssetsHash } from "./lib.js";

const C = globalThis.PopPlanCore;
const errors = [];
const ok = (cond, msg) => {
  if (!cond) errors.push(msg);
};

/* ---------------- content integrity ---------------- */
const data = loadData();

ok(Array.isArray(data.letters) && data.letters.length === 26, "letters should have 26 entries");
data.letters.forEach((l, i) => {
  ok(/^[A-Z]$/.test(l[0]), `letters[${i}] first field should be one A–Z letter`);
  ok(l[1] && l[2], `letters[${i}] needs a word and an emoji`);
});

const cvcSeen = new Set();
data.cvc.forEach((w, i) => {
  ok(/^[a-z]{3}$/.test(w[0]), `cvc[${i}] "${w[0]}" should be 3 lowercase letters`);
  ok(!!w[1], `cvc[${i}] "${w[0]}" needs an emoji`);
  ok(!cvcSeen.has(w[0]), `cvc has a duplicate: "${w[0]}"`);
  cvcSeen.add(w[0]);
});

[["digraphs", 4], ["blends", 4], ["vowelTeams", 3]].forEach(([key, len]) => {
  data[key].forEach((row, i) => {
    ok(row.length >= len, `${key}[${i}] is malformed`);
    ok(/^[a-z]+$/.test(row[0]), `${key}[${i}] pattern "${row[0]}" should be lowercase letters`);
    ok(!!row[1] && !!row[2], `${key}[${i}] needs a word and an emoji`);
  });
});
// digraphs and blends carry a spoken-sound respelling in slot 3
[["digraphs"], ["blends"]].forEach(([key]) => {
  data[key].forEach((row, i) => ok(!!row[3], `${key}[${i}] "${row[0]}" needs a spoken sound`));
});

data.magicE.forEach((row, i) => {
  ok(row[1] === row[0] + "e", `magicE[${i}] "${row[1]}" should be "${row[0]}" + e`);
  ok(!!row[2], `magicE[${i}] needs an emoji`);
});

ok(
  data.phonicsCheck.some((w) => w.real) && data.phonicsCheck.some((w) => !w.real),
  "phonicsCheck needs both real and made-up words",
);
data.phonicsCheck.forEach((w, i) => {
  ok(/^[a-z]+$/.test(w.word), `phonicsCheck[${i}] "${w.word}" should be lowercase`);
  ok(typeof w.real === "boolean", `phonicsCheck[${i}] needs a boolean "real"`);
});

ok(Array.isArray(data.numberWords) && data.numberWords.length === 20, "numberWords should have 20 entries");
ok(data.countObjects.length >= 20, "countObjects should have at least 20 emoji");
data.sightSets.forEach((set, s) =>
  set.forEach((pair, i) => {
    ok(pair.length === 2 && pair[0] && pair[1], `sightSets[${s}][${i}] should be [word, sentence]`);
  })
);

/* ---------------- contract: games <-> files <-> plan <-> cache ---------------- */
const slugsOnDisk = appSlugs();
const slugsInPlan = Object.keys(C.GAMES);
const precache = parsePrecache();

slugsInPlan.forEach((slug) => {
  ok(slugsOnDisk.includes(slug), `plan references "${slug}" but apps/${slug}.html is missing`);
  ok(precache.includes(`apps/${slug}.html`), `apps/${slug}.html is not in the service-worker PRECACHE`);
});
slugsOnDisk.forEach((slug) => {
  ok(
    slugsInPlan.includes(slug),
    `apps/${slug}.html exists but isn't in the plan catalogue (plan-core GAMES)`,
  );
});

[
  "index.html",
  "parent.html",
  "manifest.webmanifest",
  "shared/pop.css",
  "shared/pop.js",
  "shared/data.js",
  "shared/plan-core.js",
  "shared/plan.js",
]
  .forEach((f) => ok(precache.includes(f), `${f} is not in the service-worker PRECACHE`));

C.READING.concat(C.NUMBERS).forEach((stage) =>
  stage.games.forEach((slug) => {
    ok(C.GAMES[slug], `stage "${stage.name}" lists unknown game "${slug}"`);
  })
);

/* ---------------- service-worker hash guard (kills the stale-cache bug) ---------------- */
const stamped = readAssetsHash();
const actual = computeAssetsHash();
ok(
  stamped === actual,
  `service-worker ASSETS_HASH is stale (have "${stamped}", assets hash to "${actual}"). ` +
    "A precached file changed — run `deno task stamp` (and bump VERSION) so the offline cache busts.",
);

/* ---------------- report ---------------- */
if (errors.length) {
  console.error("✗ validate: " + errors.length + " problem(s):\n");
  errors.forEach((e) => console.error("  • " + e));
  Deno.exit(1);
}
console.log(
  "✓ validate: content, contract and service-worker cache all consistent (" + slugsInPlan.length + " games).",
);
