import { describe, expect, test } from "bun:test";
import {
  normalizeAccent,
  normalizeTheme,
  prompts,
  resolveTheme,
} from "../app/lib/preferences";

describe("appearance preferences", () => {
  test("falls back to safe defaults", () => {
    expect(normalizeTheme("unknown")).toBe("system");
    expect(normalizeAccent(null)).toBe("teal");
  });

  test("resolves system and explicit theme choices", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});

describe("agent prompts", () => {
  test("cover the required GNOME toolchains", () => {
    expect(prompts.app).toContain("GTK 4 and Libadwaita");
    expect(prompts.extension).toContain("modern GJS and ES modules");
  });
});
