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
`react-router.config.ts` sets `ssr: false`, no React application server is required.
The `/apps`, `/extensions`, and `/skills` directory shells are prerendered;
`/guides` also prerenders its article list and loads skills in the browser.
Records and dynamic details load from the D1 catalog API. Keep `/` out of the prerender list so
`index.html` remains the SPA fallback expected by the existing static host.

## Cloudflare deployment

The repository includes Wrangler as a development dependency so every deploy
uses the version pinned in `bun.lock`. `wrangler.jsonc` publishes
`build/client/` as Worker static assets and attaches the production Worker to
the existing proxied `vibe-gnome.org/*` route.

Catalogs and view counts need the Worker API and D1 in addition to the static files.
The production database is already provisioned in `wrangler.jsonc`. Authenticate
with its Cloudflare account:

```bash
bunx wrangler login
```

For a separate account, follow [database setup](catalog-storage.md). Keep the
existing database ID for production deployments. Then run:

```bash
bun run deploy:dry-run
bun run deploy
```

`deploy` builds the site, applies pending remote D1 migrations, then publishes
the Worker and assets. The dry run never migrates or publishes. Reuse the same
database on subsequent deployments to retain listings, review history, and counts. See the
[copy-ready view-count workflow](../../examples/view-counts.md).

For local API development, build assets once and start the local D1-backed Worker:

```bash
bun run build
bun run db:migrate:local
bun run dev:worker
```

Visit `http://localhost:8787` for the complete built site. To edit the frontend
with hot reload, also run `bun run dev`; Vite proxies `/api` to port 8787.
Local data persists under the ignored `.wrangler/` directory and never touches
the production database. The static-only `bun run preview` cannot serve this API
and cannot load the catalogs or view counts. `bun run typecheck` generates the ignored
`worker-configuration.d.ts` before checking the browser and Worker separately.

The `vibe-gnome.org` zone and a proxied apex DNS record must exist in the
authenticated Cloudflare account. Wrangler attaches the Worker route without
replacing that record.

## Adding content

Edit guide sections and resource metadata in `app/routes/home.tsx`.
Curated articles for the Guides section and `/guides` live in
`app/lib/guides.ts`. Both surfaces read published skills from the existing D1
catalog API; no duplicate skill list or database migration is needed. See the
[guide content example](../../examples/guide-content.md) when adding an article.
Homepage idea copy and footprint positions live in
`app/components/idea-footprints.tsx`. Keep new positions outside the centered
slogan on both desktop and phone layouts.

Directory copy and issue links live in `app/lib/tools.ts` and
`app/lib/showcases.ts`. Listing metadata is stored in D1. Follow
[catalog storage and publication](catalog-storage.md) to configure the database
and GitHub publishing credentials. Apps/extensions use
[listing review](listing-review.md); skills use [skill review](skill-review.md).

Submission forms and workflows must be on `vibe-gnome/building`'s default branch.
Issues and Actions must remain enabled. The review jobs use `issues: write`;
the separate publishing job reads GitHub data and uses a Cloudflare D1 write token.
Publishing a listing does not rebuild or redeploy the website.

## Extension submissions

The extension catalog is maintained in D1. The old `app/data/extensions.json`
is a seed/test fixture only. Submit and report/remove actions target
`vibe-gnome/building`, alongside skills.
Publish `submit-extension.yml` and
`remove-extension.yml` from `.github/ISSUE_TEMPLATE/` to the default branch to
activate them. No issue is created by running the site locally.

Follow [listing review](listing-review.md) when accepting a request. The
[submission example](../../examples/extension-submissions.md) includes copy-ready
issue content and a catalog query that runs with Bun. Local icons belong in
`public/extensions/icons/`; credit them in `THIRD_PARTY_NOTICES.md`.

## App and extension review automation

Publish `.github/workflows/listing-review.yml`, `scripts/listing-review.ts`,
`app/lib/listing-review.ts`, and the catalog alongside the issue forms on the
default branch. GitHub Actions must be enabled with `contents: read` and
`issues: write` available to `GITHUB_TOKEN`. The workflow checks submissions on
opening, editing, or reopening an issue, then waits for a maintainer's explicit
confirmation comment. Review labels are created automatically. It uses Bun
directly without installing project dependencies. A valid human `/confirm-listing`
comment then runs the publisher in the same job; the Cloudflare publishing secret
is provided only to that final step.

See [listing review](listing-review.md) for approval and failure handling,
and [local review examples](../../examples/listing-review.md) to test without
writing to GitHub. App submissions use `submit-app.yml`. The separate
`publish-listing.yml` workflow stores accepted apps and extensions in D1 after
a maintainer posts the passing report's `/publish-listing` command.
