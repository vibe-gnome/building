import { handleCatalogRequest } from "./server/catalog-api";
import { createCatalogStore } from "./server/catalog-store";
import { createViewStore } from "./server/view-store";
import { handleViewsRequest } from "./server/views-api";

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/catalog/")) {
      return handleCatalogRequest(request, createCatalogStore(env.DB));
    }
    if (path.startsWith("/api/views/")) {
      return handleViewsRequest(
        request,
        createViewStore(env.DB),
        createCatalogStore(env.DB),
      );
    }
    if (path.startsWith("/api/"))
      return Response.json({ error: "Not found" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
