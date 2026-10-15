# Legendary At Bats

Daily browser game: step into legendary MLB playoff at-bats as the batter. Recognize the pitch, decide take or swing, aim the strike zone — then see whether you **matched the legend** or **changed history**.

Identity is always **team + jersey #** (e.g. Toronto #4). No real player names.

## Play

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

## What’s in the MVP

- Curated catalog of legendary at-bats (~2016–2026), mixing hero moments and failures
- Deterministic daily pick by UTC date (same AB for everyone that day)
- Pitch loop: approach cue → pitch recognition → take/swing → zone click + timing if swinging
- End reveal: historical outcome + history verdict (changed history / matched legend / history held / fell short)
- Shareable score summary

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui
