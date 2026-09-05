# Setup and implementation notes

## Requirements

- Bun 1.3 or later
- A modern browser with CSS `color-mix()` and WebGL 1 support

The page remains usable without WebGL; the hero falls back to its styled HTML
heading.

## Setup

```bash
bun install
bun run dev
```

React Router route types are generated into `.react-router/` during typecheck and
are intentionally ignored by git.

## Static output

`bun run build` writes the production site to `build/client/`. Because
`react-router.config.ts` sets `ssr: false`, no application server is required.
The `/apps`, `/extensions`, and `/skills` directory pages plus all
reviewed extension detail pages are also prerendered. Keep `/` out of the prerender list so
`index.html` remains the SPA fallback expected by the existing static host.
The guide imports Matter.js through its CommonJS default export so the build's
Node prerender process can load the route modules.

## Cloudflare deployment

The repository includes Wrangler as a development dependency so every deploy
uses the version pinned in `bun.lock`. `wrangler.jsonc` publishes
`build/client/` as Worker static assets and attaches the production Worker to
the existing proxied `vibe-gnome.org/*` route.

Authenticate once, validate the bundle without publishing, then deploy:

```bash
bunx wrangler login
bun run deploy:dry-run
bun run deploy
```

The `vibe-gnome.org` zone and a proxied apex DNS record must exist in the
authenticated Cloudflare account. Wrangler attaches the Worker route without
replacing that record.

## Adding content

Edit guide sections and resource metadata in `app/routes/home.tsx`. Edit the two
copyable prompts in `app/lib/preferences.ts`, then update the assertions in
`tests/preferences.test.ts` if their required platform language changes.

Vibe Tools category descriptions and accepted community entries live in
`app/lib/tools.ts`. To accept a submission, follow the copy-ready entry example
in `examples/tool-submissions.md`, run `bun run check`, and rebuild.

The submission link opens an issue form in `vibe-gnome/building`. Publish
`.github/ISSUE_TEMPLATE/submit-skill.yml` to that repository's default branch to
activate the form. GitHub Issues must remain enabled. Change
the repository URL in `toolSubmissionUrl` if the submission inbox moves.

## Extension submissions

The extension catalog is maintained in `app/data/extensions.json`. Submit,
update, and report/remove actions target `vibe-gnome/building`, alongside skills.
Publish `submit-extension.yml`, `update-extension.yml`, and
`remove-extension.yml` from `.github/ISSUE_TEMPLATE/` to the default branch to
activate them. No issue is created by running the site locally.

Follow [listing review](listing-review.md) when accepting a request. The
[submission example](../../examples/extension-submissions.md) includes copy-ready
issue content and a catalog query that runs with Bun. Local icons belong in
`public/extensions/icons/`; credit them in `THIRD_PARTY_NOTICES.md`.
