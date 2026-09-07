import { afterEach, describe, expect, spyOn, test } from "bun:test";
import seed from "../app/data/extensions.json";
import { loadCatalog, loadListing } from "../app/lib/catalog-client";
import { handleCatalogRequest } from "../app/server/catalog-api";
import { handleViewsRequest } from "../app/server/views-api";
import { catalogDatabase } from "./helpers/catalog-db";

const databases: ReturnType<typeof catalogDatabase>[] = [];
const database = () => {
  const value = catalogDatabase();
  databases.push(value);
  return value;
};
afterEach(() => {
  for (const value of databases.splice(0)) value.db.close();
});
const app = {
  id: "editor",
  name: "Editor",
  summary: "A GTK editor",
  href: "https://example.org/editor",
  submittedBy: "Maintainer",
  tags: ["GTK"],
};
const skill = {
  id: "gtk",
  name: "GTK skill",
  description: "GTK guidance",
  href: "https://skills.sh/example/skills/gtk",
};
const request = (path: string, method = "GET") =>
  new Request(`https://vibe-gnome.org/api/catalog/${path}`, { method });

describe("D1 catalog migration and reads", () => {
  test("imports every original extension and leaves existing view counts untouched", async () => {
    const data = catalogDatabase((db) =>
      db.exec(
        "INSERT INTO listing_views VALUES ('extensions', 'codex-usage-indicator', 123)",
      ),
    );
    databases.push(data);
    expect(await data.catalog.list("extensions")).toEqual(
      seed.map((entry, index) => ({ ...entry, dbId: index + 1 })),
    );
    expect(await data.catalog.list("apps")).toEqual([]);
    expect(await data.catalog.list("skills")).toEqual([]);
    expect(await data.views.read("extensions", "codex-usage-indicator")).toBe(
      123,
    );
    expect(data.db.query("SELECT * FROM listing_reviews").all()).toHaveLength(
      2,
    );
  });

  test("reads all three categories from SQL and never exposes unpublished records or review evidence", async () => {
    const data = database();
    data.insert("apps", app);
    data.insert("skills", skill);
    data.insert("apps", { ...app, id: "hidden" }, "unpublished");
    for (const [category, id, entry] of [
      ["apps", app.id, { ...app, dbId: 3 }],
      ["skills", skill.id, { ...skill, dbId: 4 }],
      ["extensions", seed[0]?.slug, { ...seed[0], dbId: 1 }],
    ] as const) {
      const response = await handleCatalogRequest(
        request(`${category}/${id}`),
        data.catalog,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ category, entry });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    const list = await handleCatalogRequest(request("apps"), data.catalog);
    expect(await list.json()).toEqual({
      category: "apps",
      entries: [{ ...app, dbId: 3 }],
      next: null,
    });
    expect(
      (await handleCatalogRequest(request("apps/hidden"), data.catalog)).status,
    ).toBe(404);
    expect(await data.catalog.exists("apps", "hidden")).toBe(false);
  });

  test("paginates deterministically without omitting newly stored records", async () => {
    const data = database();
    for (let i = 0; i < 105; i++)
      data.insert("apps", { ...app, id: `app-${String(i).padStart(3, "0")}` });
    const fetcher = async (path: string) =>
      handleCatalogRequest(
        new Request(`https://vibe-gnome.org${path}`),
        data.catalog,
      );
    const all = await loadCatalog("apps", AbortSignal.timeout(1000), fetcher);
    expect(all).toHaveLength(105);
    expect(new Set(all.map((entry) => entry.id)).size).toBe(105);
    expect(all.at(-1)?.id).toBe("app-104");
  });

  test("rejects malformed paths and public writes", async () => {
    const data = database();
    for (const path of ["other", "apps/a/extra", "apps/%27", "apps/__proto__"])
      expect(
        (await handleCatalogRequest(request(path), data.catalog)).status,
      ).toBe(404);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"])
      expect(
        (await handleCatalogRequest(request("apps", method), data.catalog))
          .status,
      ).toBe(405);
    expect(
      (await handleCatalogRequest(request("apps?after=%27"), data.catalog))
        .status,
    ).toBe(400);
  });

  test("database outages report 503 instead of an empty catalog", async () => {
    const data = database();
    spyOn(data.catalog, "list").mockRejectedValue(new Error("offline"));
    const log = spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        (await handleCatalogRequest(request("apps"), data.catalog)).status,
      ).toBe(503);
    } finally {
      log.mockRestore();
    }
  });

  test("view counts recognize a new database listing without rebuilding", async () => {
    const data = database();
    const visit = () =>
      handleViewsRequest(
        new Request("https://vibe-gnome.org/api/views/apps/editor", {
          method: "POST",
          headers: { "X-Vibe-View": "1" },
        }),
        data.views,
        data.catalog,
      );
    expect((await visit()).status).toBe(404);
    data.insert("apps", app);
    expect((await (await visit()).json()).views).toBe(1);
    data.db.exec(
      "UPDATE listings SET status = 'unpublished', revision = 'hide' WHERE category = 'apps' AND slug = 'editor'",
    );
    expect((await visit()).status).toBe(404);
    expect(await data.views.read("apps", "editor")).toBe(1);
  });
});

describe("catalog route requests", () => {
  test("loads a detail from the API and distinguishes missing from unavailable", async () => {
    const signal = AbortSignal.timeout(1000);
    expect(
      await loadListing("apps", "editor", signal, async () =>
        Response.json({ category: "apps", entry: app }),
      ),
    ).toEqual(app);
    expect(
      await loadListing(
        "apps",
        "missing",
        signal,
        async () => new Response(null, { status: 404 }),
      ),
    ).toBeNull();
    for (const response of [
      new Response(null, { status: 503 }),
      new Response("<html>"),
      Response.json({ category: "skills", entry: app }),
    ]) {
      await expect(
        loadListing("apps", "editor", signal, async () => response),
      ).rejects.toBeInstanceOf(Response);
    }
  });
  test("rejects invalid or non-advancing pagination", async () => {
    for (const data of [
      {},
      { category: "skills", entries: [], next: null },
      { category: "apps", entries: [], next: "" },
    ]) {
      await expect(
        loadCatalog("apps", AbortSignal.timeout(1000), async () =>
          Response.json(data),
        ),
      ).rejects.toBeInstanceOf(Response);
    }
  });
});
