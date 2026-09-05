# Vibe GNOME

A practical, Adwaita-inspired guide for people building GNOME apps and Shell
extensions with an AI coding agent.

## Run locally

```bash
bun install
bun run dev
```

Open the local URL printed by React Router. The appearance menu supports system,
light, and dark styles plus the nine GNOME accent colors.

Browse the integrated extension catalog at `/extensions`, view individual
listings at `/extensions/:slug`, and request listing changes through GitHub
issues. Submission, update, and removal issue forms are included
in `.github/ISSUE_TEMPLATE/` and target `vibe-gnome/building`.

## Quality checks

```bash
bun run check
bun run build
```

## Deploy

The production site is deployed to Cloudflare Workers at
`https://vibe-gnome.org`:

```bash
bun run deploy:dry-run
bun run deploy
```

## Project map

- `app/routes/home.tsx` — page content and interactions
- `app/components/blur-glow-hero.tsx` — React lifecycle for the WebGL hero
- `app/app.css` — Adwaita-inspired visual system and responsive states
- `app/lib/blur-glow/` — mask, palette, shader, and bloom rendering core
- `app/lib/preferences.ts` — validated theme choices and agent prompts
- `app/data/extensions.json` — reviewed extension listings
- `app/lib/extension-catalog.ts` — extension search, filters, and sorting
- `docs/implementation/listing-review.md` — extension submission review workflow
- `tests/` — deterministic preference and prompt tests
- `docs/` — architecture, setup, references, and user guidance

The original icon is kept at `website/logo.svg`; the web-ready copy is
`public/logo.svg`.
