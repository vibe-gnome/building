import { describe, expect, test } from "bun:test";

const stylesheet = await Bun.file(
  new URL("../app/app.css", import.meta.url),
).text();
const logo = await Bun.file(
  new URL("../public/logo.svg", import.meta.url),
).text();
const home = await Bun.file(
  new URL("../app/routes/home.tsx", import.meta.url),
).text();
const footer = await Bun.file(
  new URL("../app/components/site-footer.tsx", import.meta.url),
).text();

describe("motion restraint", () => {
  test("gives the footprint trail a quick, orchestrated reveal", () => {
    expect(stylesheet).toContain("@keyframes footprint-step-in");
    expect(stylesheet).toContain(".footprint.is-visible");
    expect(stylesheet).toContain("animation: footprint-step-in 700ms");
    expect(stylesheet).toContain("scale(1.09)");
    expect(stylesheet).toContain(".footprint-run");
    expect(home).toContain("observer.observe(trail)");
    expect(home).toContain("index * 85");
    expect(stylesheet).not.toContain(".hero.is-visible");
  });

  test("disables smooth scrolling when reduced motion is requested", () => {
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("scroll-behavior: auto");
    expect(stylesheet).toContain("animation: none");
  });

  test("uses the shared paw mark with accent-aware colors", () => {
    expect(logo).toContain('id="paw-print"');
    expect(home).toContain('className="brand-logo"');
    expect(home).toContain('href="/logo.svg#paw-print"');
    expect(home.match(/<LogoMark \/>/g)).toHaveLength(1);
    expect(footer).toContain('className="brand-logo"');
    expect(footer).toContain('href="/logo.svg#paw-print"');
    expect(stylesheet).toContain("border-radius: 4px");
    expect(stylesheet).toContain("background: var(--accent)");
    expect(stylesheet).toContain("fill: var(--accent-ink)");
    expect(stylesheet).toContain("--footprint-color: #000000");
    expect(stylesheet).toContain("--footprint-color: #ffffff");
  });

  test("keeps the footer border free of animated decoration", () => {
    expect(home).not.toContain("RunningCat");
    expect(stylesheet).not.toContain(".running-cat");
  });
});
