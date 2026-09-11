import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import {
  CommunityDetail,
  communityDetailMeta,
} from "../app/components/community-detail";
import { ShowcasePage } from "../app/components/showcase-page";
import { ToolPage } from "../app/components/tool-page";
import type { ShowcaseEntry } from "../app/lib/showcases";
import type { ToolEntry } from "../app/lib/tools";

test("apps and skills link to details that display views and preserve project links", () => {
  const apps: ShowcaseEntry[] = [
    {
      id: "example-app",
      dbId: 1,
      appId: "org.example.Example_App",
      name: "Example App",
      summary: "App description",
      icon: `https://raw.githubusercontent.com/example/app/${"a".repeat(40)}/icon.svg`,
      screenshot: `https://raw.githubusercontent.com/example/app/${"a".repeat(40)}/screen.png`,
      href: "https://example.com/app",
      submittedBy: "Maintainer",
      tags: ["GTK"],
    },
  ];
  const skills: ToolEntry[] = [
    {
      id: "example-skill",
      dbId: 2,
      name: "Example Skill",
      description: "Skill description",
      href: "https://example.com/skill",
      bestFor: "GNOME",
      tags: ["Libadwaita"],
    },
  ];
  for (const category of ["apps", "skills"] as const) {
    const slug = category === "apps" ? "example-app" : "example-skill";
    const index = renderToStaticMarkup(
      <MemoryRouter>
        {category === "apps" ? (
          <ShowcasePage category="apps" entries={apps} />
        ) : (
          <ToolPage category="skills" entries={skills} />
        )}
      </MemoryRouter>,
    );
    expect(index).toContain(
      `href="/${category}/${category === "apps" ? 1 : 2}/${slug}"`,
    );
    if (category === "skills")
      expect(index).toContain("<span>Libadwaita</span>");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CommunityDetail
          category={category}
          data={(category === "apps" ? apps[0] : skills[0]) ?? null}
        />
      </MemoryRouter>,
    );
    expect(html).toContain("<dt>Views</dt>");
    expect(html).toContain("Loading…");
    expect(html).toContain(`href="/${category}"`);
    expect(html).toContain(
      `href="https://example.com/${category === "apps" ? "app" : "skill"}"`,
    );
    expect(html).not.toContain("Page not found");
    if (category === "apps") {
      expect(html).toContain(`src="${apps[0]?.screenshot}"`);
      expect(html).toContain('alt="Example App preview"');
      expect(html).toContain(`src="${apps[0]?.icon}"`);
    } else {
      expect(html).not.toContain('class="extension-icon');
      expect(html).not.toContain('class="listing-screenshot"');
      expect(html).toContain("<span>Libadwaita</span>");
    }
  }
});

test("unknown app and skill details do not record views", () => {
  for (const category of ["apps", "skills"] as const) {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CommunityDetail category={category} data={null} />
      </MemoryRouter>,
    );
    expect(html).toContain("Page not found");
    expect(html).not.toContain("<dt>Views</dt>");
    expect(communityDetailMeta(null)).toContainEqual({
      name: "robots",
      content: "noindex",
    });
  }
});

test("app details use the extension information layout with app-specific links and identity", () => {
  const entry: ShowcaseEntry = {
    id: "cusco",
    dbId: 2,
    appId: "io.github.stonega.Cusco",
    name: "Cusco",
    summary: "A native GNOME chat app.",
    href: "https://github.com/stonega/cusco",
    submittedBy: "Contributor",
    tags: ["GTK", "AI & chat"],
  };
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <CommunityDetail category="apps" data={entry} />
    </MemoryRouter>,
  );
  expect(html).toContain('class="detail-heading"');
  expect(html).toContain('class="detail-layout"');
  expect(html).toContain('aria-label="App information"');
  expect(html).toContain('class="extension-icon large"');
  expect(html).toContain('href="https://github.com/stonega"');
  expect(html).toContain('href="https://github.com/stonega/cusco#readme"');
  expect(html).toContain("Installation instructions");
  expect(html).toContain("View source");
  expect(html).toContain("<dt>App ID</dt>");
  expect(html).toContain("<code>io.github.stonega.Cusco</code>");
  expect(html).toContain('aria-label="Copy App ID"');
  expect(html).toContain("<dt>Submitted by</dt>");
  expect(html).toContain("<dd>Contributor</dd>");
  expect(html).toContain('href="/apps?tag=AI%20%26%20chat"');
  expect(html).toContain("Report listing");
  const reportHref = html
    .match(/href="([^"]+issues\/new[^"]+)"/)?.[1]
    ?.replaceAll("&amp;", "&");
  const report = new URL(reportHref ?? "");
  expect(report.pathname).toBe("/vibe-gnome/building/issues/new");
  expect(report.searchParams.get("title")).toBe("[App report] Cusco");
  expect(report.searchParams.get("body")).toContain(entry.href);
  expect(report.searchParams.get("body")).toContain(entry.appId ?? "");
  for (const missing of [
    "GNOME Shell",
    "Extension UUID",
    "<dt>Version</dt>",
    "<h2>Features</h2>",
    "<dt>Updated</dt>",
  ])
    expect(html).not.toContain(missing);
});

test("legacy app details omit missing identity and retain the fallback icon", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <CommunityDetail
        category="apps"
        data={{
          id: "legacy",
          name: "Legacy",
          href: "https://example.org",
          summary: "Legacy app.",
          submittedBy: "",
          tags: [],
        }}
      />
    </MemoryRouter>,
  );
  expect(html).toContain('src="/icons/showcase/apps.svg"');
  expect(html).not.toContain("<dt>App ID</dt>");
  expect(html).not.toContain('aria-label="Copy App ID"');
  expect(html).not.toContain("<dt>Submitted by</dt>");
  expect(html).not.toContain('class="listing-screenshot"');
  expect(html).not.toContain('class="tag-list"');
});
