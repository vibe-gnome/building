import { extensions, filterExtensions } from "../app/lib/extension-catalog";

// Run with: bun examples/catalog-query.ts
const results = filterExtensions(
  extensions,
  new URLSearchParams({ q: "kitty", shell: "50", sort: "name" }),
);
for (const entry of results)
  console.log(`${entry.metadata.name}: ${entry.source}`);
