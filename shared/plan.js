/* ===========================================================
   Pop Learning — the daily learning plan
   A short, adaptive, spaced daily session built from the games
   the child has, guided by a stage curriculum + her progress.
   Loads after pop.js (uses Pop.progress). Exposes Pop.plan.
   =========================================================== */
(function (global) {
  "use strict";
  var Pop = global.Pop || (global.Pop = {});

  var STEPS_PER_DAY = 4;     // ~10 minutes
  var DONE_HITS = 3;         // interactions in a game today = "played it"

  /* ---------- game catalogue ----------
     kind: "recall" (quiz, has accuracy via gid) | "flash" (exposure) | "build" */
  var GAMES = {
    "alphabet-pop":  { name:"Alphabet Pop",  gid:null,            kind:"flash" },
    "sound-match":   { name:"Sound Match",   gid:"sound-match",   kind:"recall" },
    "first-sounds":  { name:"First Sounds",  gid:"first-sounds",  kind:"recall" },
    "letter-trace":  { name:"Letter Trace",  gid:"trace",         kind:"build" },
    "sound-it-out":  { name:"Sound It Out",  gid:null,            kind:"flash" },
    "spell-it":      { name:"Spell It",      gid:"spell",         kind:"recall" },
    "word-families": { name:"Word Families", gid:null,            kind:"flash" },
    "rhyme-time":    { name:"Rhyme Time",    gid:"rhyme",         kind:"recall" },
    "magic-e":       { name:"Magic e",       gid:null,            kind:"flash" },
    "sentence-pop":  { name:"Sentence Pop",  gid:null,            kind:"flash" },
    "sight-words":   { name:"Sight Words",   gid:null,            kind:"flash" },
    "digraphs":      { name:"Digraphs",      gid:null,            kind:"flash" },
    "blends":        { name:"Blends",        gid:null,            kind:"flash" },
    "vowel-teams":   { name:"Vowel Teams",   gid:null,            kind:"flash" },
    "story-pop":     { name:"Story Pop",     gid:"story",         kind:"recall" },
    "speed-words":   { name:"Speed Words",   gid:"speed",         kind:"recall" },
    "phonics-check": { name:"Phonics Check", gid:"phonics-check", kind:"recall" },
    "counting-pop":  { name:"Counting Pop",  gid:null,            kind:"flash" },
    "quick-count":   { name:"Quick Count",   gid:"subitise",      kind:"recall" },
    "make-ten":      { name:"Make Ten",      gid:"bonds",         kind:"recall" },
    "add-take":      { name:"Add & Take",    gid:"addtake",       kind:"recall" },
    "skip-count":    { name:"Skip Count",    gid:"skip",          kind:"recall" },
    "shapes":        { name:"Shape Pop",     gid:"shapes",        kind:"recall" }
  };

  var READING = [
    { name:"Sounds & Letters", games:["alphabet-pop","sound-match","first-sounds","letter-trace"] },
    { name:"Blending Words",   games:["sound-it-out","spell-it","word-families","rhyme-time"] },
    { name:"First Reading",    games:["sentence-pop","sight-words"] },
    { name:"Letter Patterns",  games:["digraphs","blends","magic-e","vowel-teams"] },
    { name:"Reading & Fluency",games:["story-pop","speed-words","phonics-check"] }
  ];
  var NUMBERS = [
    { name:"Counting",          games:["counting-pop","quick-count"] },
    { name:"Adding & Bonds",    games:["make-ten","add-take"] },
    { name:"Patterns & Shapes", games:["skip-count","shapes"] }
  ];

  /* ---------- date + storage helpers ---------- */
  function pad(n){ return n < 10 ? "0" + n : "" + n; }
  function dstr(d){ return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
  function today(){ return dstr(new Date()); }
  function shift(dateStr, days){ var d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate()+days); return dstr(d); }
  function daysBetween(a, b){ return Math.round((Date.parse(b+"T00:00:00") - Date.parse(a+"T00:00:00")) / 86400000); }
  function load(key, def){ try { return JSON.parse(localStorage.getItem(key)) || def; } catch(e){ return def; } }
  function save(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

  function activity(){ return load("pop-activity", {}); }     // { date: { slug: hits } }
  function hitsToday(slug){ var a = activity()[today()] || {}; return a[slug] || 0; }
  function isDone(slug){ return hitsToday(slug) >= DONE_HITS; }
  function lastPlayed(slug){
    var a = activity(), best = null;
    for (var d in a) if (a[d][slug] && (!best || d > best)) best = d;
    return best;
  }
  function daysSince(slug){ var lp = lastPlayed(slug); return lp ? daysBetween(lp, today()) : 999; }
  function daysPlayed(slug){ var a = activity(), n = 0; for (var d in a) if (a[d][slug]) n++; return n; }

  /* ---------- mastery ---------- */
  function stats(gid){
    if (!gid || !Pop.progress) return { seen:0, right:0, acc:0 };
    var g = (Pop.progress.all()[gid]) || {}, seen=0, right=0;
    for (var k in g){ seen += g[k].seen||0; right += g[k].right||0; }
    return { seen:seen, right:right, acc: seen ? right/seen : 0 };
  }
  function gameMastered(slug){
    var g = GAMES[slug];
    if (g.kind === "recall"){ var s = stats(g.gid); return s.seen >= 10 && s.acc >= 0.75; }
    return daysPlayed(slug) >= 1;   // flash/build: a bit of exposure
  }
  function stageComplete(stage){
    for (var i=0;i<stage.games.length;i++) if (!gameMastered(stage.games[i])) return false;
    return true;
  }

  /* ---------- current stage (auto, with parent override) ---------- */
  function overrides(){ return load("pop-stage", {}); }
  function stageIndex(track){
    var stages = track === "numbers" ? NUMBERS : READING;
    var ov = overrides()[track];
    if (ov != null) return Math.max(0, Math.min(ov, stages.length-1));
    for (var i=0;i<stages.length;i++) if (!stageComplete(stages[i])) return i;
    return stages.length - 1;
  }
  function setStage(track, idxOrNull){
    var o = overrides();
    if (idxOrNull == null) delete o[track]; else o[track] = idxOrNull;
    save("pop-stage", o);
    save("pop-plan", {});   // force a fresh plan
  }

  /* ---------- deterministic per-day RNG ---------- */
  function rngFrom(seed){
    var h = 2166136261;
    for (var i=0;i<seed.length;i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function(){ h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ (t>>>15), t|1);
      t ^= t + Math.imul(t ^ (t>>>7), t|61); return ((t ^ (t>>>14)) >>> 0) / 4294967296; };
  }
  // priority for spaced review: longer since played + shakier + small jitter
  function dueScore(slug, rng){
    var g = GAMES[slug], shaky = 0;
    if (g.kind === "recall"){ var s = stats(g.gid); shaky = s.seen ? (1 - s.acc) : 0.5; }
    else shaky = 0.4;
    return daysSince(slug) + shaky * 2 + rng() * 0.6;
  }
  function pickDue(pool, used, rng){
    var best = null, bestScore = -1;
    for (var i=0;i<pool.length;i++){
      var slug = pool[i];
      if (used[slug] || !GAMES[slug]) continue;
      var sc = dueScore(slug, rng);
      if (sc > bestScore){ bestScore = sc; best = slug; }
    }
    return best;
  }

  /* ---------- build today's 4-step plan (cached per day) ---------- */
  function buildPlan(){
    var rng = rngFrom(today());
    var ri = stageIndex("reading"), ni = stageIndex("numbers");
    var cur = READING[ri], prev = READING[ri-1] || null, next = READING[ri+1] || null;
    var num = NUMBERS[ni];
    var used = {}, steps = [];

    function add(role, slug){ if (slug){ used[slug] = true; steps.push({ slug:slug, role:role }); } }

    // 1) warm-up — a confidence win from earlier work (or an easy current game)
    add("warmup", pickDue(prev ? prev.games : cur.games, used, rng));
    // 2) focus — current stage, prefer an active-recall game
    var recall = cur.games.filter(function(s){ return GAMES[s].kind === "recall"; });
    add("focus", pickDue(recall.length ? recall : cur.games, used, rng));
    // 3) focus or stretch — another current-stage game; ~1 day in 3, peek at the next stage
    if (next && rng() < 0.34) add("stretch", pickDue(next.games, used, rng));
    else add("focus", pickDue(cur.games, used, rng));
    // 4) numbers — keep numeracy ticking over
    add("numbers", pickDue(num.games, used, rng));

    // backfill if any pool came up short, so we always have 4 steps
    var all = READING.concat(NUMBERS).reduce(function(a,s){ return a.concat(s.games); }, []);
    while (steps.length < STEPS_PER_DAY){
      var s = pickDue(all, used, rng); if (!s) break; add("focus", s);
    }
    return { date: today(), steps: steps.map(function(x){ return [x.slug, x.role]; }) };
  }

  function todayPlan(){
    var p = load("pop-plan", null);
    if (!p || p.date !== today() || !p.steps || !p.steps.length){ p = buildPlan(); save("pop-plan", p); }
    var ROLES = {
      warmup:  { label:"Warm-up", icon:"⭐" },
      focus:   { label:"Focus",   icon:"🎯" },
      stretch: { label:"Stretch", icon:"🚀" },
      numbers: { label:"Numbers", icon:"🔢" }
    };
    return p.steps.map(function(s){
      var slug = s[0], role = s[1], g = GAMES[slug] || { name: slug };
      return { slug:slug, name:g.name, href:"apps/"+slug+".html",
        role:role, roleLabel:(ROLES[role]||{}).label || role, roleIcon:(ROLES[role]||{}).icon || "•",
        done:isDone(slug) };
    });
  }
  function completion(){
    var p = todayPlan(), done = 0;
    p.forEach(function(s){ if (s.done) done++; });
    return { done:done, total:p.length };
  }

  /* ---------- streak (gentle; grows when the plan is finished) ---------- */
  function streakObj(){ return load("pop-streak", { last:null, count:0 }); }
  function streak(){
    var s = streakObj();
    if (!s.last) return 0;
    if (s.last === today() || s.last === shift(today(), -1)) return s.count || 0;
    return 0;   // a broken streak reads as 0 until the next finished plan
  }
  // call on the hub: updates the streak the first time the plan is completed today
  function checkComplete(){
    var c = completion(), s = streakObj(), t = today();
    if (c.total > 0 && c.done >= c.total){
      if (s.last !== t){
        s.count = (s.last === shift(t,-1)) ? (s.count||0)+1 : 1;
        s.last = t; save("pop-streak", s);
        return { justCompleted:true, streak:s.count };
      }
      return { justCompleted:false, streak:s.count, alreadyDone:true };
    }
    return { justCompleted:false, streak:streak() };
  }

  function stageInfo(){
    return {
      reading: { index:stageIndex("reading"), name:READING[stageIndex("reading")].name,
                 auto: overrides().reading == null, count:READING.length, names:READING.map(function(s){return s.name;}) },
      numbers: { index:stageIndex("numbers"), name:NUMBERS[stageIndex("numbers")].name,
                 auto: overrides().numbers == null, count:NUMBERS.length, names:NUMBERS.map(function(s){return s.name;}) }
    };
  }

  Pop.plan = {
    today: todayPlan, completion: completion, isDone: isDone,
    streak: streak, checkComplete: checkComplete,
    stageInfo: stageInfo, setStage: setStage, stepsPerDay: STEPS_PER_DAY
  };
})(window);
