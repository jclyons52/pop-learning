# 🗺️ Pop Learning — roadmap

A staged plan for growing the suite as my daughter progresses. Aligned to the
Australian Foundation → Year 2 literacy & numeracy progression and to
evidence-based **systematic synthetic phonics** (the "science of reading").

**Guiding principle:** build _just ahead_ of where she is — not everything at
once. Each game stays one-tap-simple. Keep it free, offline, no accounts, no
ads. Don't let new features compete with the actual reading.

---

## ✅ Shipped

**Letters & sounds**

- **Alphabet Pop** — letters A–Z, their sounds, a word + picture each.
- **Sound Match** — hear a sound → find the letter (active recall).
- **First Sounds** — what sound does a word start with? (phonemic awareness)
- **Letter Trace** — finger-tracing for letter formation.

**Blending & word building**

- **Sound It Out** — tap each letter's sound, then blend. Now with a **🐢 Slow**
  guided "successive blending" mode (c … ca … cat) for when blending is hard.
- **Word Families** — same rime, swap the onset (cat/hat/bat).
- **Rhyme Time** — find the word that rhymes (phonemic awareness).
- **Magic e** — silent e makes the vowel say its name (cap → cape).
- **Spell It** — build the word you hear from letter tiles (encoding).

**Phonics patterns**

- **Digraphs** — sh, ch, th, wh, ck, ng, qu.
- **Blends** — bl, cl, st, tr, fr… (consonant blends).
- **Vowel Teams** — ai, ee, ea, oa, oo, igh…

**Reading**

- **Sight Words** — high-frequency "Magic Words" with sentences.
- **Sentence Pop** — read a decodable sentence, word by word.
- **Story Pop** — read a mini-story, then answer a comprehension question.
- **Speed Words** — 60-second fluency sprint.
- **Phonics Check** — read real + made-up words (Year 1 Phonics Screening style).

**Numbers**

- **Counting Pop** — count objects 1–20.
- **Quick Count** — subitising (how many did you see?).
- **Make Ten** — number bonds to 10 on a ten-frame.
- **Add & Take** — add/subtract within 10 or 20, with picture support.
- **Skip Count** — count by 2s, 5s, 10s.
- **Shape Pop** — recognise circle/square/triangle/rectangle/star/heart.

**Across the whole suite**

- **Daily Plan** — an adaptive ~10-minute daily session on the home screen
  (warm-up → 2 focus → numbers), built from a stage curriculum + her progress,
  with spaced review, mastery-gated stage progression (automatic, with a parent
  override in Grown-up Corner), a gentle streak and a finish celebration.
- **Voice picker** — choose the best device voice; saved across all games.
- **Progress store** — per-item mastery in `localStorage` (`Pop.progress`).
- **Sticker rewards** — a sticker every few correct answers (`Pop.stickers`).
- **Grown-up Corner** (`parent.html`) — summary, sticker shelf, an A–Z
  letter-sounds heat grid, and a per-game table so you can see what's sticking.
- **Shared content module** (`shared/data.js`) — all word/phonics lists in one
  place; the duplicated letter list is now shared.

---

## 🔭 Next / nice-to-have

The roadmap's core is built. Future depth, roughly in priority order:

- [ ] **More content per game** — deeper digraph/blend/vowel-team word banks,
      more decodable sentences and stories, more sight-word sets.
- [ ] **Decodable reader library** — short multi-page stories that only use
      phonics taught so far, with tap-to-hear words.
- [ ] **Parent settings** — choose which sets/levels are active per child, and
      multiple child profiles. (Reset progress already lives in Grown-up Corner.)
- [ ] **Handwriting accuracy** — optional stroke-order guidance and gentle
      "stay on the line" feedback in Letter Trace.
- [ ] **Numeracy depth** — teen-number place value, doubles, simple money/time.
- [ ] **Multiple child profiles** — separate plans/progress per child.

## 🚫 Deliberately avoiding

- Feature creep — each game must stay simple enough for a 5-year-old alone.
- Heavy gamification that distracts from reading.
- Anything requiring accounts, network, or that breaks offline use.

---

_Pedagogy note: the games follow structured-literacy ordering (phonemic
awareness → letter-sounds → blending CVC → digraphs/blends → long vowels →
connected text → fluency/comprehension). Many "sight words" are partly
decodable — teach the tricky part explicitly rather than pure rote._
