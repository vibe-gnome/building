import { loadCatalog } from "../app/lib/catalog-client";
import { filterExtensions } from "../app/lib/extension-catalog";

const extensions = await loadCatalog(
  "extensions",
  AbortSignal.timeout(20_000),
  (path, init) => fetch(`https://vibe-gnome.org${path}`, init),
);

// Run with: bun examples/catalog-query.ts
const results = filterExtensions(
  extensions,
  new URLSearchParams({ q: "kitty", shell: "50", sort: "name" }),
);
for (const entry of results)
  console.log(`${entry.metadata.name}: ${entry.source}`);
