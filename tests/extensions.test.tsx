import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import seed from "../app/data/extensions.json";
import type { ExtensionListing } from "../app/lib/extension-catalog";
import Extension, { meta } from "../app/routes/extension";
import Catalog from "../app/routes/extensions";
import NotFound from "../app/routes/extensions-not-found";
import config from "../react-router.config";

const extensions: ExtensionListing[] = seed.map((entry, index) => ({
  ...entry,
  dbId: index + 1,
}));

function render(page: ReactNode, path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>,
  );
}

function detail(slug: string) {
  return (
    <Extension
      {...({
        params: { slug },
        loaderData: extensions.find((entry) => entry.slug === slug) ?? null,
      } as Parameters<typeof Extension>[0])}
    />
  );
}

describe("integrated extension pages", () => {
  test.each([
    "A focused desktop extension.",
    "  A focused\n desktop\t extension.  ",
    "",
    " \n\t ",
  ])("omits duplicate or empty details: %j", (details) => {
    const entry = extensions[0];
    if (!entry) throw new Error("Missing extension fixture");
    const html = render(
      <Extension
        {...({
          loaderData: {
            ...entry,
            summary: "A focused desktop extension.",
            details,
          },
        } as Parameters<typeof Extension>[0])}
      />,
      "/extensions/1/codex-usage-indicator",
    );
    expect(html).toContain(
      '<p class="detail-summary">A focused desktop extension.</p>',
    );
    expect(html).not.toContain(`<p>${details}</p>`);
    expect(html).toContain("<h2>Requirements</h2>");
  });

  test("preserves distinct details", () => {
    const entry = extensions[0];
    if (!entry) throw new Error("Missing extension fixture");
    const details = "  Additional\nconfiguration options are available.  ";
    const html = render(
      <Extension
        {...({ loaderData: { ...entry, details } } as Parameters<
          typeof Extension
        >[0])}
      />,
      "/extensions/1/codex-usage-indicator",
    );
    expect(html).toContain(`<p>${details}</p>`);
  });

  test.each([
    { features: [] },
    { features: ["", " \n\t "] },
    { features: ["", "Track usage", " "] },
  ])(
    "shows Features only when populated: %j",
    ({ features: fixtureFeatures }) => {
      const features: string[] = [...fixtureFeatures];
      const entry = extensions[0];
      if (!entry) throw new Error("Missing extension fixture");
      const html = render(
        <Extension
          {...({ loaderData: { ...entry, features } } as Parameters<
            typeof Extension
          >[0])}
        />,
        "/extensions/1/codex-usage-indicator",
      );
      if (features.includes("Track usage")) {
        expect(html).toContain("<h2>Features</h2>");
        expect(html).toContain("Track usage</li>");
        expect(html.match(/<li>/g)).toHaveLength(1);
      } else {
        expect(html).not.toContain("<h2>Features</h2>");
        expect(html).not.toContain('class="feature-list"');
      }
    },
  );

  test("shows repository screenshots only when available", () => {
    const entry = extensions[0];
    if (!entry) throw new Error("Missing extension fixture");
    for (const screenshot of [
      undefined,
      "https://repository-images.githubusercontent.com/12345/extension-preview.png",
    ]) {
      const html = render(
        <Extension
          {...({ loaderData: { ...entry, screenshot } } as Parameters<
            typeof Extension
          >[0])}
        />,
        "/extensions/1/codex-usage-indicator",
      );
      if (screenshot) expect(html).toContain(`src="${screenshot}"`);
      else expect(html).not.toContain('class="listing-screenshot"');
    }
  });
  test("catalog links stay under /extensions and filters render from the URL", () => {
    const html = render(
      <Catalog
        {...({ loaderData: extensions } as Parameters<typeof Catalog>[0])}
      />,
      "/extensions?q=kitty&shell=50&view=list",
    );
    expect(html).toContain("Kitty Session Restorer");
    expect(html).not.toContain("Codex Usage Indicator");
    expect(html).toContain('href="/extensions/2/kitty-session-restorer"');
    expect(html).not.toContain('href="/extensions/manage"');
    expect(html).not.toContain('aria-label="Marketplace"');
    expect(html).not.toContain("Manage listings");
    expect(html).not.toContain('href="https://extensions.gnome.org/"');
    expect(html).toContain('class="extension-grid list-view"');
    expect(html).toContain("template=submit-extension.yml");
  });

  test("unknown filters show an empty catalog with a reset action", () => {
    const html = render(
      <Catalog
        {...({ loaderData: extensions } as Parameters<typeof Catalog>[0])}
      />,
      "/extensions?shell=999",
    );
    expect(html).toContain("No extensions found");
    expect(html).toContain("Clear filters");
    expect(html).not.toContain('class="extension-card"');
  });

  test("detail pages keep catalog navigation and upstream installation links", () => {
    for (const entry of extensions) {
      const html = render(detail(entry.slug), `/extensions/${entry.slug}`);
      expect(html).toContain(`<h1>${entry.metadata.name}</h1>`);
      expect(html).toContain("<dt>Views</dt>");
      expect(html).toContain('href="/extensions"');
      for (const tag of entry.tags) {
        expect(html).toContain(
          `href="/extensions?q=${encodeURIComponent(tag)}"`,
        );
      }
      expect(html).toContain(
        `href="${entry.gnomeUrl ?? `${entry.source}#readme`}"`,
      );
      expect(html).not.toContain("Update listing");
      expect(html).toContain("template=remove-extension.yml");
      expect(html).toContain("/vibe-gnome/building/issues/new");
      expect(html).toContain(`src="${entry.icon}"`);
    }
  });

  test("unknown detail and nested paths offer a return to the catalog", () => {
    for (const page of [detail("missing"), <NotFound key="not-found" />]) {
      const html = render(page, "/extensions/missing");
      expect(html).toContain("Page not found");
      expect(html).toContain('href="/extensions"');
    }
    const metadata = meta({
      params: { slug: "missing" },
      data: null,
    } as Parameters<typeof meta>[0]);
    expect(metadata).toContainEqual({ name: "robots", content: "noindex" });
  });

  test("prerenders directory shells and lets D1 supply dynamic detail routes", () => {
    expect(config.ssr).toBe(false);
    expect(config.prerender).not.toContain("/");
    expect(config.prerender).toEqual([
      "/about",
      "/apps",
      "/extensions",
      "/skills",
    ]);
  });
});
