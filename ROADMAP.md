# 🗺️ Pop Learning — roadmap

A staged plan for growing the suite as my daughter progresses. Aligned to the
Australian Foundation → Year 2 literacy & numeracy progression and to
evidence-based **systematic synthetic phonics** (the "science of reading").

**Guiding principle:** build *just ahead* of where she is — not everything at
once. Each game stays one-tap-simple. Keep it free, offline, no accounts, no
ads. Don't let new features compete with the actual reading.

Current focus: **she is still securing letter–sounds and finding blending
hard.** So the near-term work reinforces letters/sounds and *active recall*,
not new phonics patterns yet.

---

## ✅ Shipped

- **Alphabet Pop** — letters A–Z, their sounds, a word + picture each.
- **Sound Match** — *hear a sound → find the letter* (active recall; the
  retrieval counterpart to Alphabet Pop). Picture clue + spoken sound, 3/4/6
  choices, case toggle, score.
- **Sight Words** — high-frequency "Magic Words" in sets, with sentences.
- **Sound It Out** — tap each letter for its sound, then blend (c‑a‑t → cat).
- **Word Families** — same rime, swap the onset (cat/hat/bat/rat).
- **Counting Pop** — count objects 1–20 aloud.
- **Voice picker** — choose the best device voice; saved across all games.
- **Progress store** — lightweight per-item mastery recording in `localStorage`
  (`Pop.progress`). Sound Match already feeds it; ready for a parent view.

---

## 🎯 Now — Foundation / struggling reader (reinforce + recall)

The single biggest mode shift is **active recall** over passive "tap to hear".

- [ ] **Phonemic awareness game** — rhyme match, "what's the *first* sound?",
      I-spy. This is *pre-print* ear training and the strongest lever for a
      child who finds letters/sounds hard. No reading required.
- [ ] **Guided blending help in Sound It Out** — slower, optional 2-step
      blending (c‑a → ca → cat) and a "your turn" prompt.
- [ ] **Letter formation / tracing** — trace the letter while hearing its
      sound (writing reinforces reading; core Foundation handwriting).
- [ ] **Parent view** — a simple "what she knows" screen reading `Pop.progress`
      (which letters/sounds are sticking, which to revisit).

## 🌱 Late Foundation → Year 1 (extend phonics — the decoding expansion)

- [ ] **Digraphs** — sh, ch, th, ck, ng, qu (two letters, one sound).
- [ ] **Consonant blends** — bl, st, tr, sp… (stop, frog, hand).
- [ ] **Magic-e / split digraphs** — a_e, i_e, o_e (cap → cape).
- [ ] **Decodable sentences** — "the big dog ran"; the real bridge from
      word-calling to *reading*. Tap-to-hear each word, then the whole line.
- [ ] **Year 1 Phonics Check practice** — Australia's Year 1 Phonics Screening
      Check mixes real **and pseudo-words** (e.g. "vit", "splosh") to test pure
      decoding. A focused practice mode is a concrete milestone to prep for.

## 🌳 Year 1 → Year 2 (fluency, comprehension, spelling)

- [ ] **Vowel teams** — ai, ee, oa, igh, oo, ar, or.
- [ ] **Decodable mini-stories** — 2–4 sentences + one comprehension question.
- [ ] **Spelling / encoding** — hear a word → build it from letter tiles
      (the reverse of decoding; starts writing).
- [ ] **Fluency** — timed/repeated sight-word & sentence flash for automaticity.

## 🔢 Numeracy track (parallel)

- [ ] **Subitising** — recognise small quantities without counting.
- [ ] **Number bonds to 10** — making 10, part–part–whole.
- [ ] **Add / subtract within 10, then 20.**
- [ ] **Skip counting** — 2s, 5s, 10s.
- [ ] **Shapes & patterns**, then later **money & time**.

---

## 🧩 Cross-cutting (punch above their weight)

- [ ] **Parent settings** — choose active sets/levels, lock difficulty.
- [ ] **Gentle motivation** — sticker/reward shelf or soft streaks. Keep it
      *non-manipulative*: no pressure timers, no ad-style loops.
- [ ] **Data-driven content** — move phonics/word lists into shared data files
      so new sets are drop-in (removes the duplicated letter list across
      Alphabet Pop & Sound Match).

## 🚫 Deliberately avoiding

- Feature creep — each game must stay simple enough for a 5-year-old alone.
- Heavy gamification that distracts from reading.
- Anything requiring accounts, network, or that breaks offline use.

---

*Pedagogy note: the sequence above follows structured-literacy ordering
(phonemic awareness → letter-sounds → blending CVC → digraphs/blends →
long vowels → connected text → fluency/comprehension). Many "sight words" are
partly decodable — teach the tricky part explicitly rather than pure rote.*
