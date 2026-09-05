# Accepting a Vibe Tools submission

Review the Skills submission issue in `vibe-gnome/building`. Check that the
project URL is public, the installation instructions are usable, and the summary
accurately describes the tool. Keep credentials out of the listing.

Add an object to the matching `entries` array in `app/lib/tools.ts`, replacing
these example values with the accepted submission:

```ts
{
  id: "gnome-workflow",
  name: "GNOME Workflow",
  description: "Agent guidance for building and checking a Libadwaita app.",
  href: "https://github.com/owner/gnome-workflow",
  bestFor: "GTK and Libadwaita app development.",
}
```

Use a unique `id` and a public HTTPS project or documentation URL. `bestFor` is
optional.

```bash
bun run check
bun run build
```

Preview `/skills` at desktop and mobile widths, including the new
entry's project link. Publishing the rebuilt site makes the entry visible.
