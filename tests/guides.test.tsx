import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { GuideList } from "../app/components/guide-list";
import { loadCatalog } from "../app/lib/catalog-client";
import { guideArticles, skillGuides } from "../app/lib/guides";
import type { ToolEntry } from "../app/lib/tools";
import type { GuideSkillsState } from "../app/lib/use-guide-skills";
import GuidesPage from "../app/routes/guides";
import Home from "../app/routes/home";

const skills: ToolEntry[] = [1, 4, 2, 3].map((dbId) => ({
  dbId,
  id: `skill-${dbId}`,
  name: `GNOME Skill ${dbId}`,
  description: `Guidance for project ${dbId}.`,
  href: `https://skills.sh/example/gnome/skill-${dbId}`,
}));

function renderList(state: GuideSkillsState, preview = false) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <GuideList state={state} retry={() => {}} preview={preview} />
    </MemoryRouter>,
  );
}

describe("Guides", () => {
  test("places Guides between the showcase and trusted resources", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(html.indexOf('id="guides"')).toBeGreaterThan(
      html.indexOf('id="showcases"'),
    );
    expect(html.indexOf('id="resources"')).toBeGreaterThan(
      html.indexOf('id="guides"'),
    );
    expect(html).toContain('href="/guides"');
  });

  test("previews the article and three newest skills, with See all last", () => {
    const html = renderList({ status: "ready", entries: skills }, true);
    expect(html).toContain(`href="${guideArticles[0]?.href}"`);
    expect(html).toContain('target="_blank" rel="noreferrer"');
    expect(html).toContain('href="/skills/4/skill-4"');
    expect(html).not.toContain("GNOME Skill 1");
    expect(html.indexOf("GNOME Skill 4")).toBeLessThan(
      html.indexOf("GNOME Skill 3"),
    );
    expect(html.indexOf("GNOME Skill 3")).toBeLessThan(
      html.indexOf("GNOME Skill 2"),
    );
    expect(html.lastIndexOf('href="')).toBe(html.indexOf('href="/guides"'));
    expect(skills.map((skill) => skill.dbId)).toEqual([1, 4, 2, 3]);
  });

  test("the full collection includes skills from every catalog page", async () => {
    const urls: string[] = [];
    const entries = await loadCatalog(
      "skills",
      new AbortController().signal,
      async (url) => {
        urls.push(url);
        return Response.json({
          category: "skills",
          entries: urls.length === 1 ? skills.slice(0, 2) : skills.slice(2),
          next: urls.length === 1 ? "skill-4" : null,
        });
      },
    );
    expect(urls).toEqual([
      "/api/catalog/skills",
      "/api/catalog/skills?after=skill-4",
    ]);
    const html = renderList({ status: "ready", entries });
    for (const entry of skillGuides(skills))
      expect(html).toContain(`href="${entry.href}"`);
    expect(html).not.toContain("See all");
  });

  test("keeps articles available in loading, error, and empty states", () => {
    for (const state of [
      { status: "loading" },
      { status: "error" },
      { status: "ready", entries: [] },
    ] satisfies GuideSkillsState[]) {
      const html = renderList(state, true);
      expect(html).toContain(`href="${guideArticles[0]?.href}"`);
      expect(html).toContain('href="/guides"');
      expect(html.includes("Try again")).toBe(state.status === "error");
      expect(html.includes("No skills published yet")).toBe(
        state.status === "ready",
      );
    }
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GuidesPage />
      </MemoryRouter>,
    );
    expect(html).toContain("<h1>");
    expect(html).toContain(`href="${guideArticles[0]?.href}"`);
    expect(html).toContain('href="/#guides"');
  });
});
