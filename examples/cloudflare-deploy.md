# Deploy to Cloudflare

From the repository root, run:

```bash
bun install
bun run check
bun run deploy:dry-run
bun run deploy
```

The deployment publishes `build/client/` to the `vibe-gnome` Worker and serves
it from `https://vibe-gnome.org`. If Wrangler is not authenticated, run
`bunx wrangler login` first.
