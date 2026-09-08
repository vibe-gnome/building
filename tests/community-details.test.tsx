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
      screenshot:
        "https://repository-images.githubusercontent.com/12345/app-preview.png",
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
    if (category === "apps")
      expect(html).toContain(`src="${apps[0]?.screenshot}"`);
    else expect(html).not.toContain('class="listing-screenshot"');
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
