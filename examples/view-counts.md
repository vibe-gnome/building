# Test listing view counts locally

From the repository root:

```bash
bun run build
bun run db:migrate:local
bun run dev:worker
```

In another terminal:

```bash
# Read without counting a visit.
curl http://localhost:8787/api/views/extensions/codex-usage-indicator

# Record a visit and return the stored total.
curl -X POST -H 'X-Vibe-View: 1' \
  http://localhost:8787/api/views/extensions/codex-usage-indicator
```

The response contains `category`, `slug`, and `views`. Open
`http://localhost:8787/extensions/codex-usage-indicator` to see the counter in the
information panel. A reload adds one view. Restarting the Worker preserves the
total. Unknown listings return 404; unsupported methods return 405; cross-origin
writes return 403; database failures return 503. Counts are not cached.

Use `apps/<id>` or `skills/<id>` in the API path after adding a reviewed listing.
Both catalogs are currently empty; do not add sample entries to production.
App and skill records are published to D1 through the
[human approval workflow](../docs/implementation/catalog-storage.md).
IDs and extension slugs use lowercase letters, digits, and single hyphens between
words, up to 128 characters. Keep them unchanged when editing display names.

For production setup, follow [Cloudflare deployment](cloudflare-deploy.md).
The API uses a D1 binding, so Cloudflare account credentials never go into the
browser. Same-origin checks prevent cross-site browser writes; the total is an
anonymous page-view metric and does not claim unique or bot-filtered visitors.

References: [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
and [Worker static asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/).
