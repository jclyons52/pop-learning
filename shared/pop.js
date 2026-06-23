/* ===========================================================
   Pop Learning — shared core
   Speech, sparkles, helpers + PWA wiring used by every app.
   =========================================================== */
(function (global) {
  "use strict";

  // Resolve the repo root from this script's own URL (shared/ is one level down).
  var scriptURL = (document.currentScript && document.currentScript.src) || "";
  var ROOT = scriptURL ? new URL("../", scriptURL) : new URL("./", location.href);

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    return n;
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* crayon-box palette: [face, darker bottom edge] */
  var COLORS = [
    ["#FA5252", "#D23B3B"], ["#FF922B", "#DC6B0E"], ["#F0A500", "#C98700"],
    ["#37B24D", "#2B8A3E"], ["#12B886", "#0C8F6A"], ["#3B9DF0", "#1C7FD6"],
    ["#845EF7", "#6741D9"], ["#F368B0", "#D14B92"], ["#20A4F3", "#1184CF"],
    ["#FF6B6B", "#E04B4B"]
  ];
  function color(i) { return COLORS[((i % COLORS.length) + COLORS.length) % COLORS.length]; }

  /* ---------- sound state (shared across apps) ---------- */
  var soundOn = true;
  try { soundOn = localStorage.getItem("pop-sound") !== "off"; } catch (e) {}
  function setSound(on) {
    soundOn = !!on;
    try { localStorage.setItem("pop-sound", soundOn ? "on" : "off"); } catch (e) {}
    if (!soundOn) cancel();
  }
  function getSound() { return soundOn; }

  /* ---------- progress store (per-game, per-item mastery) ----------
     Lightweight localStorage record so a future parent view can show
     exactly which letters/words/sounds are sticking. Best-effort. */
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem("pop-progress") || "{}"); }
    catch (e) { return {}; }
  }
  function recordProgress(game, key, correct) {
    try {
      var p = loadProgress();
      p[game] = p[game] || {};
      var e = p[game][key] || { seen: 0, right: 0 };
      e.seen++; if (correct) e.right++;
      p[game][key] = e;
      localStorage.setItem("pop-progress", JSON.stringify(p));
    } catch (e) {}
  }
  function totalCorrect() {
    var p = loadProgress(), n = 0;
    for (var g in p) for (var k in p[g]) n += (p[g][k].right || 0);
    return n;
  }
  function resetProgress() { try { localStorage.removeItem("pop-progress"); } catch (e) {} }

  /* ---------- rewards: a sticker for every few correct answers ---------- */
  var STICKERS = ["🌟","🦄","🐶","🍦","🚀","🌈","🦖","⚽","🦋","🍩",
    "🐳","🎈","🏆","🐥","🌻","🦊","🍓","🎸","🐢","👑","🍉","🐬","🌼","🚂"];
  var PER_STICKER = 5;
  function stickersEarned() {
    var n = Math.floor(totalCorrect() / PER_STICKER);
    return STICKERS.slice(0, Math.min(n, STICKERS.length));
  }

  /* ---------- speech & voice selection ---------- */
  var voice = null;
  var savedVoiceName = null;
  try { savedVoiceName = localStorage.getItem("pop-voice"); } catch (e) {}

  // Apple "novelty" voices we never want to default to.
  var SILLY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|organ|pipe organ|ralph|fred|superstar|trinoids|whisper|wobble|zarvox|wishing well)/i;

  function scoreVoice(v) {
    var s = 0, n = v.name || "", lang = v.lang || "";
    if (/en[-_]AU/i.test(lang)) s += 50;
    else if (/en[-_]GB/i.test(lang)) s += 42;
    else if (/en[-_]NZ/i.test(lang)) s += 30;
    else if (/en[-_]IE/i.test(lang)) s += 24;
    else if (/^en/i.test(lang)) s += 12;
    if (/premium/i.test(n)) s += 60;
    if (/enhanced/i.test(n)) s += 52;
    if (/neural|natural/i.test(n)) s += 52;
    if (/siri/i.test(n)) s += 46;
    if (/google/i.test(n)) s += 40;
    if (/microsoft/i.test(n)) s += 22;
    if (SILLY.test(n)) s -= 200;
    return s;
  }

  function englishVoices() {
    if (!("speechSynthesis" in window)) return [];
    var vs = speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
    return vs.sort(function (a, b) { return scoreVoice(b) - scoreVoice(a); });
  }

  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    var vs = speechSynthesis.getVoices();
    var byName = savedVoiceName && vs.filter(function (v) { return v.name === savedVoiceName; })[0];
    voice = byName || englishVoices()[0] || vs[0] || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = function () { pickVoice(); if (voiceListEl) renderVoiceList(); };
  }
  function setVoiceName(name) {
    savedVoiceName = name;
    try { localStorage.setItem("pop-voice", name); } catch (e) {}
    pickVoice();
  }
  function currentVoiceName() { return voice ? voice.name : null; }
  function cancel() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }

  function utter(text, opts) {
    opts = opts || {};
    var u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : "en-AU";
    u.rate = opts.rate || 0.85;
    u.pitch = opts.pitch == null ? 1.12 : opts.pitch;
    return u;
  }
  function speak(text, opts) {
    if (!soundOn || !("speechSynthesis" in window) || !text) return;
    cancel();
    speechSynthesis.speak(utter(text, opts));
  }
  /* Play a sample of the current voice — bypasses the mute toggle so it
     can always be previewed from the voice picker. */
  function sampleVoice() {
    if (!("speechSynthesis" in window)) return;
    cancel();
    speechSynthesis.speak(utter("Hi! I'm your reading helper. The cat sat on the mat.", { rate: 0.9 }));
  }
  /* Speak a list of parts in order, with optional gaps — used for blending.
     parts: [{ text, rate, pitch, gap }]   (gap = ms pause after the part) */
  function speakSeq(parts) {
    if (!soundOn || !("speechSynthesis" in window) || !parts.length) return;
    cancel();
    var i = 0;
    function next() {
      if (i >= parts.length || !soundOn) return;
      var p = parts[i++];
      var u = utter(p.text, p);
      u.onend = function () {
        if (p.gap) setTimeout(next, p.gap); else next();
      };
      // guard: if onend never fires, keep things moving
      speechSynthesis.speak(u);
    }
    next();
  }

  /* ---------- sparkle confetti ---------- */
  function sparkle(target) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var r = (target || document.body).getBoundingClientRect();
    var icons = ["⭐", "✨", "🌟", "💫"];
    for (var i = 0; i < 6; i++) {
      var s = el("span", { "class": "spark", text: icons[i % icons.length] });
      s.style.left = (r.left + r.width * (0.2 + Math.random() * 0.6)) + "px";
      s.style.top = (r.top + r.height * 0.25) + "px";
      s.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
      s.style.setProperty("--rot", (Math.random() * 180 - 90) + "deg");
      document.body.appendChild(s);
      (function (node) { setTimeout(function () { node.remove(); }, 950); })(s);
    }
  }

  /* ---------- keyboard helpers ---------- */
  function onArrows(prev, next, say) {
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === " " || e.key === "Enter") {
        if (document.activeElement && document.activeElement.tagName === "BUTTON" &&
            !document.activeElement.classList.contains("card")) return;
        e.preventDefault(); if (say) say();
      }
    });
  }

  /* ---------- PWA wiring (manifest + icons + service worker) ---------- */
  function wirePWA() {
    var head = document.head;
    function ensure(sel, make) { if (!document.querySelector(sel)) head.appendChild(make()); }
    ensure('link[rel="manifest"]', function () {
      return el("link", { rel: "manifest", href: new URL("manifest.webmanifest", ROOT).href });
    });
    ensure('meta[name="theme-color"]', function () {
      return el("meta", { name: "theme-color", content: "#FA5252" });
    });
    ensure('link[rel="apple-touch-icon"]', function () {
      return el("link", { rel: "apple-touch-icon", href: new URL("icons/icon-180.png", ROOT).href });
    });
    ensure('meta[name="apple-mobile-web-app-capable"]', function () {
      return el("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    });
    ensure('meta[name="apple-mobile-web-app-status-bar-style"]', function () {
      return el("meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" });
    });
    ensure('meta[name="apple-mobile-web-app-title"]', function () {
      return el("meta", { name: "apple-mobile-web-app-title", content: "Pop Learning" });
    });

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register(
          new URL("service-worker.js", ROOT).href,
          { scope: ROOT.pathname }
        ).catch(function () { /* offline support is best-effort */ });
      });
    }
  }
  wirePWA();

  /* ---------- voice picker UI (shared across every app) ---------- */
  var voiceListEl = null, modalEl = null;

  function renderVoiceList() {
    if (!voiceListEl) return;
    var list = englishVoices(), cur = currentVoiceName();
    voiceListEl.innerHTML = "";
    if (!list.length) {
      voiceListEl.appendChild(el("p", { "class": "pop-modal-hint", text: "No voices found on this device yet." }));
      return;
    }
    list.forEach(function (v) {
      var row = el("button", { "class": "pop-voice-row" + (v.name === cur ? " sel" : "") });
      var tag = (v.lang || "") + (v.localService ? " · offline" : " · online");
      row.innerHTML = "<span>" + v.name + "</span><small>" + tag + "</small>";
      row.addEventListener("click", function () {
        setVoiceName(v.name);
        renderVoiceList();
        sampleVoice();
      });
      voiceListEl.appendChild(row);
    });
  }

  function closeVoiceModal() {
    cancel();
    if (modalEl) { modalEl.remove(); modalEl = null; voiceListEl = null; }
  }

  function openVoiceModal() {
    closeVoiceModal();
    modalEl = el("div", { "class": "pop-modal-backdrop" });
    var modal = el("div", { "class": "pop-modal", role: "dialog", "aria-label": "Choose a voice", "aria-modal": "true" });
    modal.appendChild(el("h2", { text: "🗣 Choose a voice" }));
    modal.appendChild(el("p", { "class": "pop-modal-hint", text: "Tap a voice to hear it — your choice is saved for every game." }));
    voiceListEl = el("div", { "class": "pop-voice-list" });
    modal.appendChild(voiceListEl);
    modal.appendChild(el("p", { "class": "pop-modal-tip",
      html: "Tip: on iPhone &amp; Mac, download an <b>Enhanced</b> or <b>Premium</b> voice in Settings → Accessibility → Spoken Content — it'll then appear here and sound far more natural." }));
    var done = el("button", { "class": "pop-modal-done", text: "Done" });
    done.addEventListener("click", closeVoiceModal);
    modal.appendChild(done);
    modalEl.appendChild(modal);
    modalEl.addEventListener("click", function (e) { if (e.target === modalEl) closeVoiceModal(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { closeVoiceModal(); document.removeEventListener("keydown", esc); }
    });
    document.body.appendChild(modalEl);
    renderVoiceList();
  }

  function injectVoiceButton() {
    if (document.getElementById("popVoiceBtn")) return;
    var controls = document.querySelector(".controls"), btn;
    if (controls) {
      btn = el("button", { "class": "ctrl", id: "popVoiceBtn", "aria-label": "Choose a voice", text: "🗣 Voice" });
      controls.appendChild(btn);
    } else {
      var row = document.querySelector(".installRow");
      if (!row) return;
      btn = el("button", { "class": "install", id: "popVoiceBtn", "aria-label": "Choose a voice", text: "🗣 Choose a voice" });
      btn.style.display = "inline-flex";
      row.appendChild(btn);
    }
    btn.addEventListener("click", openVoiceModal);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectVoiceButton);
  else injectVoiceButton();

  /* ---------- daily-plan activity tracking ----------
     On a game page, count interactions today so the plan can tick it off. */
  (function trackActivity() {
    var m = location.pathname.match(/\/apps\/([^\/]+?)\.html$/i);
    if (!m) return;
    var slug = m[1];
    function pad(n){ return n < 10 ? "0" + n : "" + n; }
    function today(){ var d = new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
    function bump() {
      try {
        var t = today();
        var a = JSON.parse(localStorage.getItem("pop-activity") || "{}");
        a[t] = a[t] || {};
        if ((a[t][slug] || 0) >= 12) return;            // enough for today; stop writing
        a[t][slug] = (a[t][slug] || 0) + 1;
        var keys = Object.keys(a).sort();
        while (keys.length > 14) delete a[keys.shift()]; // keep ~2 weeks
        localStorage.setItem("pop-activity", JSON.stringify(a));
      } catch (e) {}
    }
    bump();                                              // opening counts as a touch
    document.addEventListener("click", bump, true);
  })();

  global.Pop = {
    ROOT: ROOT,
    $: $, el: el, shuffle: shuffle,
    COLORS: COLORS, color: color,
    speak: speak, speakSeq: speakSeq, cancel: cancel,
    sampleVoice: sampleVoice, englishVoices: englishVoices,
    setVoiceName: setVoiceName, currentVoiceName: currentVoiceName, openVoiceModal: openVoiceModal,
    setSound: setSound, getSound: getSound,
    progress: { all: loadProgress, record: recordProgress, totalCorrect: totalCorrect, reset: resetProgress },
    stickers: { earned: stickersEarned, all: function () { return STICKERS.slice(); }, per: PER_STICKER },
    sparkle: sparkle, onArrows: onArrows
  };
})(window);
