import type { ListingCategory, ListingTypes } from "../lib/listings";

// This small structural interface allows the same SQL to be tested with SQLite.
// The Worker uses the generated Env.DB type at its entry point.
export interface CatalogDatabase {
  prepare(sql: string): {
    bind(...values: (string | number | null)[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

export interface CatalogStore {
  list<C extends ListingCategory>(
    category: C,
    after?: string,
    limit?: number,
  ): Promise<ListingTypes[C][]>;
  get<C extends ListingCategory>(
    category: C,
    slug: string,
  ): Promise<ListingTypes[C] | null>;
  exists(category: ListingCategory, slug: string): Promise<boolean>;
}

export function createCatalogStore(db: CatalogDatabase): CatalogStore {
  return {
    async list<C extends ListingCategory>(
      category: C,
      after = "",
      limit = 100,
    ) {
      const { results } = await db
        .prepare(
          "SELECT payload FROM listings WHERE category = ? AND status = 'published' AND slug > ? ORDER BY slug LIMIT ?",
        )
        .bind(category, after, limit)
        .all<{ payload: string }>();
      return results.map((row) => JSON.parse(row.payload) as ListingTypes[C]);
    },
    async get<C extends ListingCategory>(category: C, slug: string) {
      const row = await db
        .prepare(
          "SELECT payload FROM listings WHERE category = ? AND slug = ? AND status = 'published'",
        )
        .bind(category, slug)
        .first<{ payload: string }>();
      return row ? (JSON.parse(row.payload) as ListingTypes[C]) : null;
    },
    async exists(category, slug) {
      return !!(await db
        .prepare(
          "SELECT 1 AS found FROM listings WHERE category = ? AND slug = ? AND status = 'published'",
        )
        .bind(category, slug)
        .first<{ found: number }>());
    },
  };
}
