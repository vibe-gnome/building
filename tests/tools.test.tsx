import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { ToolPage } from "../app/components/tool-page";
import { toolCollections, toolSubmissionUrl } from "../app/lib/tools";
import Home from "../app/routes/home";

describe("Vibe Tools navigation", () => {
  test("links to local showcases and the skills directory", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const showcase = html.slice(
      html.indexOf('id="showcases"'),
      html.indexOf('id="resources"'),
    );
    expect(showcase).toContain('href="/apps"');
    expect(showcase).toContain('href="/extensions"');
    expect(showcase).toContain('href="/skills"');
  });

  test("skills uses the shared directory layout and a working issue-form target", async () => {
    const collection = toolCollections.skills;
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToolPage category="skills" />
      </MemoryRouter>,
    );
    expect(html).toContain(`<span>${collection.title}</span>`);
    expect(html).toContain(
      'class="page-shell marketplace directory-page tool-page"',
    );
    expect(html).toContain("Vibe GNOME");
    expect(html).toContain("Community submissions");
    expect(html).toContain(`href="${toolSubmissionUrl("skills")}"`);
    expect(html).toContain("No submissions yet.");

    const url = new URL(toolSubmissionUrl("skills"));
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/vibe-gnome/building/issues/new");
    const template = url.searchParams.get("template");
    const form = Bun.YAML.parse(
      await Bun.file(
        new URL(`../.github/ISSUE_TEMPLATE/${template}`, import.meta.url),
      ).text(),
    ) as {
      name: string;
      description: string;
      body: { id: string; validations: { required: boolean } }[];
    };
    expect(form.name).toBe(collection.submitLabel);
    expect(form.description.length).toBeGreaterThan(0);
    for (const id of ["name", "url", "summary", "setup", "attribution"]) {
      expect(
        form.body.find((field) => field.id === id)?.validations.required,
      ).toBe(true);
    }
    expect(new Set(form.body.map((field) => field.id)).size).toBe(
      form.body.length,
    );
  });
});
