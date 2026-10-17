import { describe, expect, test } from "bun:test";
import {
  findBadgeProjects,
  loadBadgeProjects,
} from "../app/lib/badge-projects";
import type { CatalogFetcher } from "../app/lib/catalog-client";

const app = {
  dbId: 31,
  id: "old-app-slug",
  appId: "org.example.NoteBook",
  name: "Shared Notes",
  summary: "A notes app.",
};
const extension = {
  dbId: 42,
  slug: "old-extension-slug",
  metadata: { uuid: "quick-notes@example.org", name: "Shared Notes" },
};

describe("badge project lookup", () => {
  test("loads every catalog page and keeps duplicate names with their own canonical links", async () => {
    const requests: { url: string; signal: AbortSignal | null | undefined }[] =
      [];
    const signal = new AbortController().signal;
    const projects = await loadBadgeProjects(signal, async (url, init) => {
      requests.push({ url, signal: init.signal });
      return Response.json(
        url.includes("extensions")
          ? { category: "extensions", entries: [extension], next: null }
          : url.includes("after=")
            ? { category: "apps", entries: [app], next: null }
            : { category: "apps", entries: [], next: "notes-cursor" },
      );
    });

    expect(requests.map((request) => request.url).sort()).toEqual([
      "/api/catalog/apps",
      "/api/catalog/apps?after=notes-cursor",
      "/api/catalog/extensions",
    ]);
    expect(requests.every((request) => request.signal === signal)).toBe(true);
    expect(projects).toEqual([
      {
        name: "Shared Notes",
        category: "apps",
        url: "https://vibe-gnome.org/apps/31/notebook",
      },
      {
        name: "Shared Notes",
        category: "extensions",
        url: "https://vibe-gnome.org/extensions/42/quick-notes",
      },
    ]);
    expect(findBadgeProjects(projects, "  NOTES   shared ")).toEqual(projects);
    expect(findBadgeProjects(projects, "missing")).toEqual([]);
    expect(findBadgeProjects(projects, "   ")).toEqual([]);
  });

  test("supports empty catalogs", async () => {
    const projects = await loadBadgeProjects(
      new AbortController().signal,
      async (url) =>
        Response.json({
          category: url.endsWith("apps") ? "apps" : "extensions",
          entries: [],
          next: null,
        }),
    );
    expect(projects).toEqual([]);
  });

  test("reports failure when either catalog is unavailable", async () => {
    for (const failedCategory of ["apps", "extensions"]) {
      const fetcher: CatalogFetcher = async (url) =>
        url.endsWith(failedCategory)
          ? new Response("Unavailable", { status: 503 })
          : Response.json({
              category: url.endsWith("apps") ? "apps" : "extensions",
              entries: [],
              next: null,
            });
      await expect(
        loadBadgeProjects(new AbortController().signal, fetcher),
      ).rejects.toBeInstanceOf(Response);
    }
  });
});
