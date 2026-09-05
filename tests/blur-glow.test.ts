import { describe, expect, test } from "bun:test";
import {
  CYCLE_WORDS,
  lerpPaletteUniforms,
  PALETTES,
  paletteUniforms,
  WORDS,
} from "../app/lib/blur-glow/params";
import { BLUR_FRAG, COMPOSITE_FRAG } from "../app/lib/blur-glow/shaders";

const stylesheet = await Bun.file(
  new URL("../app/app.css", import.meta.url),
).text();
const hero = await Bun.file(
  new URL("../app/components/blur-glow-hero.tsx", import.meta.url),
).text();

describe("blur glow palettes", () => {
  test("provides ordered five-stop palettes with normalized colors", () => {
    expect(PALETTES).toHaveLength(6);

    for (const palette of PALETTES) {
      expect(palette.stops).toHaveLength(5);
      expect(palette.stops.map(({ pos }) => pos)).toEqual(
        [...palette.stops].map(({ pos }) => pos).sort((a, b) => a - b),
      );

      const channels = [
        ...palette.stops.flatMap(({ color }) => color),
        ...palette.ink,
        ...palette.paper,
      ];
      expect(channels.every((channel) => channel >= 0 && channel <= 1)).toBe(
        true,
      );
    }
  });

  test("preserves palette endpoints while interpolating", () => {
    const [first, second] = PALETTES;
    if (!first || !second) throw new Error("Expected at least two palettes");
    const from = paletteUniforms(first);
    const to = paletteUniforms(second);

    expect(lerpPaletteUniforms(from, to, 0)).toEqual(from);
    expect(lerpPaletteUniforms(from, to, 1)).toEqual(to);
  });

  test("shows the complete hero message without cycling", () => {
    expect(WORDS).toEqual(["Vibe coding for GNOME.\nWhy not?"]);
    expect(CYCLE_WORDS).toBe(false);
  });

  test("starts with a GNOME green letter palette", () => {
    const first = PALETTES[0];
    expect(first?.name).toBe("GNOME Green");
    expect(first?.stops[1]?.color[1]).toBeGreaterThan(
      first?.stops[1]?.color[2] ?? 1,
    );
  });

  test("keeps the fallback hidden until WebGL readiness is known", () => {
    expect(hero).toContain('"pending" | "enhanced" | "fallback"');
    expect(hero).toContain('setPresentation("fallback")');
    expect(hero).toContain('setPresentation("enhanced")');
    expect(stylesheet).toContain(
      '.hero-copy[data-webgl="pending"] .hero-heading',
    );
  });
});

describe("blur glow shaders", () => {
  test("uses a nine-tap separable blur and four bloom levels", () => {
    for (const offset of ["1.0", "2.0", "3.0", "4.0"]) {
      expect(BLUR_FRAG).toContain(`direction * ${offset}`);
    }

    for (const level of ["uL0", "uL1", "uL2", "uL3"]) {
      expect(COMPOSITE_FRAG).toContain(`sampler2D ${level}`);
    }
  });

  test("keeps the canvas transparent outside the glow", () => {
    expect(COMPOSITE_FRAG).toContain(
      "float alpha = smoothstep(0.12, 0.38, field) * edgeFade",
    );
    expect(COMPOSITE_FRAG).toContain("smoothstep(0.0, 0.12, vUv.x)");
    expect(COMPOSITE_FRAG).not.toContain("pow(field, 0.34)");
  });
});
