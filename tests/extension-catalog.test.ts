import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  extensions,
  filterExtensions,
  formatDate,
} from "../app/lib/extension-catalog";
import { issueUrl, site } from "../app/lib/extension-submissions";

describe("catalog browsing", () => {
  test("matches all search terms across author, name, and tags", () => {
    expect(
      filterExtensions(
        extensions,
        new URLSearchParams({ q: "  STONEGA usage  " }),
      ).map((entry) => entry.slug),
    ).toEqual(["codex-usage-indicator"]);
  });
  test("combines category, search, and official Shell compatibility", () => {
    expect(
      filterExtensions(
        extensions,
        new URLSearchParams({ category: "Workflow", shell: "50", q: "kitty" }),
      ),
    ).toHaveLength(1);
    expect(
      filterExtensions(
        extensions,
        new URLSearchParams({ category: "Workflow", shell: "49" }),
      ),
    ).toHaveLength(0);
    expect(
      filterExtensions(extensions, new URLSearchParams({ shell: "999" })),
    ).toHaveLength(0);
    expect(
      filterExtensions(
        extensions,
        new URLSearchParams({ category: "unknown" }),
      ),
    ).toHaveLength(0);
  });
  test("sorts independently of the source array and deterministically breaks ties", () => {
    const input = [...extensions].reverse();
    const original = [...input];
    expect(
      filterExtensions(input, new URLSearchParams({ sort: "name" }))[0]?.slug,
    ).toBe("codex-usage-indicator");
    expect(
      filterExtensions(input, new URLSearchParams({ sort: "updated" }))[0]
        ?.slug,
    ).toBe("codex-usage-indicator");
    expect(input).toEqual(original);
  });
  test("formats calendar dates without timezone drift", () => {
    expect(formatDate("2026-09-05")).toBe("Sep 5, 2026");
  });
});

describe("reviewed listing integrity", () => {
  test("slugs and GNOME UUIDs are unique", () => {
    expect(new Set(extensions.map((entry) => entry.slug)).size).toBe(
      extensions.length,
    );
    expect(new Set(extensions.map((entry) => entry.metadata.uuid)).size).toBe(
      extensions.length,
    );
  });
  for (const entry of extensions) {
    test(`${entry.slug} has usable metadata, assets, and source links`, () => {
      expect(entry.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(entry.slug).not.toBe("manage");
      expect(entry.metadata.uuid).toContain("@");
      expect(entry.metadata.name.trim().length).toBeGreaterThan(0);
      expect(entry.metadata.description.trim().length).toBeGreaterThan(0);
      expect(entry.metadata["shell-version"].length).toBeGreaterThan(0);
      expect(new URL(entry.source).protocol).toBe("https:");
      if (entry.gnomeUrl)
        expect(new URL(entry.gnomeUrl).hostname).toBe("extensions.gnome.org");
      expect(existsSync(`public${entry.icon}`)).toBe(true);
      expect(Number.isNaN(Date.parse(entry.updated))).toBe(false);
      expect(Number.isNaN(Date.parse(entry.added))).toBe(false);
    });
  }
});

describe("issue submission workflow", () => {
  for (const action of ["submit", "update", "remove"] as const) {
    test(`${action} targets a real form with matching prefill IDs`, () => {
      const entry = extensions[0];
      if (!entry) throw new Error("The catalog must have a fixture listing");
      const url = new URL(
        issueUrl(action, action === "submit" ? undefined : entry),
      );
      expect(url.origin + url.pathname).toBe(`${site.repository}/issues/new`);
      expect(url.pathname).toBe("/vibe-gnome/building/issues/new");
      const template = url.searchParams.get("template");
      const form = Bun.YAML.parse(
        readFileSync(`.github/ISSUE_TEMPLATE/${template}`, "utf8"),
      ) as { name: string; body: { id?: string }[] };
      expect(form.name.length).toBeGreaterThan(3);
      const ids = form.body.flatMap((field) => (field.id ? [field.id] : []));
      expect(new Set(ids).size).toBe(ids.length);
      if (action !== "submit") {
        for (const key of ["extension-name", "uuid", "repository"])
          expect(ids).toContain(key);
        expect(url.searchParams.get("uuid")).toBe(entry.metadata.uuid);
        expect(url.searchParams.get("repository")).toBe(entry.source);
      }
    });
  }
  test("encodes special characters without injecting query parameters", () => {
    const entry = extensions[0];
    if (!entry) throw new Error("Missing fixture");
    const name = "Example & labels=approved #1";
    const url = new URL(
      issueUrl("update", { ...entry, metadata: { ...entry.metadata, name } }),
    );
    expect(url.searchParams.get("extension-name")).toBe(name);
    expect(url.searchParams.has("labels")).toBe(false);
  });
});
