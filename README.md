# 🌟 Pop Learning

A little suite of bright, tappable learning games for kids who are just starting to read — built for my daughter in prep, and free for anyone to use.

**▶️ Play it: https://jclyons52.github.io/pop-learning/**

Everything runs in the browser, works **offline**, and can be **installed as an app** on a phone, tablet, or computer (no app store, no sign-up, no ads).

## The games

| Game | What it teaches |
|------|-----------------|
| 🔤 **Alphabet Pop** | Letters A–Z, their sounds, and a word for each. |
| 👀 **Sight Words** | Common high-frequency "Magic Words" to recognise by heart, with example sentences. |
| 🪄 **Sound It Out** | Tap each letter to hear its sound, then blend them into a word (c‑a‑t → cat). |
| 👨‍👩‍👧 **Word Families** | Same ending, swap the first sound: cat, hat, bat, rat. |
| 🔢 **Counting Pop** | Count objects from 1 to 20, out loud. |

All games speak using the device's built-in voice (it prefers an Australian/British English voice when one is available) and use big, chunky, kid-friendly buttons.

## Install it as an app

- **iPhone / iPad (Safari):** open the site, tap the **Share** button, then **Add to Home Screen**.
- **Android / Chrome / Desktop:** open the site and tap **Install as an app** (or use the browser's install icon in the address bar).

Once installed it opens full-screen like a normal app and works without internet.

## How it's built

Plain HTML, CSS, and JavaScript — no build step, no dependencies.

```
index.html              hub / launcher
apps/                   one self-contained page per game
shared/pop.css          shared design system (the "crayon box" look)
shared/pop.js           shared speech, sparkle effects, and PWA wiring
manifest.webmanifest    install metadata
service-worker.js       offline caching
icons/                  app icons (+ make_icons.py that generates them)
```

To run locally you just need a static file server (a service worker won't register from `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Regenerating the icons

The icons are produced by a small standalone script (Python standard library only):

```bash
python3 icons/make_icons.py
```

## Licence

Free to use and adapt. Made with ❤️.
