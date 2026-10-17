import { badgeSiteUrl } from "./badge";
import { type CatalogFetcher, loadCatalog } from "./catalog-client";
import { listingPath } from "./listing-links";

export interface BadgeProject {
  name: string;
  category: "apps" | "extensions";
  url: string;
}

export async function loadBadgeProjects(
  signal: AbortSignal,
  fetcher: CatalogFetcher = fetch,
): Promise<BadgeProject[]> {
  const [apps, extensions] = await Promise.all([
    loadCatalog("apps", signal, fetcher),
    loadCatalog("extensions", signal, fetcher),
  ]);
  return [
    ...apps.map((entry) => ({
      name: entry.name,
      category: "apps" as const,
      url: `${badgeSiteUrl}${listingPath("apps", entry)}`,
    })),
    ...extensions.map((entry) => ({
      name: entry.metadata.name,
      category: "extensions" as const,
      url: `${badgeSiteUrl}${listingPath("extensions", entry)}`,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.url.localeCompare(b.url));
}

export function findBadgeProjects(
  projects: readonly BadgeProject[],
  query: string,
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return projects.filter((project) =>
    terms.every((term) => project.name.toLocaleLowerCase().includes(term)),
  );
}
