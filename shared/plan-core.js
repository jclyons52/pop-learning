// @ts-check
/* ===========================================================
   Pop Learning — pure planning logic
   No DOM, no storage, no Date.now: every function takes the
   state it needs. This is what the unit tests exercise.
   Loaded in the browser (sets window.PopPlanCore) and required
   by Node tests (module.exports).
   =========================================================== */

/** @typedef {{ seen:number, right:number }} ItemStat */
/** @typedef {Record<string, Record<string, ItemStat>>} ProgressMap */
/** @typedef {Record<string, Record<string, number>>} ActivityMap  date -> slug -> hits */
/** @typedef {Record<string, number|null|undefined>} Overrides */
/** @typedef {{ name:string, games:string[] }} Stage */
/** @typedef {'recall'|'flash'|'build'} GameKind */
/** @typedef {{ name:string, gid:(string|null), kind:GameKind }} Game */
/** @typedef {{ last:(string|null), count:number }} StreakState */
/** @typedef {{ date:string, steps:Array<[string,string]> }} Plan */
/** @typedef {{ progress:ProgressMap, activity:ActivityMap, overrides:Overrides, today:string, rng?:(()=>number) }} PlanState */

(function () {
  "use strict";

  var STEPS_PER_DAY = 4; // ~10 minutes
  var DONE_HITS = 3; // interactions in a game today = "played it"
  var MASTER_SEEN = 10; // recall game: attempts before mastery counts
  var MASTER_ACC = 0.75; // recall game: accuracy for mastery

  /** @type {Record<string, Game>} */
  var GAMES = {
    "alphabet-pop": { name: "Alphabet Pop", gid: null, kind: "flash" },
    "sound-match": { name: "Sound Match", gid: "sound-match", kind: "recall" },
    "first-sounds": { name: "First Sounds", gid: "first-sounds", kind: "recall" },
    "letter-trace": { name: "Letter Trace", gid: "trace", kind: "build" },
    "sound-it-out": { name: "Sound It Out", gid: null, kind: "flash" },
    "spell-it": { name: "Spell It", gid: "spell", kind: "recall" },
    "word-families": { name: "Word Families", gid: null, kind: "flash" },
    "rhyme-time": { name: "Rhyme Time", gid: "rhyme", kind: "recall" },
    "magic-e": { name: "Magic e", gid: null, kind: "flash" },
    "sentence-pop": { name: "Sentence Pop", gid: null, kind: "flash" },
    "sight-words": { name: "Sight Words", gid: null, kind: "flash" },
    "digraphs": { name: "Digraphs", gid: null, kind: "flash" },
    "blends": { name: "Blends", gid: null, kind: "flash" },
    "vowel-teams": { name: "Vowel Teams", gid: null, kind: "flash" },
    "story-pop": { name: "Story Pop", gid: "story", kind: "recall" },
    "speed-words": { name: "Speed Words", gid: "speed", kind: "recall" },
    "phonics-check": { name: "Phonics Check", gid: "phonics-check", kind: "recall" },
    "counting-pop": { name: "Counting Pop", gid: null, kind: "flash" },
    "quick-count": { name: "Quick Count", gid: "subitise", kind: "recall" },
    "make-ten": { name: "Make Ten", gid: "bonds", kind: "recall" },
    "add-take": { name: "Add & Take", gid: "addtake", kind: "recall" },
    "skip-count": { name: "Skip Count", gid: "skip", kind: "recall" },
    "shapes": { name: "Shape Pop", gid: "shapes", kind: "recall" },
  };

  /** @type {Stage[]} */
  var READING = [
    { name: "Sounds & Letters", games: ["alphabet-pop", "sound-match", "first-sounds", "letter-trace"] },
    { name: "Blending Words", games: ["sound-it-out", "spell-it", "word-families", "rhyme-time"] },
    { name: "First Reading", games: ["sentence-pop", "sight-words"] },
    { name: "Letter Patterns", games: ["digraphs", "blends", "magic-e", "vowel-teams"] },
    { name: "Reading & Fluency", games: ["story-pop", "speed-words", "phonics-check"] },
  ];
  /** @type {Stage[]} */
  var NUMBERS = [
    { name: "Counting", games: ["counting-pop", "quick-count"] },
    { name: "Adding & Bonds", games: ["make-ten", "add-take"] },
    { name: "Patterns & Shapes", games: ["skip-count", "shapes"] },
  ];

  /** @type {Record<string,{label:string,icon:string}>} */
  var ROLES = {
    warmup: { label: "Warm-up", icon: "⭐" },
    focus: { label: "Focus", icon: "🎯" },
    stretch: { label: "Stretch", icon: "🚀" },
    numbers: { label: "Numbers", icon: "🔢" },
  };

  /* ---------- date helpers (string in, string out) ---------- */
  /** @param {number} n */
  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  /** @param {Date} d */
  function fmt(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  /** @param {string} dateStr @param {number} days @returns {string} */
  function shift(dateStr, days) {
    var d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return fmt(d);
  }
  /** @param {string} a @param {string} b @returns {number} */
  function daysBetween(a, b) {
    return Math.round((Date.parse(b + "T00:00:00") - Date.parse(a + "T00:00:00")) / 86400000);
  }

  /* ---------- progress + activity reads (pure) ---------- */
  /** @param {ProgressMap} progress @param {string|null} gid @returns {{seen:number,right:number,acc:number}} */
  function statsFor(progress, gid) {
    if (!gid) return { seen: 0, right: 0, acc: 0 };
    var g = progress[gid] || {}, seen = 0, right = 0;
    for (var k in g) {
      seen += g[k].seen || 0;
      right += g[k].right || 0;
    }
    return { seen: seen, right: right, acc: seen ? right / seen : 0 };
  }
  /** @param {ActivityMap} activity @param {string} slug @returns {string|null} */
  function lastPlayed(activity, slug) {
    var best = null;
    for (var d in activity) if (activity[d][slug] && (!best || d > best)) best = d;
    return best;
  }
  /** @param {ActivityMap} activity @param {string} slug @param {string} today */
  function daysSince(activity, slug, today) {
    var lp = lastPlayed(activity, slug);
    return lp ? daysBetween(lp, today) : 999;
  }
  /** @param {ActivityMap} activity @param {string} slug */
  function daysPlayed(activity, slug) {
    var n = 0;
    for (var d in activity) if (activity[d][slug]) n++;
    return n;
  }
  /** @param {ActivityMap} activity @param {string} slug @param {string} today */
  function isDone(activity, slug, today) {
    var a = activity[today] || {};
    return (a[slug] || 0) >= DONE_HITS;
  }

  /* ---------- mastery + stage ---------- */
  /** @param {string} slug @param {ProgressMap} progress @param {ActivityMap} activity @param {string} today */
  function gameMastered(slug, progress, activity, today) {
    var g = GAMES[slug];
    if (!g) return false;
    if (g.kind === "recall") {
      var s = statsFor(progress, g.gid);
      return s.seen >= MASTER_SEEN && s.acc >= MASTER_ACC;
    }
    return daysPlayed(activity, slug) >= 1;
  }
  /** @param {Stage} stage @param {ProgressMap} progress @param {ActivityMap} activity @param {string} today */
  function stageComplete(stage, progress, activity, today) {
    for (var i = 0; i < stage.games.length; i++) {
      if (!gameMastered(stage.games[i], progress, activity, today)) return false;
    }
    return true;
  }
  /** @param {('reading'|'numbers')} track @param {ProgressMap} progress @param {ActivityMap} activity @param {Overrides} overrides @param {string} today @returns {number} */
  function stageIndex(track, progress, activity, overrides, today) {
    var stages = track === "numbers" ? NUMBERS : READING;
    var ov = overrides ? overrides[track] : null;
    if (ov != null) return Math.max(0, Math.min(ov, stages.length - 1));
    for (var i = 0; i < stages.length; i++) {
      if (!stageComplete(stages[i], progress, activity, today)) return i;
    }
    return stages.length - 1;
  }

  /* ---------- deterministic RNG + spaced-review selection ---------- */
  /** @param {string} seed @returns {()=>number} */
  function rngFrom(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h += 0x6D2B79F5;
      var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** @param {string} slug @param {ProgressMap} progress @param {ActivityMap} activity @param {string} today @param {()=>number} rng */
  function dueScore(slug, progress, activity, today, rng) {
    var g = GAMES[slug], shaky = 0.4;
    if (g && g.kind === "recall") {
      var s = statsFor(progress, g.gid);
      shaky = s.seen ? (1 - s.acc) : 0.5;
    }
    return daysSince(activity, slug, today) + shaky * 2 + rng() * 0.6;
  }
  /** @param {string[]} pool @param {Record<string,boolean>} used @param {ProgressMap} progress @param {ActivityMap} activity @param {string} today @param {()=>number} rng @returns {string|null} */
  function pickDue(pool, used, progress, activity, today, rng) {
    var best = null, bestScore = -1;
    for (var i = 0; i < pool.length; i++) {
      var slug = pool[i];
      if (used[slug] || !GAMES[slug]) continue;
      var sc = dueScore(slug, progress, activity, today, rng);
      if (sc > bestScore) {
        bestScore = sc;
        best = slug;
      }
    }
    return best;
  }

  /* ---------- build the day's plan ---------- */
  /** @param {PlanState} state @returns {Plan} */
  function buildPlan(state) {
    var progress = state.progress,
      activity = state.activity,
      overrides = state.overrides,
      today = state.today;
    var rng = state.rng || rngFrom(today);
    var ri = stageIndex("reading", progress, activity, overrides, today);
    var ni = stageIndex("numbers", progress, activity, overrides, today);
    var cur = READING[ri], prev = READING[ri - 1] || null, next = READING[ri + 1] || null, num = NUMBERS[ni];
    /** @type {Record<string,boolean>} */
    var used = {};
    /** @type {Array<[string,string]>} */
    var steps = [];
    /** @param {string} role @param {string|null} slug */
    function add(role, slug) {
      if (slug) {
        used[slug] = true;
        steps.push([slug, role]);
      }
    }

    add("warmup", pickDue(prev ? prev.games : cur.games, used, progress, activity, today, rng));
    var recall = cur.games.filter(function (s) {
      return GAMES[s].kind === "recall";
    });
    add("focus", pickDue(recall.length ? recall : cur.games, used, progress, activity, today, rng));
    if (next && rng() < 0.34) add("stretch", pickDue(next.games, used, progress, activity, today, rng));
    else add("focus", pickDue(cur.games, used, progress, activity, today, rng));
    add("numbers", pickDue(num.games, used, progress, activity, today, rng));

    /** @type {string[]} */
    var all = READING.concat(NUMBERS).reduce(function (a, s) {
      return a.concat(s.games);
    }, /** @type {string[]} */ ([]));
    while (steps.length < STEPS_PER_DAY) {
      var s = pickDue(all, used, progress, activity, today, rng);
      if (!s) break;
      add("focus", s);
    }
    return { date: today, steps: steps };
  }

  /** @param {Plan} plan @param {ActivityMap} activity @param {string} today */
  function decoratePlan(plan, activity, today) {
    return plan.steps.map(function (p) {
      var slug = p[0], role = p[1], g = GAMES[slug];
      var r = ROLES[role] || { label: role, icon: "•" };
      return {
        slug: slug,
        name: g ? g.name : slug,
        href: "apps/" + slug + ".html",
        role: role,
        roleLabel: r.label,
        roleIcon: r.icon,
        done: isDone(activity, slug, today),
      };
    });
  }

  /* ---------- streak ---------- */
  /** @param {StreakState|null} streak @param {string} today @returns {number} */
  function streakValue(streak, today) {
    if (!streak || !streak.last) return 0;
    if (streak.last === today || streak.last === shift(today, -1)) return streak.count || 0;
    return 0; // a broken streak reads as 0 until the next finished plan
  }
  /** When the plan is finished, advance the streak (idempotent per day).
      @param {StreakState|null} streak @param {string} today @returns {{state:StreakState, bumped:boolean}} */
  function bumpStreak(streak, today) {
    /** @type {StreakState} */
    var s = { last: (streak && streak.last) || null, count: (streak && streak.count) || 0 };
    if (s.last === today) return { state: s, bumped: false };
    s.count = (s.last === shift(today, -1)) ? s.count + 1 : 1;
    s.last = today;
    return { state: s, bumped: true };
  }

  /** @param {('reading'|'numbers')} track @param {ProgressMap} progress @param {ActivityMap} activity @param {Overrides} overrides @param {string} today */
  function stageInfoFor(track, progress, activity, overrides, today) {
    var stages = track === "numbers" ? NUMBERS : READING;
    var idx = stageIndex(track, progress, activity, overrides, today);
    return {
      index: idx,
      name: stages[idx].name,
      auto: !overrides || overrides[track] == null,
      count: stages.length,
      names: stages.map(function (s) {
        return s.name;
      }),
    };
  }

  var api = {
    STEPS_PER_DAY: STEPS_PER_DAY,
    DONE_HITS: DONE_HITS,
    MASTER_SEEN: MASTER_SEEN,
    MASTER_ACC: MASTER_ACC,
    GAMES: GAMES,
    READING: READING,
    NUMBERS: NUMBERS,
    ROLES: ROLES,
    shift: shift,
    daysBetween: daysBetween,
    statsFor: statsFor,
    lastPlayed: lastPlayed,
    daysSince: daysSince,
    daysPlayed: daysPlayed,
    isDone: isDone,
    gameMastered: gameMastered,
    stageComplete: stageComplete,
    stageIndex: stageIndex,
    rngFrom: rngFrom,
    dueScore: dueScore,
    pickDue: pickDue,
    buildPlan: buildPlan,
    decoratePlan: decoratePlan,
    streakValue: streakValue,
    bumpStreak: bumpStreak,
    stageInfoFor: stageInfoFor,
  };

  /** @type {any} */ (globalThis).PopPlanCore = api;
  // @ts-ignore - CommonJS export for Node tests (module is undefined in the browser)
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
