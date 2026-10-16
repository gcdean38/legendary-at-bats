# Legendary At Bats

Daily browser game: step into legendary MLB playoff at-bats as the batter. Watch the pitch come in, **take or swing where you think it’s going**, work the full count — then see whether you **matched the legend** or **changed history**.

Identity is always **team + jersey #** (e.g. Toronto #4). No real player names.

## Play

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

**Live (GitHub Pages):** [https://gcdean38.github.io/legendary-at-bats/](https://gcdean38.github.io/legendary-at-bats/)

Branch flow: work on `dev` → merge request into `prod` (Pages deploys from `prod`).

## What’s in the MVP

- Curated catalog of legendary at-bats (~2016–2026), mixing hero moments and failures
- Deterministic daily pick by US Eastern date (`America/New_York`) — same AB for everyone that Eastern calendar day
- Live score bug with location abbrs (e.g. ARI 5 · TEX 5) and B/S/O dots
- Pitch loop: flight → take **or** click the plate (zone + chase) → count updates; fouls recycle the pitch pool
- Exit look on contact; end reveal with history verdict
- Shareable score summary

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui
