import assert from "node:assert/strict";
import "../shared/plan-core.js"; // sets globalThis.PopPlanCore
const C = globalThis.PopPlanCore;

const TODAY = "2024-03-15";
const YDAY = C.shift(TODAY, -1);

/* a progress map where a recall game's gid is mastered */
function mastered(gid) {
  const o = {};
  o[gid] = {};
  "ABCDEFGHIJKL".split("").forEach((k) => {
    o[gid][k] = { seen: 3, right: 3 };
  }); // 36 seen, acc 1
  return o[gid];
}
/* activity object with a slug played on a given day */
function playedOn(map, slug, day) {
  map[day] = map[day] || {};
  map[day][slug] = 4;
  return map;
}

Deno.test("date helpers handle month boundaries", () => {
  assert.equal(C.shift("2024-01-31", 1), "2024-02-01");
  assert.equal(C.shift("2024-03-01", -1), "2024-02-29"); // leap year
  assert.equal(C.shift("2024-12-31", 1), "2025-01-01");
  assert.equal(C.daysBetween("2024-03-01", "2024-03-15"), 14);
  assert.equal(C.daysBetween("2024-02-28", "2024-03-01"), 2); // leap
});

Deno.test("rngFrom is deterministic for a given seed", () => {
  const a = C.rngFrom("seed"), b = C.rngFrom("seed");
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  const c = C.rngFrom("other");
  assert.notDeepEqual([c(), c(), c()], seqA);
  seqA.forEach((n) => assert.ok(n >= 0 && n < 1));
});

Deno.test("statsFor sums attempts and accuracy", () => {
  const p = { g: { A: { seen: 2, right: 1 }, B: { seen: 2, right: 2 } } };
  assert.deepEqual(C.statsFor(p, "g"), { seen: 4, right: 3, acc: 0.75 });
  assert.deepEqual(C.statsFor(p, null), { seen: 0, right: 0, acc: 0 });
});

Deno.test("isDone needs enough interactions today", () => {
  assert.equal(C.isDone({ [TODAY]: { "sound-match": C.DONE_HITS } }, "sound-match", TODAY), true);
  assert.equal(C.isDone({ [TODAY]: { "sound-match": 1 } }, "sound-match", TODAY), false);
  assert.equal(C.isDone({}, "sound-match", TODAY), false);
});

Deno.test("gameMastered: recall needs accuracy + attempts; flash needs a play", () => {
  assert.equal(C.gameMastered("sound-match", { "sound-match": mastered("sound-match") }, {}, TODAY), true);
  assert.equal(
    C.gameMastered("sound-match", { "sound-match": { A: { seen: 9, right: 9 } } }, {}, TODAY),
    false,
  );
  assert.equal(
    C.gameMastered("sound-match", { "sound-match": { A: { seen: 20, right: 10 } } }, {}, TODAY),
    false,
  );
  assert.equal(C.gameMastered("alphabet-pop", {}, playedOn({}, "alphabet-pop", YDAY), TODAY), true);
  assert.equal(C.gameMastered("alphabet-pop", {}, {}, TODAY), false);
});

Deno.test("stageIndex starts at 0 and advances when a stage is complete", () => {
  assert.equal(C.stageIndex("reading", {}, {}, {}, TODAY), 0);
  const progress = { "sound-match": mastered("sound-match"), "first-sounds": mastered("first-sounds") };
  const activity = {};
  playedOn(activity, "alphabet-pop", YDAY);
  playedOn(activity, "letter-trace", YDAY);
  assert.equal(C.stageIndex("reading", progress, activity, {}, TODAY), 1);
});

Deno.test("parent override pins the stage", () => {
  assert.equal(C.stageIndex("reading", {}, {}, { reading: 3 }, TODAY), 3);
  assert.equal(C.stageIndex("reading", {}, {}, { reading: 99 }, TODAY), C.READING.length - 1);
  assert.equal(C.stageIndex("numbers", {}, {}, { numbers: 2 }, TODAY), 2);
});

Deno.test("buildPlan returns 4 unique, valid steps with the right shape", () => {
  const plan = C.buildPlan({ progress: {}, activity: {}, overrides: {}, today: TODAY });
  assert.equal(plan.steps.length, C.STEPS_PER_DAY);
  const slugs = plan.steps.map((s) => s[0]);
  assert.equal(new Set(slugs).size, slugs.length, "no duplicate games");
  slugs.forEach((s) => assert.ok(C.GAMES[s], s + " is a real game"));
  assert.equal(plan.steps[0][1], "warmup");
  assert.equal(plan.steps[plan.steps.length - 1][1], "numbers");
  const numSlugs = C.NUMBERS.flatMap((s) => s.games);
  assert.ok(numSlugs.includes(slugs[slugs.length - 1]));
});

Deno.test("buildPlan is deterministic for the same day + state", () => {
  const st = { progress: {}, activity: {}, overrides: {}, today: TODAY };
  assert.deepEqual(C.buildPlan(st).steps, C.buildPlan(st).steps);
  assert.equal(
    C.buildPlan({ progress: {}, activity: {}, overrides: {}, today: "2024-07-09" }).steps.length,
    4,
  );
});

Deno.test("decoratePlan marks played steps done", () => {
  const plan = C.buildPlan({ progress: {}, activity: {}, overrides: {}, today: TODAY });
  const playedSlug = plan.steps[1][0];
  const view = C.decoratePlan(plan, { [TODAY]: { [playedSlug]: 5 } }, TODAY);
  assert.equal(view.length, 4);
  assert.equal(view[1].done, true);
  assert.equal(view[0].done, false);
  assert.equal(view[1].href, "apps/" + playedSlug + ".html");
  assert.ok(view[0].roleLabel && view[0].roleIcon);
});

Deno.test("streak grows on consecutive finishes and resets after a gap", () => {
  const s = C.bumpStreak({ last: null, count: 0 }, TODAY);
  assert.deepEqual(s, { state: { last: TODAY, count: 1 }, bumped: true });
  assert.equal(C.bumpStreak(s.state, TODAY).bumped, false);
  assert.equal(C.bumpStreak(s.state, C.shift(TODAY, 1)).state.count, 2);
  assert.equal(C.bumpStreak({ last: C.shift(TODAY, -3), count: 5 }, TODAY).state.count, 1);
});

Deno.test("streakValue hides a broken streak", () => {
  assert.equal(C.streakValue({ last: TODAY, count: 4 }, TODAY), 4);
  assert.equal(C.streakValue({ last: YDAY, count: 4 }, TODAY), 4);
  assert.equal(C.streakValue({ last: C.shift(TODAY, -2), count: 4 }, TODAY), 0);
  assert.equal(C.streakValue(null, TODAY), 0);
});

Deno.test("stageInfoFor reports auto vs overridden", () => {
  const auto = C.stageInfoFor("reading", {}, {}, {}, TODAY);
  assert.equal(auto.auto, true);
  assert.equal(auto.index, 0);
  assert.equal(auto.names.length, C.READING.length);
  const set = C.stageInfoFor("reading", {}, {}, { reading: 2 }, TODAY);
  assert.equal(set.auto, false);
  assert.equal(set.index, 2);
});
