# D1 catalog storage

D1 is the source of truth for apps, extensions, and skills. The `DB` binding in
`wrangler.jsonc` is shared with view counts. Its original database name is retained
so existing data does not move when catalog storage is added.

| Table | Data |
| --- | --- |
| `listings` | Published/unpublished records keyed by category and stable slug; metadata, issue, and current review revision |
| `listing_ids` | Immutable auto-increment numeric IDs mapped to the existing category/slug keys |
| `listing_reviews` | Immutable copies of accepted metadata, submission text, reviewer, approval comment, and skill audit evidence |
| `listing_views` | Persistent counts keyed by the same category and slug |

`0002_catalog.sql` creates the catalog schema, constraints, and review triggers.
`0003_catalog_seed.sql` imports the original two extensions without overwriting
existing rows. `0004_app_identity.sql` adds a unique index on the app's native
`payload.appId`, validates supplied ID types/values, and prevents a recorded ID
from being changed or removed. The native ID stays in the canonical JSON payload;
there is no second column to keep synchronized. Older apps without this field
remain valid and acquire it through reviewed publication. A migration encountering
duplicate native IDs fails for investigation instead of rewriting records.
`0005_listing_ids.sql` backfills numeric IDs for all rows and assigns IDs to new
listings in the same insert transaction. IDs are global across categories and
never reused. Reads join this mapping and override any `dbId` inside the JSON
payload. Existing keys, payloads, history, and counts are preserved.
Apps and skills initially have no records. Existing view counts
are untouched. `app/data/extensions.json` remains an import/test fixture only;
do not edit it to publish new entries or modify the applied seed migration.

## Development and deployment

```bash
bun run build
bun run db:migrate:local
bun run dev:worker
```

Open `http://localhost:8787/extensions`. All three directories and detail routes
load from the Worker API, including newly inserted records that did not exist at
build time. Vite proxies `/api` to the Worker for frontend hot reload. Static-only
preview cannot serve catalog data. Database failures show an unavailable state.

The production database is provisioned and its ID is recorded in `wrangler.jsonc`.
The original three migrations have been applied. Apply migrations 0004 and 0005 before deploying the updated site or using the
updated publication workflow. For a separate Cloudflare account only,
create a database and replace the `DB` binding's ID:

```bash
bunx wrangler d1 create vibe-gnome-views
```

For subsequent deployments, reuse the configured database:

```bash
bun run db:migrate:remote
bun run deploy:dry-run
bun run deploy
```

The code deployment is needed once to activate the API. Future listing
publications do not require a build or deploy. Preserve backups with
`bunx wrangler d1 export DB --remote --output /tmp/vibe-gnome-backup.sql`
before manual maintenance. Source rollbacks do not roll back database records.

## GitHub publication setup

Merge the review and `publish-listing.yml` workflows and their imported modules
to the default branch. Deploy the Worker API before enabling live review jobs;
app/extension reviews read current extension identities from that API.
Run `bun run db:migrate:remote` before deploying the new API/routes or approving
listings. The publisher verifies the ID mapping table and triggers for every
category, and the native app ID index and triggers for apps. Issue comments never apply schema migrations.

Configure these repository Actions variables and secret:

| Setting | Value |
| --- | --- |
| Variable `CLOUDFLARE_ACCOUNT_ID` | Account containing this project's database |
| Variable `CLOUDFLARE_D1_DATABASE_ID` | The same database ID used by the Worker's `DB` binding |
| Secret `CLOUDFLARE_API_TOKEN` | Cloudflare API token with D1 write permission for that account |

The two variables are configured in `vibe-gnome/building`. Add the secret in
[repository Actions secrets](https://github.com/vibe-gnome/building/settings/secrets/actions)
using a token with **Account → D1 → Edit**, restricted to the account above.
Do not reuse Wrangler's expiring interactive OAuth token as an Actions secret.

The dedicated publication job's GitHub token needs only contents/issue read access. The review
workflows separately need issues write access for their reports. Database
credentials are supplied only to the publishing step (including the final step of
the confirmation job), never the browser or
submitted code. No catalog mutation endpoint is exposed on the website.
Review and publication jobs share a per-issue concurrency group; only eligible
jobs take the lock. All three jobs use Bun 1.3.14. App/extension review and
publication run their focused tests before any issue or database writes.

## Approve and publish

1. Issue validation and automated review must pass. Existing skill issues require
   explicit PASS from Gen Agent Trust Hub and Socket; Snyk is informational.
2. Review the actual source, metadata, relevance, license, permissions, and any
   audit findings. For skills, verify the submitted commit corresponds to the
   audited content; badge results alone do not establish revision identity.
3. Copy the exact `/publish-listing <fingerprint>` command from the passing bot
   report into a **new comment**. This is the human approval action. Repository
   write/admin access is required. `/confirm-listing <fingerprint>` also publishes
   after its confirmation checks; neither command requires a second approval.
4. The **Publish reviewed listing to D1** action verifies current permissions,
   the latest submission fingerprint, and the bot-owned passing report, then revalidates data.
   New app IDs and extension UUIDs are resolved again from the repository; the identity and source revision
   must match the approved report. Skill audits are fetched again. Any mismatch or failed required audit blocks
   publication. Check the Actions run summary for success and the listing URL.
5. Open the published page and close the issue with the run/page link. The
   publisher does not post comments, close issues, or merge code automatically.
   Existing unedited approvals can be retried with the publishing workflow's
   manual issue-number and approval-comment-ID inputs.

The SQL write records approval evidence atomically using triggers. A matching
revision is required to update an existing row, preventing concurrent overwrites.
Retries of the same approval comment are idempotent. Database IDs stay stable after
publication; the readable URL suffix follows the upstream identity. A new approval is needed for later issue edits;
the accepted version stays visible while an edit is under review.

## How fields become records

- Apps: name, summary, repository URL, detected native `appId`, and optional comma-separated `Tags`. Older
  submissions can still supply author/license attribution; it is left empty when
  absent. The full issue content and resolved app identity (repository, commit,
  metadata path, and ID) are retained in the review evidence.
  A detected repository app icon is saved as `icon`, using a raw URL pinned to
  the reviewed commit. Its URL is part of the approval fingerprint and immutable
  evidence. Cards and detail pages use the Apps showcase icon when an icon is
  missing or fails to load. Republishing through a fresh review imports icons
  for existing apps; no database migration is needed.
  For apps published before icon extraction, maintainers can also use the
  [icon backfill example](../../examples/backfill-app-icons.md) to discover the
  icon at the original reviewed commit. It records a separate maintenance
  revision and preserves the original approval evidence and listing IDs.
- Skills: skill name, summary, and the verified skills.sh page. Full instructions,
  source permalink, permissions, author/license, and fresh audit results are
  retained in review evidence.
- Extensions: GNOME metadata fetched at a pinned repository commit, source, summary,
  and optional comma-separated `Tags`. All values in `Tags` are saved as tags;
  new entries use the default `Community` category. Older `Category and tags`
  fields remain supported, and updates preserve an existing category and tags
  when those fields are omitted. The full approved issue body is retained verbatim in
  review evidence, including content from older forms. New submissions
  ignore removed manual ID, UUID, GNOME listing URL, metadata, and relationship fields.
  New entries import a repository icon URL pinned to the reviewed commit when one
  is detected. Otherwise they use `/icons/showcase/extensions.svg`, the green
  Extensions puzzle icon from the homepage. Missing, broken, and legacy
  `/logo.svg` icons also use this fallback in cards and detail pages. Existing update
  issues can still supply a GNOME listing URL, match UUID in D1, and preserve slug, added date, icon, features,
  and view counts. Optional `Summary`, `Details`, and `Requirements` fields can
  make specific copy changes; freeform `Requested changes` is review context and
  is not interpreted as executable instructions or an automatic text rewrite.
  New entries leave details empty when no `Details` field is supplied. Detail
  pages omit empty descriptions and descriptions that repeat the summary after
  whitespace normalization. The Features section appears only when at least one
  nonblank feature is present.

App and extension submission forms omit Listing ID. The Skills submission
template has been removed; existing skill issues remain supported. All categories
ignore older manual Listing ID values.
Apps and extensions automatically import the first suitable README image as
`screenshot`, falling back to a custom GitHub social preview. PNG, JPEG, WebP, and
GIF images must measure at least 480 × 270 pixels from their downloaded bytes;
small images, obvious branding, unsupported sources, and unavailable previews
are omitted. No screenshot field is required in either form. Repository image
URLs are pinned to the reviewed commit. The URL is part of the reviewed identity
and stored in the published JSON and immutable review evidence. Images remain
hosted upstream and appear on detail pages. Existing listings receive previews
through their next fresh review and approved publication; no migration is needed.
See [preview discovery limits](listing-review.md) for supported links and formats.
New app internal keys derive from the full native ID; new extension/skill keys
use `submission-<issue-number>`. Existing app/skill issues preserve their stored
key on republication. UUID, app ID, and source issue uniqueness prevent duplicates.
Recorded app IDs cannot change or disappear without maintainer investigation.

Public links use `/<category>/<db-id>/<name-id>`:

- Apps: `/apps/3/planner` for native ID `us.hagreli.Planner`, if assigned ID 3.
  The last dot-separated native ID component supplies the name; older apps
  without native IDs fall back to their display name.
- Extensions: `/extensions/1/codex-usage-indicator`, using the UUID before `@`.
- Skills: `/skills/4/find-skills`, using the verified skills.sh URL's last segment.

Readable segments are lowercase and normalized to letters, digits and hyphens.
The numeric ID identifies the row, so two apps named Planner can coexist with
different IDs. Single-segment legacy URLs and stale suffixes redirect to the
canonical path, retaining query parameters. Numeric legacy keys take precedence
on single-segment requests. Views and review history still use the original
internal key. Unpublishing retains both IDs; restoring a listing restores its URL.

## Read API

```text
GET /api/catalog/apps
GET /api/catalog/extensions
GET /api/catalog/skills
GET /api/catalog/:category/by-id/:dbId
GET /api/catalog/:category/:slug  # legacy/internal lookup
```

Lists return `{ category, entries, next }`, up to 100 records sorted by slug.
Request the next page using `?after=<next>`. Details return `{ category, entry }`.
Each entry includes its database-assigned numeric `dbId`. Only published records are exposed; review evidence stays private. GET requests
are read-only and responses use `Cache-Control: no-store`. Missing records return
404, unsupported methods 405, and storage errors 503. Client loaders distinguish
these states and preserve extension filters in the URL. Dynamic catalog content
requires JavaScript; the static build contains directory shells, not DB snapshots.

## Unpublish and restore

Removal/report issues omit the Reason field and receive direct human triage. After approval, use a
reviewed SQL maintenance file with `wrangler d1 execute DB --remote --file ...`.
Use a unique revision so the trigger can retain the operation in history:

```sql
UPDATE listings SET status = 'unpublished',
  revision = 'removal-ISSUE-COMMENT', reviewed_by = 'MAINTAINER',
  evidence = json_object('reason', 'Reviewed removal issue #ISSUE'),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE category = 'extensions' AND slug = 'INTERNAL-KEY';
```

Substitute reviewed values in a local file; do not insert issue text into shell
commands. Keep the row and its views/history. To restore, use `status = 'published'`
with a new revision after review. Skill restorations require fresh passing audits.

See [the runnable local example](../../examples/d1-catalog.md) and deterministic
tests in `tests/catalog-storage.test.ts` and `tests/catalog-publication.test.ts`.
