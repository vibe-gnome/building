import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { ShowcasePage } from "../app/components/showcase-page";
import { appRepositoryInfo, appTags, filterApps } from "../app/lib/app-catalog";
import type { ShowcaseEntry } from "../app/lib/showcases";

const apps: ShowcaseEntry[] = [
  {
    dbId: 5,
    id: "cusco",
    appId: "io.github.stonega.Cusco",
    name: "Cusco",
    href: "https://github.com/stonega/cusco",
    summary: "A native AI chat workspace.",
    submittedBy: "",
    tags: ["AI", "GTK", "gtk", " "],
  },
  {
    dbId: 2,
    id: "planner",
    appId: "us.hagreli.Planner",
    name: "Planner",
    href: "https://github.com/mhagrelius/planner",
    summary: "Organize projects and tasks.",
    submittedBy: "Maintainer",
    tags: ["Productivity", "GTK"],
  },
  {
    dbId: 1,
    id: "amber",
    name: "Amber",
    href: "https://gitlab.gnome.org/Community/Amber",
    summary: "A simple note editor.",
    submittedBy: "",
    tags: ["Productivity"],
  },
];

function render(path = "/apps", entries = apps) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ShowcasePage category="apps" entries={entries} />
    </MemoryRouter>,
  );
}

describe("app catalog", () => {
  test("combines all search terms with a case-insensitive tag filter", () => {
    expect(
      filterApps(apps, new URLSearchParams("q=STONEGA+chat&tag=gtk")).map(
        (entry) => entry.id,
      ),
    ).toEqual(["cusco"]);
    expect(
      filterApps(
        apps,
        new URLSearchParams("q=Maintainer+tasks&tag=productivity"),
      ).map((entry) => entry.id),
    ).toEqual(["planner"]);
    expect(
      filterApps(apps, new URLSearchParams("q=io.github.stonega.Cusco")),
    ).toHaveLength(1);
    expect(
      filterApps(apps, new URLSearchParams("q=chat&tag=Productivity")),
    ).toHaveLength(0);
    expect(filterApps(apps, new URLSearchParams("tag=missing"))).toHaveLength(
      0,
    );
  });

  test("sorts by listing ID or name without mutating the catalog", () => {
    const original = apps.map((entry) => entry.id);
    for (const sort of ["added", "invalid"])
      expect(
        filterApps(apps, new URLSearchParams({ sort })).map(
          (entry) => entry.id,
        ),
      ).toEqual(["cusco", "planner", "amber"]);
    expect(
      filterApps(apps, new URLSearchParams("sort=name")).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Amber", "Cusco", "Planner"]);
    expect(apps.map((entry) => entry.id)).toEqual(original);
    const legacy = apps.map((entry) => ({
      ...entry,
      dbId: undefined,
      name: "Same name",
    }));
    expect(
      filterApps(legacy, new URLSearchParams()).map((entry) => entry.id),
    ).toEqual(["amber", "cusco", "planner"]);
  });

  test("counts each tag once per app and excludes blank tags", () => {
    expect(appTags(apps)).toEqual([
      { name: "AI", count: 1 },
      { name: "GTK", count: 2 },
      { name: "Productivity", count: 2 },
    ]);
  });

  test("uses repository ownership without confusing it with a submitter", () => {
    expect(appRepositoryInfo(apps[0]?.href ?? "")).toEqual({
      owner: "stonega",
      host: "github.com",
    });
    expect(
      appRepositoryInfo("https://gitlab.gnome.org/GNOME/Incubator/App"),
    ).toEqual({ owner: "GNOME/Incubator", host: "gitlab.gnome.org" });
    expect(appRepositoryInfo("https://example.org")).toEqual({
      owner: "",
      host: "example.org",
    });
    expect(appRepositoryInfo("invalid")).toEqual({ owner: "", host: "" });
  });

  test("renders catalog controls, matching cards, and canonical detail links", () => {
    const html = render("/apps?tag=ai&view=list&sort=name");
    expect(html).toContain('aria-label="Search apps"');
    expect(html).toContain('aria-label="Sort apps"');
    expect(html).toContain(
      '<option value="name" selected="">Name: A to Z</option>',
    );
    expect(html).toContain('class="extension-grid list-view"');
    expect(html).toContain('class="extension-card app-card"');
    expect(html).toContain('src="/icons/showcase/apps.svg"');
    expect(html).toContain('href="/apps/5/cusco"');
    expect(html).toContain('href="https://github.com/stonega/cusco"');
    expect(html).toContain("View app");
    expect(html).toContain("by stonega");
    expect(html).toContain('role="status">1 app of 3</p>');
    expect(html).toContain("submit-app.yml");
    expect(html).not.toContain("GNOME Shell");
    expect(html).not.toContain("Recently updated");
  });

  test("shows filtered and unfiltered empty catalogs without fake entries", () => {
    const filtered = render("/apps?q=missing");
    expect(filtered).toContain("No apps found");
    expect(filtered).toContain("Clear filters");
    expect(filtered).not.toContain('class="extension-card app-card"');
    const empty = render("/apps", []);
    expect(empty).toContain('role="status">0 apps</p>');
    expect(empty).toContain("No apps found");
    expect(empty).not.toContain("Clear filters");
  });
});
