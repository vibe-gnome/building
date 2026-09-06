import { ToolPage } from "../components/tool-page";
import { loadCatalog } from "../lib/catalog-client";
import type { Route } from "./+types/skills";

export {
  CatalogError as ErrorBoundary,
  CatalogLoading as HydrateFallback,
} from "../components/catalog-status";

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  return loadCatalog("skills", request.signal);
}

export function meta() {
  return [
    { title: "Skills | Vibe Tools | Vibe GNOME" },
    {
      name: "description",
      content:
        "Discover community-submitted agent skills for building GNOME software.",
    },
  ];
}

export default function Skills({ loaderData }: Route.ComponentProps) {
  return <ToolPage category="skills" entries={loaderData} />;
}
