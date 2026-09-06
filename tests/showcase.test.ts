import { describe, expect, test } from "bun:test";

const home = await Bun.file(
  new URL("../app/routes/home.tsx", import.meta.url),
).text();
const routeConfig = await Bun.file(
  new URL("../app/routes.ts", import.meta.url),
).text();
const showcases = await Bun.file(
  new URL("../app/lib/showcases.ts", import.meta.url),
).text();
const showcasePage = await Bun.file(
  new URL("../app/components/showcase-page.tsx", import.meta.url),
).text();

describe("community showcases", () => {
  test("links community apps, extensions, and skills to local pages", () => {
    expect(home).toContain("Community showcase");
    expect(home).toContain('href: "/apps"');
    expect(home).toContain('href: "/extensions"');
    expect(home).toContain('href: "/skills"');
    expect(home).toContain('title: "Skills"');
    expect(home).not.toContain("Working loop");
    expect(home).not.toContain("Keep every step runnable.");
    expect(home).not.toContain(
      "Browse projects and reusable agent guidance submitted by the Vibe GNOME community.",
    );
    expect(home).not.toContain("Native software");
    expect(home).not.toContain("Shell additions");
    expect(home).not.toContain("Agent guidance");
    expect(home).not.toContain("extensions.gnome.org");
    expect(home).toContain("showcase-section");
  });

  test("keeps existing routes and registers the Skills directory", () => {
    expect(routeConfig).toContain('route("apps", "routes/apps-layout.tsx", [');
    expect(routeConfig).toContain(
      'route("extensions", "routes/extensions-layout.tsx", [',
    );
    expect(routeConfig).toContain('index("routes/extensions.tsx")');
    expect(routeConfig).not.toContain("routes/extensions-manage.tsx");
    expect(routeConfig).toContain('route(":slug", "routes/extension.tsx")');
    expect(routeConfig).toContain(
      'route("skills", "routes/skills-layout.tsx", [',
    );
  });

  test("renders empty showcase pages without example submissions", () => {
    expect(showcasePage).toContain("Community submissions");
    expect(showcasePage).toContain("entries.map");
    expect(showcasePage).toContain("No submissions yet.");
    expect(showcases).not.toContain("entries:");
    expect(showcases).not.toContain("Vibe GNOME community");
  });

  test("keeps the app and extension showcase introductions compact", () => {
    expect(showcases).not.toContain("Apps made to feel at home on GNOME.");
    expect(showcases).not.toContain("Small changes that reshape the Shell.");
    expect(showcases).not.toContain(
      "Reusable guidance for better GNOME builds.",
    );
    expect(showcasePage).not.toContain("Back to the guide");
    expect(showcasePage).not.toContain("ArrowLeft");
  });
});
