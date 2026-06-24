/* Pop Learning — service worker
   Precaches the whole suite so it runs offline once installed. */
"use strict";

var VERSION = "pop-v5";
// ASSETS_HASH is a digest of every precached file, written by `deno task stamp`.
// Because the cache name includes it, the cache busts automatically whenever
// any asset changes — CI fails if this is stale (see tests/validate.js).
var ASSETS_HASH = "bb70646d2b";
var CACHE = "pop-cache-" + VERSION + "-" + ASSETS_HASH;

// All paths are relative to this script (the repo root).
var PRECACHE = [
  "./",
  "index.html",
  "parent.html",
  "manifest.webmanifest",
  "shared/pop.css",
  "shared/pop.js",
  "shared/data.js",
  "shared/plan-core.js",
  "shared/plan.js",
  "sounds/manifest.json",
  "apps/alphabet-pop.html",
  "apps/sound-match.html",
  "apps/first-sounds.html",
  "apps/letter-trace.html",
  "apps/sound-it-out.html",
  "apps/word-families.html",
  "apps/rhyme-time.html",
  "apps/magic-e.html",
  "apps/spell-it.html",
  "apps/digraphs.html",
  "apps/blends.html",
  "apps/vowel-teams.html",
  "apps/sight-words.html",
  "apps/sentence-pop.html",
  "apps/story-pop.html",
  "apps/speed-words.html",
  "apps/phonics-check.html",
  "apps/counting-pop.html",
  "apps/quick-count.html",
  "apps/make-ten.html",
  "apps/add-take.html",
  "apps/skip-count.html",
  "apps/shapes.html",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-180.png",
  "icons/icon-maskable-512.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // best-effort: don't fail the whole install if one item 404s
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;

  // App shell (same-origin): cache-first, fall back to network and cache it.
  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        }).catch(function () {
          // offline navigation fallback -> the hub
          if (req.mode === "navigate") return caches.match("index.html");
        });
      }),
    );
    return;
  }

  // Cross-origin (e.g. Google Fonts): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) {
            c.put(req, copy);
          });
        }
        return res;
      }).catch(function () {
        return hit;
      });
      return hit || net;
    }),
  );
});
