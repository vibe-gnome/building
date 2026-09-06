# D1 catalog storage

D1 is the source of truth for apps, extensions, and skills. The `DB` binding in
`wrangler.jsonc` is shared with view counts. Its original database name is retained
so existing data does not move when catalog storage is added.

| Table | Data |
| --- | --- |
| `listings` | Published/unpublished records keyed by category and stable slug; metadata, issue, and current review revision |
| `listing_reviews` | Immutable copies of accepted metadata, submission text, reviewer, approval comment, and skill audit evidence |
| `listing_views` | Persistent counts keyed by the same category and slug |

`0002_catalog.sql` creates the catalog schema, constraints, and review triggers.
`0003_catalog_seed.sql` imports the original two extensions without overwriting
existing rows. Apps and skills initially have no records. Existing view counts
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
All three migrations have been applied. For a separate Cloudflare account only,
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

The GitHub token needs only contents/issue read access for publication. The review
workflows separately need issues write access for their reports. Database
credentials are supplied only to the publishing step, never the browser or
submitted code. No catalog mutation endpoint is exposed on the website.

## Approve and publish

1. The issue form and automated review must pass. Skill submissions require
   explicit PASS from Gen Agent Trust Hub and Socket; Snyk is informational.
2. Review the actual source, metadata, relevance, license, permissions, and any
   audit findings. For skills, verify the submitted commit corresponds to the
   audited content; badge results alone do not establish revision identity.
3. Copy the exact `/publish-listing <fingerprint>` command from the passing bot
   report into a **new comment**. This is the human approval action. Repository
   write/admin access is required. No extra confirmation command is necessary.
4. The **Publish reviewed listing to D1** action verifies current permissions,
   the latest issue hash, and the bot-owned passing report, then revalidates data.
   Skill audits are fetched again. Any mismatch or failed required audit blocks
   publication. Check the Actions run summary for success and the listing URL.
5. Open the published page and close the issue with the run/page link. The
   publisher does not post comments, close issues, or merge code automatically.

The SQL write records approval evidence atomically using triggers. A matching
revision is required to update an existing row, preventing concurrent overwrites.
Retries of the same approval comment are idempotent. Do not change an issue's
Listing ID after publication. A new approval is needed for later issue edits;
the accepted version stays visible while an edit is under review.

## How fields become records

- Apps: name, summary, project URL, author/license attribution, and optional
  comma-separated `Tags`. Installation instructions and full issue content are
  retained in the review evidence.
- Skills: skill name, summary, and the verified skills.sh page. Full instructions,
  source permalink, permissions, author/license, and fresh audit results are
  retained in review evidence.
- Extensions: official GNOME metadata, source, summary, optional category/tags
  and GNOME listing URL. New entries use `/logo.svg` until a reviewed asset is
  supplied. Updates match UUID in D1 and preserve slug, added date, icon, features,
  and view counts. Optional `Summary`, `Details`, and `Requirements` fields can
  make specific copy changes; freeform `Requested changes` is review context and
  is not interpreted as executable instructions or an automatic text rewrite.

For new entries, `Listing ID` chooses the public URL slug. If omitted, it becomes
`submission-<issue-number>`. IDs are at most 128 lowercase letters/digits separated
by hyphens. An ID belonging to another submission cannot be overwritten. Extension
UUIDs and source issue IDs also have uniqueness constraints.

## Read API

```text
GET /api/catalog/apps
GET /api/catalog/extensions
GET /api/catalog/skills
GET /api/catalog/:category/:slug
```

Lists return `{ category, entries, next }`, up to 100 records sorted by slug.
Request the next page using `?after=<next>`. Details return `{ category, entry }`.
Only published records are exposed; review evidence stays private. GET requests
are read-only and responses use `Cache-Control: no-store`. Missing records return
404, unsupported methods 405, and storage errors 503. Client loaders distinguish
these states and preserve extension filters in the URL. Dynamic catalog content
requires JavaScript; the static build contains directory shells, not DB snapshots.

## Unpublish and restore

Removal/report issues still receive direct human triage. After approval, use a
reviewed SQL maintenance file with `wrangler d1 execute DB --remote --file ...`.
Use a unique revision so the trigger can retain the operation in history:

```sql
UPDATE listings SET status = 'unpublished',
  revision = 'removal-ISSUE-COMMENT', reviewed_by = 'MAINTAINER',
  evidence = json_object('reason', 'Reviewed removal issue #ISSUE'),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE category = 'extensions' AND slug = 'LISTING-ID';
```

Substitute reviewed values in a local file; do not insert issue text into shell
commands. Keep the row and its views/history. To restore, use `status = 'published'`
with a new revision after review. Skill restorations require fresh passing audits.

See [the runnable local example](../../examples/d1-catalog.md) and deterministic
tests in `tests/catalog-storage.test.ts` and `tests/catalog-publication.test.ts`.
