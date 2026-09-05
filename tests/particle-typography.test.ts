import { describe, expect, test } from "bun:test";

const component = await Bun.file(
  new URL("../app/components/particle-typography.tsx", import.meta.url),
).text();

describe("particle typography", () => {
  test("supports pointer dispersion and spring return", () => {
    expect(component).toContain("dispersionStrength");
    expect(component).toContain("returnSpeed");
    expect(component).toContain("requestAnimationFrame(animate)");
    expect(component).toContain("aria-label={text}");
    expect(component).toContain("context.measureText(text).width");
  });

  test("keeps the renderer responsive and reduced-motion aware", () => {
    expect(component).toContain("ResizeObserver");
    expect(component).toContain("prefers-reduced-motion: reduce");
    expect(component).toContain("setTransform(dpr, 0, 0, dpr, 0, 0)");
  });
});
