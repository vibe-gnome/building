import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import type { CatalogListing, ListingCategory } from "../../app/lib/listings";
import { createCatalogStore } from "../../app/server/catalog-store";
import { createViewStore } from "../../app/server/view-store";
import type { SqlQuery } from "../../scripts/d1-catalog";

export function catalogDatabase(beforeCatalog?: (db: Database) => void) {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of [
    "0001_listing_views.sql",
    "0002_catalog.sql",
    "0003_catalog_seed.sql",
  ]) {
    if (file === "0002_catalog.sql") beforeCatalog?.(db);
    db.exec(
      readFileSync(
        new URL(`../../app/server/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  }
  const binding = {
    prepare(sql: string) {
      return {
        bind(...values: (string | number | null)[]) {
          return {
            async first<T>() {
              return db
                .query<T, (string | number | null)[]>(sql)
                .get(...values);
            },
            async all<T>() {
              return {
                results: db
                  .query<T, (string | number | null)[]>(sql)
                  .all(...values),
              };
            },
          };
        },
      };
    },
  };
  const query: SqlQuery = async (sql, params = []) => ({
    results: db
      .query<Record<string, unknown>, (string | number | null)[]>(sql)
      .all(...params),
  });
  function insert(
    category: ListingCategory,
    entry: CatalogListing,
    status = "published",
  ) {
    const slug = "slug" in entry ? entry.slug : entry.id;
    db.query(
      "INSERT INTO listings (category, slug, status, payload, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 'test', '2026-09-06', '2026-09-06')",
    ).run(category, slug, status, JSON.stringify(entry));
  }
  return {
    db,
    query,
    insert,
    catalog: createCatalogStore(binding),
    views: createViewStore(binding),
  };
}
