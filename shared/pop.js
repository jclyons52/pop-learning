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

  /* ---------- speech ---------- */
  var voice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    var vs = speechSynthesis.getVoices();
    voice = vs.find(function (v) { return /en[-_]AU/i.test(v.lang); })
         || vs.find(function (v) { return /en[-_]GB/i.test(v.lang); })
         || vs.find(function (v) { return /^en/i.test(v.lang); })
         || vs[0] || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
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

  global.Pop = {
    ROOT: ROOT,
    $: $, el: el, shuffle: shuffle,
    COLORS: COLORS, color: color,
    speak: speak, speakSeq: speakSeq, cancel: cancel,
    setSound: setSound, getSound: getSound,
    sparkle: sparkle, onArrows: onArrows
  };
})(window);
