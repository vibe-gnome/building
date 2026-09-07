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
  getById<C extends ListingCategory>(
    category: C,
    dbId: number,
  ): Promise<ListingTypes[C] | null>;
  exists(category: ListingCategory, slug: string): Promise<boolean>;
}

export function createCatalogStore(db: CatalogDatabase): CatalogStore {
  const select =
    "SELECT l.payload, i.id AS dbId FROM listings l JOIN listing_ids i ON i.category = l.category AND i.slug = l.slug";
  const entry = <C extends ListingCategory>(row: {
    payload: string;
    dbId: number;
  }): ListingTypes[C] => ({
    ...JSON.parse(row.payload),
    dbId: row.dbId,
  });
  return {
    async list<C extends ListingCategory>(
      category: C,
      after = "",
      limit = 100,
    ) {
      const { results } = await db
        .prepare(
          `${select} WHERE l.category = ? AND l.status = 'published' AND l.slug > ? ORDER BY l.slug LIMIT ?`,
        )
        .bind(category, after, limit)
        .all<{ payload: string; dbId: number }>();
      return results.map((row) => entry<C>(row));
    },
    async get<C extends ListingCategory>(category: C, slug: string) {
      const row = await db
        .prepare(
          `${select} WHERE l.category = ? AND l.slug = ? AND l.status = 'published'`,
        )
        .bind(category, slug)
        .first<{ payload: string; dbId: number }>();
      return row ? entry<C>(row) : null;
    },
    async getById<C extends ListingCategory>(category: C, dbId: number) {
      const row = await db
        .prepare(
          `${select} WHERE l.category = ? AND i.id = ? AND l.status = 'published'`,
        )
        .bind(category, dbId)
        .first<{ payload: string; dbId: number }>();
      return row ? entry<C>(row) : null;
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
