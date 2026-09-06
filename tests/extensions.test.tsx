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

const extensions: ExtensionListing[] = seed;

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
  test("catalog links stay under /extensions and filters render from the URL", () => {
    const html = render(
      <Catalog
        {...({ loaderData: extensions } as Parameters<typeof Catalog>[0])}
      />,
      "/extensions?q=kitty&shell=50&view=list",
    );
    expect(html).toContain("Kitty Session Restorer");
    expect(html).not.toContain("Codex Usage Indicator");
    expect(html).toContain('href="/extensions/kitty-session-restorer"');
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
      expect(html).toContain("template=update-extension.yml");
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
