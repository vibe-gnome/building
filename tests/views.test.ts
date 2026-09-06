import { Database } from "bun:sqlite";
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import extensions from "../app/data/extensions.json";
import type { ListingCategory } from "../app/lib/listings";
import { recordView } from "../app/lib/views";
import { createViewStore, type ViewStore } from "../app/server/view-store";
import { handleViewsRequest as handleStoredViewsRequest } from "../app/server/views-api";

const migration = await Bun.file(
  new URL("../app/server/migrations/0001_listing_views.sql", import.meta.url),
).text();
const slug = extensions[0]?.slug ?? "missing";
const known = new Set(extensions.map((entry) => `extensions/${entry.slug}`));
function handleViewsRequest(request: Request, store: ViewStore) {
  return handleStoredViewsRequest(request, store, {
    async exists(category, slug) {
      return known.has(`${category}/${slug}`);
    },
  });
}
const databases: Database[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  known.delete("apps/shared-id");
  known.delete("skills/shared-id");
});

function createStore(): ViewStore {
  const db = new Database(":memory:");
  databases.push(db);
  db.exec(migration);
  return createViewStore({
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first<T>() {
              return db.query<T, string[]>(sql).get(...values);
            },
          };
        },
      };
    },
  });
}

function request(
  path = `extensions/${slug}`,
  method = "POST",
  headers: HeadersInit = { "X-Vibe-View": "1" },
) {
  return new Request(`https://vibe-gnome.org/api/views/${path}`, {
    method,
    headers,
  });
}

describe("persistent listing view API", () => {
  test("reads zero without creating a view; counts visits and returns uncached totals", async () => {
    const store = createStore();
    const initial = await handleViewsRequest(request(undefined, "GET"), store);
    expect(await initial.json()).toEqual({
      category: "extensions",
      slug,
      views: 0,
    });
    expect(initial.headers.get("Cache-Control")).toBe("no-store");
    const first = await handleViewsRequest(request(), store);
    expect((await first.json()).views).toBe(1);
    const second = await handleViewsRequest(request(), store);
    expect((await second.json()).views).toBe(2);
    const read = await handleViewsRequest(request(undefined, "GET"), store);
    expect((await read.json()).views).toBe(2);
  });

  test("isolates categories and listing IDs, retaining every increment", async () => {
    const store = createStore();
    const counts = await Promise.all(
      Array.from({ length: 50 }, () =>
        store.increment("extensions", "shared-id"),
      ),
    );
    expect(new Set(counts).size).toBe(50);
    expect(await store.read("extensions", "shared-id")).toBe(50);
    expect(await store.read("extensions", "another-id")).toBe(0);
    for (const category of ["apps", "skills"] as const) {
      expect(await store.increment(category, "shared-id")).toBe(1);
    }
    expect(await store.read("extensions", "shared-id")).toBe(50);
  });

  test("accepts reviewed apps and skills through the same endpoint", async () => {
    known.add("apps/shared-id");
    known.add("skills/shared-id");
    const store = createStore();
    for (const category of ["apps", "skills"] as const) {
      const response = await handleViewsRequest(
        request(`${category}/shared-id`),
        store,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        category,
        slug: "shared-id",
        views: 1,
      });
    }
  });

  test("rejects unknown categories, unknown listings, and malformed paths without writing", async () => {
    const store = createStore();
    const increment = spyOn(store, "increment");
    for (const path of [
      "apps/missing",
      "skills/missing",
      "extensions/missing",
      `other/${slug}`,
      `extensions/${slug}/extra`,
      "extensions/%27",
      "extensions/",
      "extensions/__proto__",
    ]) {
      expect((await handleViewsRequest(request(path), store)).status).toBe(404);
    }
    expect(increment).not.toHaveBeenCalled();
  });

  test("rejects cross-origin and simple POSTs, while allowing same-origin visits", async () => {
    const store = createStore();
    const rejectedHeaders: HeadersInit[] = [
      {},
      { "X-Vibe-View": "1", Origin: "https://other.example" },
      { "X-Vibe-View": "1", "Sec-Fetch-Site": "cross-site" },
    ];
    for (const headers of rejectedHeaders) {
      expect(
        (await handleViewsRequest(request(undefined, "POST", headers), store))
          .status,
      ).toBe(403);
    }
    const response = await handleViewsRequest(
      request(undefined, "POST", {
        "X-Vibe-View": "1",
        Origin: "https://vibe-gnome.org",
        "Sec-Fetch-Site": "same-origin",
      }),
      store,
    );
    expect((await response.json()).views).toBe(1);
  });

  test("unsupported methods never increment a count", async () => {
    const store = createStore();
    for (const method of ["PUT", "DELETE", "OPTIONS", "HEAD"]) {
      const response = await handleViewsRequest(
        request(undefined, method),
        store,
      );
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET, POST");
    }
    expect(await store.read("extensions", slug)).toBe(0);
  });

  test("storage failures return an unavailable response rather than a fabricated zero", async () => {
    const store = createStore();
    spyOn(store, "increment").mockRejectedValue(new Error("Database offline"));
    const log = spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleViewsRequest(request(), store);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "View count unavailable",
      });
    } finally {
      log.mockRestore();
    }
  });
});

describe("browser view requests", () => {
  test("records one visit with the expected category, ID, and request headers", async () => {
    let calls = 0;
    const count = await recordView("extensions", slug, async (url, init) => {
      calls++;
      expect(url).toBe(`/api/views/extensions/${slug}`);
      expect(init.method).toBe("POST");
      expect(init.cache).toBe("no-store");
      expect(init.headers).toEqual({ "X-Vibe-View": "1" });
      return Response.json({ category: "extensions", slug, views: 1234 });
    });
    expect(count).toBe(1234);
    expect(calls).toBe(1);
  });

  test("rejects invalid totals and mismatched listings", async () => {
    const category: ListingCategory = "extensions";
    for (const data of [
      null,
      {},
      { category, slug, views: -1 },
      { category, slug, views: 1.5 },
      { category, slug, views: "5" },
      { category, slug, views: Number.MAX_SAFE_INTEGER + 1 },
      { category: "apps", slug, views: 1 },
      { category, slug: "other", views: 1 },
    ]) {
      await expect(
        recordView(category, slug, async () => Response.json(data)),
      ).rejects.toThrow("Invalid view count response");
    }
  });

  test("does not retry when a POST fails or returns HTML from a static host", async () => {
    for (const response of [
      new Response("offline", { status: 503 }),
      new Response("<!doctype html>"),
    ]) {
      let calls = 0;
      await expect(
        recordView("extensions", slug, async () => {
          calls++;
          return response;
        }),
      ).rejects.toThrow();
      expect(calls).toBe(1);
    }
  });
});
