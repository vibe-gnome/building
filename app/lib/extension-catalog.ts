export interface ExtensionListing {
  dbId?: number;
  slug: string;
  metadata: {
    uuid: string;
    name: string;
    description: string;
    version?: number;
    "shell-version": string[];
    url?: string;
  };
  author: string;
  source: string;
  gnomeUrl?: string;
  category: string;
  tags: string[];
  icon: string;
  color: string;
  added: string;
  updated: string;
  summary: string;
  details: string;
  requirements: string;
  features: string[];
}

export function extensionFilters(extensions: readonly ExtensionListing[]) {
  return {
    categories: [...new Set(extensions.map((entry) => entry.category))].sort(),
    shellVersions: [
      ...new Set(
        extensions.flatMap((entry) => entry.metadata["shell-version"]),
      ),
    ].sort((a, b) => Number(b) - Number(a)),
  };
}
export const sortOptions = ["added", "updated", "name"] as const;
export type SortOrder = (typeof sortOptions)[number];

export function filterExtensions(
  listings: ExtensionListing[],
  params: URLSearchParams,
) {
  const terms = (params.get("q") ?? "")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const category = params.get("category");
  const shell = params.get("shell");
  const sort = params.get("sort") ?? "added";

  return listings
    .filter((entry) => {
      const text = [
        entry.metadata.name,
        entry.metadata.description,
        entry.metadata.uuid,
        entry.author,
        entry.summary,
        entry.category,
        ...entry.tags,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        terms.every((term) => text.includes(term)) &&
        (!category || entry.category === category) &&
        (!shell || entry.metadata["shell-version"].includes(shell))
      );
    })
    .sort((a, b) => {
      if (sort === "name")
        return a.metadata.name.localeCompare(b.metadata.name);
      const field = sort === "updated" ? "updated" : "added";
      return (
        b[field].localeCompare(a[field]) ||
        a.metadata.name.localeCompare(b.metadata.name)
      );
    });
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
