import type { ShowcaseEntry } from "./showcases";

export function appTags(entries: readonly ShowcaseEntry[]) {
  const tags = new Map<string, { name: string; count: number }>();
  for (const entry of entries) {
    const seen = new Set<string>();
    for (const value of entry.tags) {
      const name = value.trim();
      const key = name.toLocaleLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const tag = tags.get(key) ?? { name, count: 0 };
      tag.count++;
      tags.set(key, tag);
    }
  }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterApps(
  entries: readonly ShowcaseEntry[],
  params: URLSearchParams,
) {
  const terms = (params.get("q") ?? "")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const tag = (params.get("tag") ?? "").trim().toLocaleLowerCase();
  return entries
    .filter((entry) => {
      const text = [
        entry.name,
        entry.appId,
        entry.summary,
        entry.submittedBy,
        entry.href,
        ...entry.tags,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        terms.every((term) => text.includes(term)) &&
        (!tag ||
          entry.tags.some((value) => value.trim().toLocaleLowerCase() === tag))
      );
    })
    .sort((a, b) => {
      const name = a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      return params.get("sort") === "name"
        ? name
        : (b.dbId ?? 0) - (a.dbId ?? 0) || name;
    });
}

export function appRepositoryInfo(href: string) {
  try {
    const url = new URL(href);
    const parts = url.pathname.split("/").filter(Boolean);
    return { owner: parts.slice(0, -1).join("/"), host: url.hostname };
  } catch {
    return { owner: "", host: "" };
  }
}
