/* ===========================================================
   Pop Learning — daily plan (browser wrapper)
   Reads localStorage + Pop.progress, delegates all logic to
   PopPlanCore (shared/plan-core.js), writes results back.
   Loads after pop.js and plan-core.js. Exposes Pop.plan.
   =========================================================== */
(function (global) {
  "use strict";
  var Pop = global.Pop || (global.Pop = {});
  var Core = global.PopPlanCore;
  if (!Core) return;   // plan-core.js must load first

  function pad(n){ return n < 10 ? "0" + n : "" + n; }
  function today(){ var d = new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function load(key, def){ try { return JSON.parse(localStorage.getItem(key)) || def; } catch(e){ return def; } }
  function save(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

  function progress(){ return (Pop.progress && Pop.progress.all()) || {}; }
  function activity(){ return load("pop-activity", {}); }
  function overrides(){ return load("pop-stage", {}); }

  function state(){
    return { progress: progress(), activity: activity(), overrides: overrides(), today: today() };
  }

  function rawPlan(){
    var p = load("pop-plan", null);
    if (!p || p.date !== today() || !p.steps || !p.steps.length){
      p = Core.buildPlan(state());
      save("pop-plan", p);
    }
    return p;
  }

  function todayPlan(){ return Core.decoratePlan(rawPlan(), activity(), today()); }
  function completion(){
    var steps = todayPlan(), done = 0;
    steps.forEach(function(s){ if (s.done) done++; });
    return { done: done, total: steps.length };
  }
  function isDone(slug){ return Core.isDone(activity(), slug, today()); }
  function streak(){ return Core.streakValue(load("pop-streak", null), today()); }

  function checkComplete(){
    var c = completion(), t = today();
    if (c.total > 0 && c.done >= c.total){
      var res = Core.bumpStreak(load("pop-streak", null), t);
      if (res.bumped){ save("pop-streak", res.state); return { justCompleted:true, streak:res.state.count }; }
      return { justCompleted:false, streak:res.state.count, alreadyDone:true };
    }
    return { justCompleted:false, streak:streak() };
  }

  function stageInfo(){
    var s = state();
    return {
      reading: Core.stageInfoFor("reading", s.progress, s.activity, s.overrides, s.today),
      numbers: Core.stageInfoFor("numbers", s.progress, s.activity, s.overrides, s.today)
    };
  }
  function setStage(track, idxOrNull){
    var o = overrides();
    if (idxOrNull == null) delete o[track]; else o[track] = idxOrNull;
    save("pop-stage", o);
    save("pop-plan", {});   // force a fresh plan next read
  }

  Pop.plan = {
    today: todayPlan, completion: completion, isDone: isDone,
    streak: streak, checkComplete: checkComplete,
    stageInfo: stageInfo, setStage: setStage, stepsPerDay: Core.STEPS_PER_DAY
  };
})(window);
