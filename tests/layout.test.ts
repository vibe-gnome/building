import { describe, expect, test } from "bun:test";

const stylesheet = await Bun.file(
  new URL("../app/app.css", import.meta.url),
).text();
const home = await Bun.file(
  new URL("../app/routes/home.tsx", import.meta.url),
).text();
const ideas = await Bun.file(
  new URL("../app/components/idea-footprints.tsx", import.meta.url),
).text();
const footer = await Bun.file(
  new URL("../app/components/site-footer.tsx", import.meta.url),
).text();

describe("hero layout", () => {
  test("centers the particle typography hero", () => {
    expect(stylesheet).toMatch(
      /\.hero \{[\s\S]*?grid-template-columns: 1fr;[\s\S]*?justify-items: center;/,
    );
    expect(stylesheet).toContain(".particle-typography");
    expect(home).toContain('text={"Vibe coding for GNOME.\\nWhy not?"}');
    expect(home).toContain("ParticleTypography");
    expect(stylesheet).toMatch(
      /\.hero \{[\s\S]*?min-height: calc\(100svh - var\(--site-header-height\)\);/,
    );
  });
});

describe("idea discovery", () => {
  test("keeps all eight app and extension ideas available from the hero", () => {
    expect(home).toContain("<IdeaFootprints />");
    expect(ideas).toContain('aria-label="Vibe coding ideas"');
    expect(ideas.match(/kind: "App"/g)).toHaveLength(4);
    expect(ideas.match(/kind: "Extension"/g)).toHaveLength(4);
    expect(ideas).toContain("local photo culler");
    expect(ideas).toContain("workspace scratchpad");
  });
});

describe("footer", () => {
  test("states that the project is independent from GNOME", () => {
    expect(footer).toContain('className="footer-identity"');
    expect(footer).toContain("independent community project");
    expect(footer).toMatch(/not\s+affiliated/);
    expect(footer).toContain("GNOME Foundation");
    expect(footer).not.toContain("<span>vibe gnome</span>");
    expect(stylesheet).toContain(".footer-disclaimer");
  });

  test("links to About and both community spaces", () => {
    expect(home).toContain("<SiteFooter />");
    expect(footer).toContain('to="/about"');
    expect(footer).toContain('aria-label="Community links"');
    expect(footer).toContain('href="https://github.com/orgs/vibe-gnome"');
    expect(footer).toContain('href="https://www.reddit.com/r/vibe_gnome/"');
  });
});
