import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { ToolPage } from "../app/components/tool-page";
import { filterSkills, skillTags } from "../app/lib/skill-catalog";
import type { ToolEntry } from "../app/lib/tools";

const skills: ToolEntry[] = [
  {
    id: "gtk-builder",
    dbId: 9,
    name: "GTK Builder",
    description: "Build accessible desktop interfaces.",
    href: "https://github.com/example/gtk-builder",
    bestFor: "GNOME apps",
    tags: ["GTK", "gtk", " ", "Accessibility"],
  },
  {
    id: "adwaita-guide",
    dbId: 3,
    name: "Adwaita Guide",
    description: "Review native interface patterns.",
    href: "https://github.com/example/adwaita-guide",
    tags: ["GTK"],
  },
  {
    id: "shell-guide",
    name: "Shell Guide",
    description: "Build GNOME extensions.",
    href: "https://example.com/shell",
  },
];

function render(path: string, entries = skills) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ToolPage category="skills" entries={entries} />
    </MemoryRouter>,
  );
}

describe("skill catalog", () => {
  test("combines search terms and tags while accepting optional metadata", () => {
    expect(
      filterSkills(skills, new URLSearchParams("q=ACCESSIBLE+gnome&tag=gtk")),
    ).toEqual(skills.slice(0, 1));
    expect(
      filterSkills(skills, new URLSearchParams("q=example.com+extensions")),
    ).toEqual(skills.slice(2, 3));
    expect(filterSkills(skills, new URLSearchParams("tag=missing"))).toEqual(
      [],
    );
    expect(
      filterSkills(skills, new URLSearchParams("q=extensions&tag=GTK")),
    ).toEqual([]);
    expect(skillTags(skills)).toEqual([
      { name: "Accessibility", count: 1 },
      { name: "GTK", count: 2 },
    ]);
  });

  test("sorts recent listings and names without changing the original entries", () => {
    const entries = [skills[1], skills[2], skills[0]] as ToolEntry[];
    for (const sort of ["added", "invalid"])
      expect(filterSkills(entries, new URLSearchParams({ sort }))).toEqual(
        skills,
      );
    expect(
      filterSkills(entries, new URLSearchParams("sort=name")).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Adwaita Guide", "GTK Builder", "Shell Guide"]);
    expect(entries.map((entry) => entry.id)).toEqual([
      "adwaita-guide",
      "shell-guide",
      "gtk-builder",
    ]);
  });

  test("URL filters and view mode render the matching cards with existing links", () => {
    const html = render("/skills?tag=accessibility&view=list&sort=name");
    expect(html).toContain('class="extension-grid list-view"');
    expect(html).toContain('role="status">1 skill of 3</p>');
    expect(html).toContain('src="/icons/showcase/skills.svg"');
    expect(html).toContain('href="/skills/9/gtk-builder"');
    expect(html).toContain('href="https://github.com/example/gtk-builder"');
    expect(html).toContain("<dt>Best for</dt>");
    expect(html).toContain("View skill");
    expect(html).not.toContain("Adwaita Guide");
  });

  test("empty catalogs and unmatched filters have distinct recovery states", () => {
    const empty = render("/skills", []);
    expect(empty).toContain("No skills found");
    expect(empty).not.toContain("Clear filters");
    const filtered = render("/skills?q=missing");
    expect(filtered).toContain("No skills found");
    expect(filtered).toContain("Clear filters");
    expect(filtered).not.toContain('class="extension-card skill-card"');
  });
});
