import { isListingCategory, isListingSlug } from "../lib/listings";
import type { CatalogStore } from "./catalog-store";

export async function handleCatalogRequest(
  request: Request,
  store: CatalogStore,
) {
  const url = new URL(request.url);
  const match = /^\/api\/catalog\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname);
  const category = match?.[1];
  const slug = match?.[2];
  const json = (body: unknown, status = 200, headers?: HeadersInit) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      },
    });
  if (
    !category ||
    !isListingCategory(category) ||
    (slug !== undefined && !isListingSlug(slug))
  ) {
    return json({ error: "Listing not found" }, 404);
  }
  if (request.method !== "GET")
    return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
  const after = url.searchParams.get("after") ?? "";
  if (after && !isListingSlug(after))
    return json({ error: "Invalid catalog cursor" }, 400);
  try {
    if (slug) {
      const entry = await store.get(category, slug);
      return entry
        ? json({ category, entry })
        : json({ error: "Listing not found" }, 404);
    }
    const entries = await store.list(category, after, 101);
    const more = entries.length > 100;
    if (more) entries.pop();
    const last = entries.at(-1);
    return json({
      category,
      entries,
      next: more && last ? ("slug" in last ? last.slug : last.id) : null,
    });
  } catch (error) {
    console.error("catalog_read_failed", { category, slug, error });
    return json({ error: "Catalog unavailable" }, 503);
  }
}
