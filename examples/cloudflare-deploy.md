# Deploy to Cloudflare

Authenticate with `bunx wrangler login`. Production D1 is already provisioned;
reuse the `DB` binding's database ID in `wrangler.jsonc` on every deployment.
For a separate account, follow [D1 setup](../docs/implementation/catalog-storage.md).

From the repository root, run:

```bash
bun install
bun run check
bun run deploy:dry-run
bun run deploy
```

The deployment applies D1 migrations, then publishes the API and `build/client/`
to the `vibe-gnome` Worker and serves
it from `https://vibe-gnome.org`. If Wrangler is not authenticated, run
`bunx wrangler login` first.
