import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { assertAppIdentitySchema } from "../scripts/d1-catalog";
import { catalogDatabase } from "./helpers/catalog-db";

const databases: ReturnType<typeof catalogDatabase>[] = [];
afterEach(() => {
  for (const data of databases.splice(0)) data.db.close();
});
const app = {
  id: "planner",
  appId: "us.hagreli.Planner",
  name: "Planner",
  href: "https://github.com/mhagrelius/planner",
  summary: "Tasks",
  submittedBy: "",
  tags: [],
};
function database() {
  const data = catalogDatabase();
  databases.push(data);
  return data;
}

test("migration preserves legacy app URLs, payloads, history, and view counts", async () => {
  const { appId: _appId, ...withoutId } = app;
  const legacy = { ...withoutId, id: "legacy-planner" };
  const data = catalogDatabase(undefined, (db) => {
    db.query(
      "INSERT INTO listings (category, slug, payload, source_issue, revision, created_at, updated_at) VALUES ('apps', 'legacy-planner', ?, 1, 'old-review', '2026-09-06', '2026-09-06')",
    ).run(JSON.stringify(legacy));
    db.exec("INSERT INTO listing_views VALUES ('apps', 'legacy-planner', 27)");
  });
  databases.push(data);
  expect(await data.catalog.get("apps", "legacy-planner")).toEqual({
    ...legacy,
    dbId: 3,
  });
  expect(await data.views.read("apps", "legacy-planner")).toBe(27);
  expect(
    data.db
      .query("SELECT payload FROM listing_reviews WHERE category = 'apps'")
      .all(),
  ).toEqual([{ payload: JSON.stringify(legacy) }]);
  await assertAppIdentitySchema(data.query);
  await data.query(
    "UPDATE listings SET payload = json_set(payload, '$.appId', ?), revision = 'adopt-id' WHERE category = 'apps' AND slug = 'legacy-planner'",
    [app.appId],
  );
  expect((await data.catalog.get("apps", "legacy-planner"))?.appId).toBe(
    app.appId,
  );
});

test("database rejects duplicate native IDs on direct inserts and updates across all statuses", async () => {
  const data = database();
  data.insert("apps", app);
  expect(() =>
    data.insert("apps", { ...app, id: "other-slug" }, "unpublished"),
  ).toThrow("UNIQUE");
  const { appId: _appId, ...legacy } = app;
  data.insert("apps", { ...legacy, id: "older-app" });
  await expect(
    data.query(
      "UPDATE listings SET payload = json_set(payload, '$.appId', ?), revision = 'duplicate' WHERE category = 'apps' AND slug = 'older-app'",
      [app.appId],
    ),
  ).rejects.toThrow("UNIQUE");
  expect((await data.catalog.list("apps")).map((entry) => entry.id)).toEqual([
    "older-app",
    "planner",
  ]);
});

test("database rejects invalid ID types and values without adding history", () => {
  const data = database();
  for (const appId of [
    null,
    123,
    [],
    {},
    "",
    " ",
    "org.example.<App>",
    "a".repeat(256),
  ]) {
    expect(() =>
      data.db
        .query(
          "INSERT INTO listings (category, slug, payload, revision, created_at, updated_at) VALUES ('apps', 'invalid', ?, 'bad', 'now', 'now')",
        )
        .run(JSON.stringify({ id: "invalid", appId })),
    ).toThrow("App ID must");
  }
  expect(
    data.db
      .query("SELECT * FROM listing_reviews WHERE category = 'apps'")
      .all(),
  ).toEqual([]);
});

test("recorded IDs cannot change or disappear during direct updates", async () => {
  const data = database();
  data.insert("apps", app);
  for (const value of ["org.example.Other", null, 17])
    await expect(
      data.query(
        "UPDATE listings SET payload = json_set(payload, '$.appId', ?), revision = 'changed' WHERE category = 'apps' AND slug = 'planner'",
        [value],
      ),
    ).rejects.toThrow();
  await expect(
    data.query(
      "UPDATE listings SET payload = json_remove(payload, '$.appId'), revision = 'removed' WHERE category = 'apps' AND slug = 'planner'",
    ),
  ).rejects.toThrow("cannot be changed or removed");
  await data.query(
    "UPDATE listings SET status = 'unpublished', revision = 'hide' WHERE category = 'apps' AND slug = 'planner'",
  );
  expect(
    data.db
      .query(
        "SELECT json_extract(payload, '$.appId') AS id FROM listings WHERE category = 'apps'",
      )
      .get(),
  ).toEqual({ id: app.appId });
  expect(
    data.db
      .query("SELECT * FROM listing_reviews WHERE category = 'apps'")
      .all(),
  ).toHaveLength(2);
});

test("migration refuses pre-existing duplicate native IDs instead of rewriting records", () => {
  const data = database();
  data.db.exec(
    "DROP INDEX listings_app_id; DROP TRIGGER listings_app_id_insert; DROP TRIGGER listings_app_id_update; DROP TRIGGER listings_app_id_immutable",
  );
  data.insert("apps", app);
  data.insert("apps", { ...app, id: "duplicate" });
  const migration = readFileSync(
    "app/server/migrations/0004_app_identity.sql",
    "utf8",
  );
  // Execute the first migration statement separately: Bun's multi-statement exec
  // can hide an earlier constraint error when a later statement succeeds.
  expect(() =>
    data.db.query(migration.slice(0, migration.indexOf(";") + 1)).run(),
  ).toThrow("UNIQUE");
  expect(
    data.db.query("SELECT slug FROM listings WHERE category = 'apps'").all(),
  ).toHaveLength(2);
});

test("publication schema preflight reports every missing identity constraint", async () => {
  for (const [type, name] of [
    ["INDEX", "listings_app_id"],
    ["TRIGGER", "listings_app_id_insert"],
    ["TRIGGER", "listings_app_id_update"],
    ["TRIGGER", "listings_app_id_immutable"],
  ]) {
    const data = database();
    data.db.exec(`DROP ${type} ${name}`);
    await expect(assertAppIdentitySchema(data.query)).rejects.toThrow(
      "0004_app_identity.sql",
    );
  }
});
