import { afterEach, expect, test } from "bun:test";
import seed from "../app/data/extensions.json";
import { listingPath } from "../app/lib/listing-links";
import { handleCatalogRequest } from "../app/server/catalog-api";
import { assertListingIdSchema } from "../scripts/d1-catalog";
import { catalogDatabase } from "./helpers/catalog-db";

const databases: ReturnType<typeof catalogDatabase>[] = [];
afterEach(() => {
  for (const data of databases.splice(0)) data.db.close();
});
const database = () => {
  const data = catalogDatabase();
  databases.push(data);
  return data;
};
const app = {
  id: "old-planner",
  appId: "us.hagreli.Planner",
  name: "Planner",
  href: "https://github.com/mhagrelius/planner",
  summary: "Tasks",
  submittedBy: "",
  tags: [],
};

test("backfills database IDs without changing original payloads or review history", async () => {
  const data = database();
  expect(await data.catalog.list("extensions")).toEqual(
    seed.map((entry, index) => ({ ...entry, dbId: index + 1 })),
  );
  expect(data.db.query("SELECT id FROM listing_ids ORDER BY id").all()).toEqual(
    [{ id: 1 }, { id: 2 }],
  );
  expect(data.db.query("SELECT * FROM listing_reviews").all()).toHaveLength(2);
  expect(
    data.db
      .query("SELECT json_extract(payload, '$.dbId') AS id FROM listings")
      .all(),
  ).toEqual([{ id: null }, { id: null }]);
  await assertListingIdSchema(data.query);
});

test("IDs remain stable through edits, unpublish and restore, and ignore payload IDs", async () => {
  const data = database();
  data.insert("apps", { ...app, dbId: 900 });
  await data.views.increment("apps", app.id);
  expect(await data.catalog.getById("apps", 3)).toEqual({ ...app, dbId: 3 });
  for (const status of ["unpublished", "published"]) {
    await data.query(
      "UPDATE listings SET status = ?, revision = ?, payload = json_set(payload, '$.name', 'New name') WHERE category = 'apps'",
      [status, status],
    );
    expect((await data.catalog.getById("apps", 3))?.dbId ?? null).toBe(
      status === "published" ? 3 : null,
    );
  }
  expect(await data.views.read("apps", app.id)).toBe(1);
  expect(
    listingPath("apps", (await data.catalog.getById("apps", 3)) ?? app),
  ).toBe("/apps/3/planner");
  expect(() =>
    data.db.query("UPDATE listing_ids SET id = 10 WHERE id = 3").run(),
  ).toThrow("immutable");
});

test("deleted IDs are never reused and identical short names have distinct links", async () => {
  const data = database();
  data.insert("apps", app);
  data.insert("apps", {
    ...app,
    id: "other-planner",
    appId: "org.example.Planner",
  });
  const entries = await data.catalog.list("apps");
  expect(entries.map((entry) => listingPath("apps", entry))).toEqual([
    "/apps/3/planner",
    "/apps/4/planner",
  ]);
  // History intentionally prevents hard deletion until an operator archives it.
  data.db.query("DELETE FROM listing_reviews WHERE category = 'apps'").run();
  data.db
    .query(
      "DELETE FROM listings WHERE category = 'apps' AND slug = 'other-planner'",
    )
    .run();
  data.insert("skills", {
    id: "submission-43",
    name: "Find skills",
    href: "https://www.skills.sh/vercel-labs/skills/find-skills",
    description: "Guidance",
  });
  expect((await data.catalog.list("skills"))[0]?.dbId).toBe(5);
  expect(await data.catalog.getById("apps", 4)).toBeNull();
});

test("numeric API lookup isolates categories and rejects malformed or hidden IDs", async () => {
  const data = database();
  data.insert("apps", app);
  data.insert(
    "apps",
    { ...app, appId: "org.example.Hidden", id: "hidden" },
    "unpublished",
  );
  const get = (path: string, method = "GET") =>
    handleCatalogRequest(
      new Request(`https://vibe-gnome.org/api/catalog/${path}`, { method }),
      data.catalog,
    );
  const response = await get("apps/by-id/3");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    category: "apps",
    entry: { ...app, dbId: 3 },
  });
  for (const path of [
    "skills/by-id/3",
    "apps/by-id/4",
    "apps/by-id/0",
    "apps/by-id/03",
    "apps/by-id/-1",
    "apps/by-id/9007199254740992",
    "apps/by-id/1.5",
    "apps/by-id/3/extra",
  ])
    expect((await get(path)).status).toBe(404);
  expect((await get("apps/by-id/3", "POST")).status).toBe(405);
});

test("publication refuses missing database ID migration constraints", async () => {
  for (const name of ["listings_assign_db_id", "listing_ids_immutable"]) {
    const data = database();
    data.db.exec(`DROP TRIGGER ${name}`);
    await expect(assertListingIdSchema(data.query)).rejects.toThrow(
      "0005_listing_ids.sql",
    );
  }
});
