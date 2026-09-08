# Architecture

Vibe GNOME is a standalone React Router v7 application using framework mode with
server rendering disabled. It produces a static client build that can be hosted
on any static web host. The production deployment uses Cloudflare Workers Static
Assets, with `vibe-gnome.org` attached as a Worker Custom Domain.

## Main pieces

- `app/routes/about.tsx` explains the community project's purpose at `/about`,
  which is prerendered as static HTML.
  Home and About share `app/components/site-footer.tsx`, including the About
  entry, community links, and independent-project disclaimer.
- `app/root.tsx` owns the document shell, metadata, global stylesheet, and an
  inline pre-paint preference script.
- `app/routes/home.tsx` owns the guide page and resource data.
  `app/components/appearance-control.tsx` provides the shared appearance
  control used by the guide and extension pages.
- The community directories at `/apps`, `/extensions`, and `/skills`
  share `app/routes/community-layout.tsx` for their shell and
  `app/extensions.css` for their catalog presentation.
- `app/lib/tools.ts` owns Skills directory copy and GitHub issue submission links.
  Catalog entries for all three directories are stored in D1 and read through
  `app/lib/catalog-client.ts`.
- `app/components/idea-footprints.tsx` owns the eight homepage ideas and their
  hover, keyboard-focus, and touch disclosure behavior.
- `app/components/particle-typography.tsx` renders the interactive hero text and
  owns its particle lifecycle, pointer interaction, and resize behavior.
- `app/lib/preferences.ts` is the source of truth for supported themes, GNOME
  accents, and validation.
- `app/app.css` defines the theme tokens and responsive presentation.

User appearance choices are stored locally. System mode listens for operating
system color-scheme changes. The pre-paint script applies saved preferences
before React loads to avoid a light/dark flash.

## Design direction

The site borrows GNOME's restraint rather than reproducing desktop widgets
literally. It uses system-first Adwaita/Cantarell typography, neutral surfaces,
compact controls, clear focus states, and the official nine-color accent
family. Guide sections use simple rules and grouped lists instead of decorative
cards. The opening section fills the available viewport below the header and
centers the particle slogan. Eight small logo paw
marks are scattered around it in stable, irregular positions, with separate
phone coordinates that keep the text clear. Each mark reveals an app or extension
idea on hover, keyboard focus, or tap. Cards fade and scale from their anchor,
open toward the center, and stay within the viewport's horizontal edges. Moving
onto a card keeps it open; leaving the mark and card, moving focus away, pressing
Escape, or tapping outside dismisses it. Only one idea is open at a time. Reduced
motion removes the transitions. The footprints use the shared logo symbol with
crisp pixel edges and the unmodified GNOME accent, matching the slogan's solid
color and pixel treatment in both themes.

The layout is responsive at tablet and phone widths and respects
`prefers-reduced-motion`.

The home showcase uses three equal-width cards in one row above 680px and
horizontal, stacked cards on phones. Apps, Extensions, and Skills have blue,
green, and purple surfaces respectively, mixed with the active theme's surface.
Their original SVG icons in `public/icons/showcase/` use rounded silhouettes,
soft highlights, and shallow bottom edges inspired by GNOME app icons. The icons
are decorative; each card's title and description label its link. Global accent
preferences still control keyboard focus, and reduced motion disables card
transitions.

The particle hero includes a screen-reader label, caps device pixel ratio at 2,
and renders a still frame when reduced motion is requested. The enlarged headline
uses two centered lines on desktop and three at phone widths (680px and below):
“Vibe coding” / “for GNOME.” / “Why not?”. Each layout is sized to fit its longest
line, giving the phone headline larger lettering and tighter line spacing.
Particles follow the
active theme and GNOME accent immediately, including in reduced-motion mode.
Particles fill their sampling cells with the unmodified accent color so the
resting slogan appears solid, without background gaps washing out its color.

## Catalog storage and publication

D1 is the source of truth for apps, extensions, and skills. The existing `DB`
binding holds `listings`, `listing_ids`, `listing_reviews`, and `listing_views` together.
`listings` uses `(category, slug)` as its stable primary key and stores each
category's typed metadata as JSON. GNOME `metadata.json` field names remain
unchanged. UUID, native app ID, and issue identity indexes reject duplicate entries.
Migration `0004_app_identity.sql` indexes the canonical JSON app ID and prevents
changes to an ID once recorded. Existing app rows without IDs remain readable. Migration `0005_listing_ids.sql`
adds an auto-increment mapping to immutable numeric IDs for all categories,
backfills existing listings, and assigns new IDs atomically through an insert
trigger. Original category/slug keys preserve view counts and review history.

`app/server/catalog-store.ts` reads published rows through the D1 binding.
`app/server/catalog-api.ts` exposes read-only `/api/catalog/:category` and
`/api/catalog/:category/by-id/:dbId` endpoints, retaining
`/api/catalog/:category/:slug` for legacy/internal lookup. Responses include
`dbId` from the mapping table, never from user-supplied JSON. List responses use cursor pagination;
review evidence and unpublished rows are never returned. Responses are uncached
so accepted changes become visible on the next navigation/reload. Database
failures return 503 and an explicit unavailable UI, never a fabricated empty list.

React Router `clientLoader` functions load each directory and detail page from
this API. Extension search, sorting, categories, and Shell filters operate on the
fetched records. Build-time prerendering covers `/about` and the three directory
shells; dynamic details use the SPA fallback. Listing content and its detail
metadata now require JavaScript, and builds do not fetch D1. New records do not
need a frontend rebuild. The shared catalog shell, appearance controls, footer,
keyboard focus, and reduced-motion support remain in place.

`app/server/migrations/0003_catalog_seed.sql` imports the original two reviewed
extensions once. `app/data/extensions.json` is retained only as the immutable
import/test fixture; editing it does not change the live catalog. The app and
skill catalogs were empty at migration. Existing view counts are preserved.

GitHub remains the submission and discussion interface. Basic app/extension
checks read the current published extension identities from the API. Skill
checks require PASS from Gen Agent Trust Hub and Socket on skills.sh; Snyk is
informational. Passing reports include a hash of the exact issue title/body.
A human maintainer reviews the content and posts `/publish-listing <fingerprint>`.
The dedicated publishing workflow verifies current write/admin permissions,
the passing bot report, the latest issue content, and current validation; skills
are checked again against skills.sh before writing.

Apps ask only for name, repository URL, and summary. `app/server/app-identity.ts`
reads public metadata from GitHub, GitLab.com, and GNOME GitLab to resolve a native
app ID at a single commit. Reports link to that source and bind approval to the
resolved identity as well as issue content. Publication repeats discovery and
rejects changed revisions. Native IDs are stored as `appId`. Public links use
`/apps/<db-id>/<last-native-id-component>`, `/extensions/<db-id>/<uuid-before-@>`,
and `/skills/<db-id>/<skills.sh-name>`. The shared `listing-links.ts` supplies
all cards and publishing results. `listing-loader.ts` resolves numeric IDs and
redirects old keys or stale readable suffixes, preserving query parameters.
Internal keys and view counts are preserved by source issue. No submitted repository
code runs, and no additional dependency is required.

New extension submissions also discover their UUID and metadata.json at one
repository commit through `app/server/extension-identity.ts`; no UUID or pasted
metadata is requested. Both resolvers share bounded public repository reads in
`repository-metadata.ts`. Ambiguous/missing files or nonliteral IDs block review.
Extension metadata and its source revision are bound to approval and read again
before publication. Listing ID fields are absent from all submission forms.
The same tree supplies an optional extension icon at that commit. The selected
raw image URL is linked in the review, bound to approval, and stored in the
catalog. Missing or broken icons use the existing green Extensions showcase
asset; legacy site-logo placeholders also render this fallback. Image colors
are preserved in both the catalog and detail view.

Review can be rerun manually from Actions to refresh a repository revision.
Eligible review and publication jobs share a per-issue concurrency lock. Both
run focused tests before writes. The publisher verifies numeric ID assignment for all categories and the native
app identity index and triggers before writing apps; schema migrations use the separate
Wrangler migration command and never run in response to an issue comment.

The publisher uses the Cloudflare D1 API from GitHub Actions. The website exposes
no catalog write endpoint. A conditional SQL upsert and database triggers save
both the listing and its immutable review evidence atomically, with revision
checks to reject competing edits. Retrying the same approval does not duplicate
writes or replay an older version. Edits after publication do not change the
accepted row until a new review and approval completes. Extension updates keep
their UUID, slug, original added date, assets, and view counts.

See [D1 catalog operations](../implementation/catalog-storage.md),
[app/extension review](../implementation/listing-review.md), and
[skill review](../implementation/skill-review.md).

## Listing view counts

`app/worker.ts` adds a same-origin Cloudflare API alongside the static assets.
Only `/api/*` runs the Worker first; other requests retain the existing asset
and SPA handling. `GET /api/views/:category/:slug` reads the count, and `POST`
increments it and returns the total. Categories are `apps`, `extensions`, and
`skills`. The API verifies published listing identities in D1, so newly published records
can receive views without a Worker rebuild.

D1 stores one `listing_views` row per category and stable listing ID (extension
`slug`, app/skill `id`). One SQL upsert increments and returns the total atomically.
Counts survive deployments and are independent across categories. IDs must stay
stable; renaming an ID requires a database migration to retain its count. No
visitor identifiers, cookies, or IP addresses are stored in the counter table.

`app/components/view-count.tsx` records one visit when a valid detail page mounts
or a new router navigation reaches it. Reloads and later visits count again;
rerenders and Strict Mode effect replay do not. Prerendering, catalog pages,
prefetching, and not-found pages do not record views. These are page views, not
unique visitors or verified human visits. The browser does not retry increments
automatically because a failed response might already have committed the write.
API failures show “Unavailable”; the rest of the page remains usable.

App and skill cards link to `/apps/:dbId/:nameId` and `/skills/:dbId/:nameId`. Their shared detail
component preserves the catalog copy and external project links. Details load from D1 through the catalog API; view counts start after a valid
listing loads.
Cloudflare runtime types are generated by Wrangler and checked separately through
`tsconfig.worker.json` to avoid changing browser and Bun globals. No new dependency
is required; the Worker uses the existing Wrangler toolchain and a D1 binding.
