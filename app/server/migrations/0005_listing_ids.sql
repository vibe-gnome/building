-- Keep the original catalog keys, views, and review history intact. Public URLs
-- use an automatically allocated ID that is never reused after a hard deletion.
CREATE TABLE listing_ids (
  id INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id BETWEEN 1 AND 9007199254740991),
  category TEXT NOT NULL,
  slug TEXT NOT NULL,
  UNIQUE (category, slug),
  FOREIGN KEY (category, slug) REFERENCES listings(category, slug) ON DELETE CASCADE
);

INSERT INTO listing_ids (category, slug)
SELECT category, slug FROM listings ORDER BY created_at, category, slug;

CREATE TRIGGER listings_assign_db_id AFTER INSERT ON listings
BEGIN
  INSERT INTO listing_ids (category, slug) VALUES (NEW.category, NEW.slug);
END;

CREATE TRIGGER listing_ids_immutable BEFORE UPDATE ON listing_ids
BEGIN
  SELECT RAISE(ABORT, 'Listing database IDs are immutable');
END;
