import { isListingCategory } from "../lib/listings";
import type { CatalogStore } from "./catalog-store";
import type { ViewStore } from "./view-store";

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function handleViewsRequest(
  request: Request,
  store: ViewStore,
  catalog: Pick<CatalogStore, "exists">,
) {
  const url = new URL(request.url);
  const match = /^\/api\/views\/([^/]+)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(
    url.pathname,
  );
  const category = match?.[1];
  const slug = match?.[2];
  if (!category || !slug || slug.length > 128 || !isListingCategory(category)) {
    return json({ error: "Listing not found" }, 404);
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
  }
  if (request.method === "POST") {
    const origin = request.headers.get("Origin");
    const site = request.headers.get("Sec-Fetch-Site");
    if (
      (origin !== null && origin !== url.origin) ||
      (site !== null && site !== "same-origin") ||
      request.headers.get("X-Vibe-View") !== "1"
    ) {
      return json({ error: "Same-origin view request required" }, 403);
    }
  }
  try {
    if (!(await catalog.exists(category, slug)))
      return json({ error: "Listing not found" }, 404);
    const views =
      request.method === "POST"
        ? await store.increment(category, slug)
        : await store.read(category, slug);
    return json({ category, slug, views });
  } catch (error) {
    console.error("listing_views_failed", { category, slug, error });
    return json({ error: "View count unavailable" }, 503);
  }
}
