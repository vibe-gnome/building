import { describe, expect, test } from "bun:test";

const stylesheet = await Bun.file(
  new URL("../app/app.css", import.meta.url),
).text();
const home = await Bun.file(
  new URL("../app/routes/home.tsx", import.meta.url),
).text();
const footer = await Bun.file(
  new URL("../app/components/site-footer.tsx", import.meta.url),
).text();

describe("hero layout", () => {
  test("stacks the enlarged heading above the prompt panel", () => {
    expect(stylesheet).toMatch(
      /\.hero \{[\s\S]*?grid-template-columns: 1fr;[\s\S]*?justify-items: center;/,
    );
    expect(stylesheet).toContain("font-size: clamp(4.2rem, 8.2vw, 7.25rem)");
    expect(stylesheet).toContain("width: min(760px, 100%)");
    expect(stylesheet).toMatch(
      /\.hero\.page-shell \{[\s\S]*?padding-bottom: 0;/,
    );
  });
});

describe("idea list", () => {
  test("presents app and extension ideas as a conversation", () => {
    expect(home).toContain('aria-label="Vibe coding ideas"');
    expect(home).toContain('className="idea-chat"');
    expect(home.match(/kind: "App"/g)).toHaveLength(4);
    expect(home.match(/kind: "Extension"/g)).toHaveLength(4);
    expect(home).toContain("local photo culler");
    expect(home).toContain("workspace scratchpad");
    expect(home).not.toContain("Ideas to try");
    expect(home).not.toContain("What could you vibe code?");
    expect(home).not.toContain('className="path-list"');
    expect(stylesheet).toContain(".ideas-section");
    expect(stylesheet).toContain(".content-section.ideas-section");
    expect(stylesheet).toMatch(
      /\.content-section\.ideas-section \{[\s\S]*?width: 100%;[\s\S]*?padding-top: 0;/,
    );
    expect(stylesheet).toMatch(
      /\.content-section\.ideas-section \{[\s\S]*?border-top: 0;/,
    );
    expect(stylesheet).toMatch(
      /\.content-section\.ideas-section \+ \.showcase-section \{[\s\S]*?border-top: 0;/,
    );
    expect(stylesheet).toMatch(/\.idea-chat \{[\s\S]*?width: 100%;/);
    expect(stylesheet).toContain("width: 84%");
    expect(stylesheet).toContain('.idea-chat li[data-kind="extension"]');
    expect(stylesheet).toContain("box-shadow: var(--bubble-shadow)");
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
