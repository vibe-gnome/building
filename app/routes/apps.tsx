import { ShowcasePage } from "../components/showcase-page";
import { loadCatalog } from "../lib/catalog-client";
import type { Route } from "./+types/apps";

export {
  CatalogError as ErrorBoundary,
  CatalogLoading as HydrateFallback,
} from "../components/catalog-status";

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  return loadCatalog("apps", request.signal);
}

export function meta() {
  return [
    { title: "App showcase — Vibe GNOME" },
    {
      name: "description",
      content: "Discover community-submitted GNOME apps built with AI agents.",
    },
  ];
}

export default function Apps({ loaderData }: Route.ComponentProps) {
  return <ShowcasePage category="apps" entries={loaderData} />;
}
