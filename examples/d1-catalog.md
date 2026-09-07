# Read and verify the D1 catalog

Run local migrations and start the Worker:

```bash
bun run build
bun run db:migrate:local
bun run dev:worker
```

In another terminal, inspect all three catalogs and an imported detail:

```bash
curl http://localhost:8787/api/catalog/apps
curl http://localhost:8787/api/catalog/extensions
curl http://localhost:8787/api/catalog/skills
curl http://localhost:8787/api/catalog/extensions/by-id/2
bunx wrangler d1 execute DB --local --command "SELECT category, slug, status FROM listings ORDER BY category, slug"
```

The extension catalog initially contains the two reviewed imports; apps and
skills are empty. The old JSON fixture is not read by the site. To verify
publication, failed approvals, and concurrent writes without touching GitHub or
production data:

```bash
bun test tests/catalog-storage.test.ts tests/catalog-publication.test.ts tests/app-identity-migration.test.ts tests/listing-ids.test.ts tests/listing-routes.test.ts
```

The fourth migration preserves existing rows and adds a unique native app ID
index plus validation and immutability triggers. Verify the installed objects:

```bash
bunx wrangler d1 execute DB --local --command "SELECT type, name FROM sqlite_schema WHERE name LIKE 'listings_app_id%' ORDER BY name"
```

This returns one index and three triggers. Migration 0005 adds automatic numeric
IDs without changing original keys, payloads or views. Inspect the mapping:

```bash
bunx wrangler d1 execute DB --local --command "SELECT id, category, slug FROM listing_ids ORDER BY id"
```

The imported extensions use `/extensions/1/codex-usage-indicator` and
`/extensions/2/kitty-session-restorer`; their original URLs redirect. All
categories use `/<category>/<db-id>/<name-id>` with automatically derived names.
 Before using the updated publication
workflow against production, apply the committed migrations:

```bash
bun run db:migrate:remote
```

If the database contains duplicate native app IDs, migration stops for maintainer
review. It does not rename or delete listings. The publishing job refuses app
writes until the native identity index and triggers are installed, and refuses
all publications until the numeric ID mapping and triggers are installed.

For a real submission, complete its issue form, wait for automated checks, and
review it. Then copy the exact `/publish-listing <fingerprint>` command from the
bot report into a new issue comment. The publishing Actions summary links to the
new page. Refresh the directory to see it; no rebuild is required.

Configure credentials using [D1 catalog operations](../docs/implementation/catalog-storage.md).
