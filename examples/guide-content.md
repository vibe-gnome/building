# Add an article to Guides

Add a verified article to `guideArticles` in `app/lib/guides.ts`. This existing
entry is a copy-ready example of the metadata shape:

```ts
{
  id: "vibe-learning",
  kind: "Doc",
  title: "Vibing a GNOME Extension When You Know Nothing About GNOME",
  description:
    "Building a speech-to-text extension with AI, with lessons on GNOME APIs, debugging, and learning as you go.",
  href: "https://kaveh.page/blog/vibe-learning",
  source: "kaveh.page",
}
```

Use a unique ID, the original title, a short factual summary, and its public
HTTPS URL. Array order controls article order; Home previews the first article
and `/guides` displays them all. Skills come from the published catalog, ordered
by descending database ID, and must not be copied into this array.

Run `bun run check` and `bun run build`. With the local Worker and Vite running,
open `http://localhost:5173/#guides`, follow **See all**, and check the collection
at desktop and mobile widths. See [local setup](../docs/implementation/setup.md)
for the Worker API commands.
