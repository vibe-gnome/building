import type { ToolEntry } from "./tools";

export function skillTags(entries: readonly ToolEntry[]) {
  const tags = new Map<string, { name: string; count: number }>();
  for (const entry of entries) {
    const seen = new Set<string>();
    for (const value of entry.tags ?? []) {
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

export function filterSkills(
  entries: readonly ToolEntry[],
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
        entry.description,
        entry.bestFor,
        entry.href,
        ...(entry.tags ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        terms.every((term) => text.includes(term)) &&
        (!tag ||
          entry.tags?.some((value) => value.trim().toLocaleLowerCase() === tag))
      );
    })
    .sort((a, b) => {
      const name = a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      return params.get("sort") === "name"
        ? name
        : (b.dbId ?? 0) - (a.dbId ?? 0) || name;
    });
}
