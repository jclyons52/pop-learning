# 🌟 Pop Learning

A little suite of bright, tappable learning games for kids who are just starting to read — built for my daughter in prep, and free for anyone to use.

**▶️ Play it: https://jclyons52.github.io/pop-learning/**

Everything runs in the browser, works **offline**, and can be **installed as an app** on a phone, tablet, or computer (no app store, no sign-up, no ads).

## A guided daily plan

The home screen opens with **Today's Plan** — a short, adaptive ~10-minute
session (a warm-up, two focus games, and a number game) chosen to match where
your child is at. It uses **spaced review** and **mastery-gated stages**, so it
quietly advances as they're ready, builds a gentle **streak**, and celebrates
when the day's plan is done. *Little and often* is what makes reading stick.

Grown-ups can see how it's going — and nudge the level — in the
**Grown-up Corner** (progress heat-grid, sticker shelf, per-game stats, and the
reading/numbers stage controls).

## The games

Around two dozen games, grouped by skill on the home screen:

- **Letters & Sounds** — Alphabet Pop, Sound Match, First Sounds, Letter Trace
- **Blending & Word Building** — Sound It Out, Word Families, Rhyme Time, Magic e, Spell It
- **Phonics Patterns** — Digraphs, Blends, Vowel Teams
- **Reading** — Sight Words, Sentence Pop, Story Pop, Speed Words, Phonics Check
- **Numbers** — Counting Pop, Quick Count, Make Ten, Add & Take, Skip Count, Shape Pop

They follow evidence-based **systematic synthetic phonics** ordering (phonemic
awareness → letter-sounds → blending → patterns → connected text → fluency), with
a parallel early-numeracy track. See [`ROADMAP.md`](ROADMAP.md) for the plan.

All games speak using the device's built-in voice (it prefers an Australian/British English voice when one is available) and use big, chunky, kid-friendly buttons.

## Install it as an app

- **iPhone / iPad (Safari):** open the site, tap the **Share** button, then **Add to Home Screen**.
- **Android / Chrome / Desktop:** open the site and tap **Install as an app** (or use the browser's install icon in the address bar).

Once installed it opens full-screen like a normal app and works without internet.

## How it's built

Plain HTML, CSS, and JavaScript — no build step, no dependencies.

```
index.html              hub / launcher + Today's Plan
parent.html             Grown-up Corner (progress, stickers, stage controls)
apps/                   one self-contained page per game
shared/pop.css          shared design system (the "crayon box" look)
shared/pop.js           speech, sparkle, PWA wiring, progress + activity tracking
shared/data.js          all word / phonics / number content (Pop.data)
shared/plan.js          the daily-plan engine (curriculum, mastery, streak)
manifest.webmanifest    install metadata
service-worker.js       offline caching (bump VERSION when files change)
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
