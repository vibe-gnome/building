import type { ListingCategory } from "../lib/listings";

export interface ViewStore {
  read(category: ListingCategory, slug: string): Promise<number>;
  increment(category: ListingCategory, slug: string): Promise<number>;
}

// A single SQL statement prevents lost increments from concurrent visitors.
export const incrementViewsSql = `
  INSERT INTO listing_views (category, slug, views) VALUES (?1, ?2, 1)
  ON CONFLICT (category, slug) DO UPDATE SET views = listing_views.views + 1
  RETURNING views
`;
export const readViewsSql =
  "SELECT views FROM listing_views WHERE category = ?1 AND slug = ?2";

// The storage boundary only needs this subset of a D1 binding. Keeping the
// platform globals in the Worker tsconfig avoids changing browser/Bun types.
export interface ViewDatabase {
  prepare(sql: string): {
    bind(...values: string[]): {
      first<T>(): Promise<T | null>;
    };
  };
}

export function createViewStore(db: ViewDatabase): ViewStore {
  return {
    async read(category, slug) {
      const row = await db
        .prepare(readViewsSql)
        .bind(category, slug)
        .first<{ views: number }>();
      return row?.views ?? 0;
    },
    async increment(category, slug) {
      const row = await db
        .prepare(incrementViewsSql)
        .bind(category, slug)
        .first<{ views: number }>();
      if (!row) throw new Error("View increment returned no count");
      return row.views;
    },
  };
}
