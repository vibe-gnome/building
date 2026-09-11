import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { ToolPage } from "../app/components/tool-page";
import { toolCollections } from "../app/lib/tools";
import Home from "../app/routes/home";

describe("Vibe Tools navigation", () => {
  test("links the community showcase to apps and extensions", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const showcase = html.slice(
      html.indexOf('id="showcases"'),
      html.indexOf('id="guides"'),
    );
    expect(showcase).toContain('href="/apps"');
    expect(showcase).toContain('href="/extensions"');
    expect(showcase).not.toContain('href="/skills"');
  });

  test("skills uses the shared catalog layout without a submission action", () => {
    const collection = toolCollections.skills;
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToolPage category="skills" entries={[]} />
      </MemoryRouter>,
    );
    expect(html).toContain(`<span>${collection.title}</span>`);
    expect(html).toContain('class="page-shell marketplace skill-catalog"');
    expect(html).toContain(`<h1>GNOME <span>${collection.title}</span></h1>`);
    expect(html).toContain('aria-label="Search skills"');
    expect(html).toContain('aria-label="Sort skills"');
    expect(html).toContain('aria-label="Grid view"');
    expect(html).toContain('aria-label="List view"');
    expect(html).not.toContain("Submit a skill");
    expect(html).not.toContain("/issues/new");
    expect(html).toContain("No skills found");
  });
});
