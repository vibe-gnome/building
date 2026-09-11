# Restore missing app icons

App icon extraction runs during publication. Previously published records do
not acquire an icon just because the website or review workflow was updated.

Back up D1 and export the current published app records:

```sh
bunx wrangler d1 export DB --remote --output /tmp/vibe-before-app-icons.sql
bunx wrangler d1 execute DB --remote --command "SELECT slug, payload, revision, evidence FROM listings WHERE category = 'apps' AND status = 'published'" --json > /tmp/vibe-apps.json
bun scripts/backfill-app-icons.ts /tmp/vibe-apps.json > /tmp/vibe-app-icons.sql
```

The generator reads each app's repository tree at the commit in its stored
approval evidence, using the same icon selection as new publications. It never
executes repository code or writes to D1. `GITHUB_TOKEN` is optional for public
GitHub API requests. Existing custom icons and records without a reviewed
identity are skipped. Mismatched identities or revisions stop generation.

Inspect the generated icon URLs and SQL, then apply the repair:

```sh
bunx wrangler d1 execute DB --remote --file /tmp/vibe-app-icons.sql
curl https://vibe-gnome.org/api/catalog/apps
```

Each update requires the original payload, evidence, and revision to still
match a published app. Reruns and concurrent publication cannot overwrite a
newer record. The update appends an `icon-backfill-v1` revision, recorded by
`repository-icon-backfill`, with the source commit and icon URL in
`evidence.iconBackfill`. Original review history, approval evidence, native IDs,
numeric IDs, and view counts remain intact. No issue comment is sent.

Use `--local` in both Wrangler commands to operate on local development data.
The website must include the `AppIcon` card renderer to display the saved icon.

```sh
bun test tests/app-icon-backfill.test.ts
```
